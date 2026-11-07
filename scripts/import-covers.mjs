import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import sharp from 'sharp';
import {findZipPreviews} from './zip-previews.mjs';

const credentials=['GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','GOOGLE_REFRESH_TOKEN'].map(x=>process.env[x]);
if(credentials.every(x=>!x)){console.log('Sin conexión a Drive: no se buscaron portadas.');process.exit(0)}
if(credentials.some(x=>!x))throw Error('Falta configuración de Drive.');
const [clientId,clientSecret,refreshToken]=credentials;
const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,refresh_token:refreshToken,grant_type:'refresh_token'})});
if(!response.ok)throw Error(`No se pudo autorizar la lectura de Drive (HTTP ${response.status}).`);
const {access_token:token}=await response.json();if(!token)throw Error('No se recibió autorización de Drive.');
const snapshot=JSON.parse(await fs.readFile('snapshot/catalogo.json','utf8'));
const runtime=JSON.parse(await fs.readFile('.runtime/catalogo.json','utf8'));
const attempts=JSON.parse(await fs.readFile('snapshot/inspecciones.json','utf8').catch(e=>{if(e.code==='ENOENT')return '{}';throw e;}));
const known=new Set(snapshot.mods.map(m=>m.id)),limit=Date.now()-30*24*60*60*1000;
const pending=runtime.mods.filter(m=>!runtime.covers[m.id]&&Number(m.size)>0&&(!known.has(m.id)||Date.parse(m.createdTime||m.modifiedTime||'')>=limit)&&(!attempts[m.id]||attempts[m.id].version!==String(m.modifiedTime||'')||Date.parse(attempts[m.id].retryAfter||'9999-01-01')<=Date.now())).sort((a,b)=>String(b.createdTime||b.modifiedTime||'').localeCompare(String(a.createdTime||a.modifiedTime||''))).slice(0,3);
async function range(file,start,end){
  const length=end-start+1;if(start<0||end>=Number(file.size)||length<1||length>5*1024*1024)throw Error('Rango inválido');
  const r=await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media&supportsAllDrives=true`,{headers:{Authorization:`Bearer ${token}`,Range:`bytes=${start}-${end}`},signal:AbortSignal.timeout(45000)});
  if(r.status!==206||r.headers.get('content-range')!==`bytes ${start}-${end}/${file.size}`){await r.body?.cancel();throw Error('Drive no permitió la lectura parcial');}
  const chunks=[];let total=0;for await(const chunk of r.body){total+=chunk.length;if(total>length)throw Error('Respuesta de Drive demasiado grande');chunks.push(Buffer.from(chunk));}
  if(total!==length)throw Error('Lectura parcial incompleta');return Buffer.concat(chunks,total);
}
async function readOther(file){
  const python=process.env.ASSETTO_PYTHON||(process.platform==='win32'?'python':'python3');
  return new Promise((resolve,reject)=>{
    const child=spawn(python,['scripts/leer-comprimido.py'],{stdio:['pipe','pipe','pipe'],windowsHide:true});let out='',settled=false;
    const finish=(err,value)=>{if(settled)return;settled=true;clearTimeout(timer);err?reject(err):resolve(value)};
    const timer=setTimeout(()=>{child.kill();finish(Error('Tiempo de inspección agotado'))},100000);
    child.on('error',()=>finish(Error('No se pudo iniciar el lector')));
    child.stdout.on('data',chunk=>{out+=chunk.toString();if(out.length>45*1024*1024){child.kill();finish(Error('Demasiadas imágenes'))}});
    child.stderr.resume();child.on('close',code=>{if(settled)return;try{const data=JSON.parse(out);if(code||data.error)throw Error(data.error||'No se pudo leer el archivo');const images=data.images||[];if(images.length>6)throw Error('Demasiadas imágenes');finish(null,images.map(i=>({data:Buffer.from(i.data,'base64')})))}catch(e){finish(e)}});
    child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify({id:file.id,size:Number(file.size),type:/\.rar$/i.test(file.name)?'rar':'7z',token}));
  });
}
for(const file of pending){
  try{
    const images=/\.zip$/i.test(file.name)?await findZipPreviews(Number(file.size),(a,b)=>range(file,a,b)):await readOther(file);
    const output=[];
    for(const image of images){
      if(!image.data?.length||image.data.length>5*1024*1024)continue;
      const optimized=await sharp(image.data,{limitInputPixels:40000000}).rotate().resize({width:960,height:540,fit:'inside',withoutEnlargement:true}).webp({quality:78}).toBuffer();
      const name=createHash('sha256').update(optimized).digest('hex')+'.webp';await fs.writeFile('snapshot/media/'+name,optimized);
      if(!output.some(x=>x.url==='./media/'+name))output.push({url:'./media/'+name,version:Date.now()});
    }
    if(output.length){const cover={kind:'manual',url:output[0].url,version:output[0].version,images:output};runtime.covers[file.id]=cover;snapshot.covers[file.id]=cover;}
    attempts[file.id]={version:String(file.modifiedTime||'')};console.log(`${file.name}: ${output.length} portadas encontradas.`);
  }catch(e){attempts[file.id]={version:String(file.modifiedTime||''),retryAfter:new Date(Date.now()+24*60*60*1000).toISOString()};console.log(`${file.name}: no se pudo inspeccionar (${e.message}).`);}
}
for(const mod of runtime.mods)if(!known.has(mod.id)){snapshot.mods.push(mod);known.add(mod.id);}
await fs.writeFile('snapshot/inspecciones.json',JSON.stringify(attempts));
await fs.writeFile('snapshot/catalogo.json',JSON.stringify(snapshot));
await fs.writeFile('.runtime/catalogo.json',JSON.stringify(runtime));
console.log(`Inspeccionados ${pending.length} archivos sin portada.`);

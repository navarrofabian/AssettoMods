import fs from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {Readable,Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';

const id=/^[A-Za-z0-9_][A-Za-z0-9_.-]{0,99}$/,skin=/^[\p{L}\p{M}\p{N}# _.,-]{1,100}$/u;
const segment=/^[\p{L}\p{M}\p{N}# _.,()-]{1,160}$/u;
const safeName=s=>s&&!s.startsWith('/')&&!s.includes('\\')&&s.split('/').every(x=>x&&x!=='.'&&x!=='..'&&segment.test(x));
export function planArchive(names,kind){
  if(!['cars','tracks'].includes(kind)||!Array.isArray(names)||names.length>200000)throw Error('Listado de archivo inválido o demasiado grande.');
  const entries=names.filter(s=>typeof s==='string'&&safeName(s));if(new Set(entries).size!==entries.length)throw Error('El paquete contiene rutas duplicadas y no se puede preparar de forma segura.');const items=new Map();
  for(const name of entries){
    if(kind==='cars'){
      const m=/(?:^|\/)cars\/([^/]+)\/data\.acd$/i.exec(name)||/^([^/]+)\/data\.acd$/i.exec(name);
      if(!m||!id.test(m[1]))continue;const prefix=name.slice(0,-'/data.acd'.length),key=m[1];if(items.has(key)&&items.get(key).prefix!==prefix)throw Error(`El paquete contiene varias carpetas para ${key}.`);
      items.set(key,{id:key,prefix,files:[{entry:name,relative:'data.acd'}],skins:[]});
    }else{
      const m=/(?:^|\/)tracks\/([^/]+)\/(?:(.+?)\/)?data\/surfaces\.ini$/i.exec(name)||/^([^/]+)\/(?:(.+?)\/)?data\/surfaces\.ini$/i.exec(name);
      if(!m||!id.test(m[1])||(m[2]&&!id.test(m[2])))continue;const key=m[1],layout=m[2]||'',suffix=(layout?'/'+layout:'')+'/data/surfaces.ini',prefix=name.slice(0,-suffix.length);
      if(items.has(key)&&items.get(key).prefix!==prefix)throw Error(`El paquete contiene varias carpetas para ${key}.`);let item=items.get(key);if(!item){item={id:key,prefix,layouts:[],files:[]};items.set(key,item)}if(!item.layouts.includes(layout))item.layouts.push(layout);
    }
  }
  for(const item of items.values()){
    if(kind==='cars'){const found=new Set();for(const entry of entries){if(!entry.startsWith(item.prefix+'/skins/'))continue;const rest=entry.slice((item.prefix+'/skins/').length),v=rest.split('/')[0];if(skin.test(v)&&v!=='.'&&v!=='..')found.add(v);}item.skins=[...found].slice(0,2000).sort();}
    else {for(const entry of entries){if(!entry.startsWith(item.prefix+'/'))continue;const rel=entry.slice(item.prefix.length+1),parts=rel.split('/');if(!parts.every(p=>segment.test(p)&&p!=='.'&&p!=='..'))continue;const hasLayout=item.layouts.includes(parts[0])&&parts[0]!=='';const rest=hasLayout?parts.slice(1):parts;if((rest[0]==='data'||rest[0]==='ai')&&/\.(?:ini|ai|aip|bin)$/i.test(rest.at(-1)))item.files.push({entry,relative:rel});else if(parts.length===1&&/^models(?:_[A-Za-z0-9_.-]+)?\.ini$/i.test(rel))item.files.push({entry,relative:rel});else if(/^ui\/(?:[A-Za-z0-9_.-]+\/)?ui_track\.json$/i.test(rel))item.files.push({entry,relative:rel});}if(item.files.length>10000)throw Error('El circuito tiene demasiados archivos.');}
  }
  if(!items.size)throw Error('No se encontraron datos compatibles de Assetto Corsa en el archivo.');if(items.size>200)throw Error('El paquete contiene más de 200 mods y no se puede preparar automáticamente.');return [...items.values()];
}
function runTar(tar,args,{output=false,limit=16*1024*1024,timeout=120000}={}){return new Promise((resolve,reject)=>{const child=spawn(tar,args,{stdio:['ignore','pipe','pipe'],windowsHide:true});let chunks=[],size=0,error='',finished=false;const timer=setTimeout(()=>child.kill(),timeout);child.stdout.on('data',c=>{size+=c.length;if(size>limit){error='El archivo supera el límite de seguridad.';child.kill()}else if(output)chunks.push(c)});child.stderr.on('data',()=>{});child.on('error',e=>{if(finished)return;finished=true;clearTimeout(timer);reject(e)});child.on('close',code=>{if(finished)return;finished=true;clearTimeout(timer);if(error||code!==0)return reject(Error(error||'No se pudo leer el comprimido; puede estar dañado, protegido o no ser compatible.'));resolve(Buffer.concat(chunks).toString('utf8'));});});}
async function extractFile(tar,archive,entry,dest,state){await fs.mkdir(path.dirname(dest),{recursive:true});const child=spawn(tar,['-xOf',archive,'--',entry],{stdio:['ignore','pipe','pipe'],windowsHide:true}),out=createWriteStream(dest,{flags:'wx'});let size=0;const max=/ui_track\.json$/i.test(entry)?1024*1024:128*1024*1024;child.stderr.resume();const timer=setTimeout(()=>child.kill(),120000);const exit=new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',code=>code===0?resolve():reject(Error('No se pudo extraer un archivo del mod.')))});const limit=new Transform({transform(chunk,enc,cb){size+=chunk.length;state.extracted+=chunk.length;if(size>max||state.extracted>512*1024*1024)cb(Error('El contenido supera el límite de seguridad.'));else cb(null,chunk);}});try{await Promise.all([pipeline(child.stdout,limit,out),exit]);}catch(e){child.kill();throw e}finally{clearTimeout(timer);}}
async function fileExists(p){try{await fs.lstat(p);return true}catch(e){if(e.code==='ENOENT')return false;throw e;}}
async function safeParents(root,parts){let current=root;const first=await fs.lstat(root);if(!first.isDirectory()||first.isSymbolicLink())throw Error('La carpeta del circuito no es válida; no se modificó.');for(const part of parts){current=path.join(current,part);try{await fs.mkdir(current)}catch(e){if(e.code!=='EEXIST')throw e;}const st=await fs.lstat(current);if(!st.isDirectory()||st.isSymbolicLink())throw Error('La carpeta del circuito contiene un enlace o archivo no admitido.');}}
export function createArchiveImporter({server,accessToken,runtime,fetchImpl=fetch,tar=path.join(process.env.SystemRoot||'C:/Windows','System32','tar.exe')}){
  let job=null;
  async function perform(fileId,kind,state){
    const root=path.resolve(runtime,'imports');await fs.mkdir(root,{recursive:true});const tmp=await fs.mkdtemp(path.join(root,'assetto-import-'));const file=path.join(tmp,'mod.bin');
    try{
      const token=await accessToken(),headers={Authorization:`Bearer ${token}`};state.phase='Consultando archivo en Drive…';
      const metaRes=await fetchImpl(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=name,size,capabilities(canDownload)&supportsAllDrives=true`,{headers,signal:AbortSignal.timeout(20000)});if(!metaRes.ok)throw Error('No se pudo consultar el archivo en Drive.');const meta=await metaRes.json(),size=Number(meta.size);
      if(!/\.(zip|rar|7z)$/i.test(meta.name||'')||!Number.isSafeInteger(size)||size<1||size>10*1024**3||meta.capabilities?.canDownload===false)throw Error('El archivo no se puede descargar o supera 10 GB.');
      const available=await fs.statfs(root).catch(()=>null);if(available&&Number(available.bavail)*Number(available.bsize)<size+1024**3)throw Error('No hay espacio suficiente para preparar el archivo temporal.');
      state.phase='Descargando desde Drive…';state.size=size;const response=await fetchImpl(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,{headers,signal:AbortSignal.timeout(3600000)});if(!response.ok||!response.body)throw Error('Drive no permitió descargar el archivo.');
      const count=new Transform({transform(chunk,enc,cb){state.downloaded+=chunk.length;if(state.downloaded>size||state.downloaded>10*1024**3)cb(Error('El archivo recibido supera el tamaño esperado.'));else cb(null,chunk);}});await pipeline(Readable.fromWeb(response.body),count,createWriteStream(file,{flags:'wx'}));if(state.downloaded!==size)throw Error('La descarga quedó incompleta.');
      state.phase='Revisando el contenido…';const listing=await runTar(tar,['-tf',file],{output:true,limit:32*1024*1024,timeout:300000});const plan=planArchive(listing.split(/\r?\n/).filter(Boolean),kind),results=[];let total=0;
      state.phase='Preparando contenido para el servidor…';state.total=plan.length;
      for(const item of plan){const parent=path.resolve(server,'content',kind),target=path.join(parent,item.id);await fs.mkdir(parent,{recursive:true});if(!await fileExists(target)){
        const stage=await fs.mkdtemp(path.join(parent,'.assetto-import-'));try{for(const f of item.files){if(++total>12000)throw Error('El paquete supera el límite de archivos.');await extractFile(tar,file,f.entry,path.join(stage,...f.relative.split('/')),state);}if(kind==='cars')for(const s of item.skins)await fs.mkdir(path.join(stage,'skins',s),{recursive:true});
        if(await fileExists(target))throw Error('El contenido ya existe: no se reemplazó.');await fs.rename(stage,target);}finally{const resolved=path.resolve(stage);if(path.dirname(resolved)!==parent||!path.basename(resolved).startsWith('.assetto-import-'))throw Error('Ruta temporal inválida.');await fs.rm(resolved,{recursive:true,force:true});}
      }else if(kind==='cars'&&!await fileExists(path.join(target,'data.acd'))){const stat=await fs.lstat(target);if(!stat.isDirectory()||stat.isSymbolicLink())throw Error('La carpeta del auto no es válida; no se modificó.');const tempData=path.join(tmp,`${item.id}.acd`);await extractFile(tar,file,item.files[0].entry,tempData,state);try{await fs.copyFile(tempData,path.join(target,'data.acd'),fs.constants.COPYFILE_EXCL)}catch(e){if(e.code!=='EEXIST')throw e;}for(const s of item.skins)await safeParents(target,['skins',s]);}
      else if(kind==='tracks'){const rootStat=await fs.lstat(target);if(!rootStat.isDirectory()||rootStat.isSymbolicLink())throw Error('La carpeta del circuito no es válida; no se modificó.');for(const f of item.files){if(++total>12000)throw Error('El paquete supera el límite de archivos.');const parts=f.relative.split('/'),destination=path.join(target,...parts);await safeParents(target,parts.slice(0,-1));if(await fileExists(destination)){if((await fs.lstat(destination)).isSymbolicLink())throw Error('El circuito contiene un enlace no admitido.');continue;}const temporary=path.join(tmp,'repair',item.id,...parts);await extractFile(tar,file,f.entry,temporary,state);try{await fs.copyFile(temporary,destination,fs.constants.COPYFILE_EXCL)}catch(e){if(e.code!=='EEXIST')throw e;}}}
      results.push({id:item.id,skins:item.skins||[],layouts:item.layouts||[]});state.done++;}
      state.items=results;state.phase='Contenido listo.';state.status='done';
    }finally{const resolved=path.resolve(tmp);if(path.dirname(resolved)!==root||!path.basename(resolved).startsWith('assetto-import-'))throw Error('Ruta temporal inválida.');await fs.rm(resolved,{recursive:true,force:true});}
  }
  return {start(fileId,kind){if(!/^[A-Za-z0-9_-]{10,150}$/.test(fileId||'')||!['cars','tracks'].includes(kind))throw Error('Mod inválido.');if(job?.status==='running')throw Error('Ya se está preparando otro mod.');job={status:'running',phase:'Preparando…',downloaded:0,size:0,extracted:0,done:0,total:0,items:[]};const current=job;void perform(fileId,kind,current).catch(e=>{current.status='error';current.phase=e.message||'No se pudo preparar el mod.'});return {...job};},status(){return job?{...job}:{status:'idle'};}};
}

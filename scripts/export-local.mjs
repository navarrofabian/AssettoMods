import {readFile,writeFile,mkdir,readdir,unlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const local=process.env.ASSETTO_LOCAL_DIR||path.resolve(root,'../assetto-library');
const target=path.join(root,'snapshot');
const media=path.join(target,'media');
await mkdir(media,{recursive:true});
const response=await fetch(process.env.ASSETTO_LOCAL_URL||'http://127.0.0.1:8765/api/state');
if(!response.ok)throw Error('No se pudo leer el catálogo local. Iniciá la biblioteca primero.');
const state=await response.json();
if(!Array.isArray(state.mods)||!state.covers)throw Error('El servidor no devolvió un catálogo válido.');
const fields=['id','name','displayName','category','group','subcategory','scope','country','tags','size','createdTime','modifiedTime','mimeType'];
const mods=state.mods.map(item=>Object.fromEntries(fields.filter(k=>item[k]!==undefined).map(k=>[k,item[k]])));
const ids=new Set(mods.map(x=>x.id));
const needed=new Map();
for(const [id,cover] of Object.entries(state.covers)){
 if(!ids.has(id)||cover.kind!=='manual')continue;
 for(const item of Array.isArray(cover.images)?cover.images:cover.url?[cover]:[]){
  if(typeof item.url==='string'&&/^\/portadas\/[\w-]+\.(?:png|jpg|jpeg|webp)$/i.test(item.url))needed.set(item.url,item);
 }
}
const tasks=[...needed.keys()], converted=new Map();let cursor=0,failed=0;
async function worker(){
 while(cursor<tasks.length){
  const index=cursor++,url=tasks[index];
  try{
   const input=await readFile(path.join(local,'data','portadas',path.basename(url)));
   if(input.length>5*1024*1024)throw Error('imagen mayor a 5 MB');
   const output=await sharp(input,{limitInputPixels:40000000}).rotate().resize({width:960,height:540,fit:'inside',withoutEnlargement:true}).webp({quality:78,effort:3}).toBuffer();
   const hash=createHash('sha256').update(output).digest('hex');const name=hash+'.webp';
   await writeFile(path.join(media,name),output,{flag:'w'});converted.set(url,'./media/'+name);
  }catch(e){failed++;console.error('No se pudo preparar una imagen:',path.basename(url),e.message);}
  if((index+1)%50===0)console.log('Imágenes revisadas:',index+1,'de',tasks.length);
 }
}
await Promise.all(Array.from({length:4},()=>worker()));
const covers={};
for(const [id,cover] of Object.entries(state.covers)){
 if(!ids.has(id)||cover.kind!=='manual')continue;
 const images=(Array.isArray(cover.images)?cover.images:cover.url?[cover]:[]).filter(x=>converted.has(x.url)).map(x=>({url:converted.get(x.url),version:x.version||1}));
 if(images.length)covers[id]={kind:'manual',url:images[0].url,version:images[0].version,images};
}
const exported={mods,covers,connected:true,status:{running:false,message:'Catálogo publicado',last:new Date().toISOString()},zipImport:{running:false,message:'Sin iniciar'}};
await writeFile(path.join(target,'catalogo.json'),JSON.stringify(exported,null,2)+'\n');
const keep=new Set([...converted.values()].map(x=>path.basename(x)));
for(const name of await readdir(media)){if(/^[a-f0-9]{64}\.webp$/.test(name)&&!keep.has(name))await unlink(path.join(media,name));}
console.log(`Catálogo preparado: ${mods.length} mods, ${converted.size} imágenes, ${failed} imágenes omitidas.`);

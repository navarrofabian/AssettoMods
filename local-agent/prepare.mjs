import fs from 'node:fs/promises';
import path from 'node:path';
import {generateServerFiles} from '../frontend/servers-core.mjs';

async function directory(p,label){try{if(!(await fs.stat(p)).isDirectory())throw Error();}catch{throw Error(`No se encontró ${label} en el contenido instalado del servidor.`);}}
export function mergeExtra(original,preset){
  let text=original||'# Opciones de AssettoServer\n';const ending=text.includes('\r\n')?'\r\n':'\n';
  for(const [key,value] of [['EnableServerDetails','true'],['EnableAi',String(preset.aiMode!=='none')]]){
    const re=new RegExp(`^${key}\\s*:[^\\r\\n]*`,'gm'),matches=[...text.matchAll(re)];
    if(matches.length>1)throw Error(`La opción ${key} está repetida en extra_cfg.yml.`);
    if(matches.length)text=text.replace(re,`${key}: ${value}`);else text+=(text.endsWith('\n')?'':ending)+`${key}: ${value}`+ending;
  }
  return text;
}
export async function preparePreset(serverDirectory,runtimeDirectory,preset,trackParameters={}){
  const output=generateServerFiles(preset);
  const content=path.join(serverDirectory,'content');
  await directory(path.join(content,'tracks',preset.trackId),'el circuito '+preset.trackId);
  if(preset.layout)await directory(path.join(content,'tracks',preset.trackId,preset.layout),'la variante '+preset.layout);
  for(const car of preset.cars)await directory(path.join(content,'cars',car.id),'el auto '+car.id);
  const cfgDir=path.join(serverDirectory,'cfg');let original='';
  try{const stat=await fs.lstat(path.join(cfgDir,'extra_cfg.yml'));if(!stat.isFile()||stat.size>2*1024*1024)throw Error('El archivo de opciones avanzadas no es válido.');original=await fs.readFile(path.join(cfgDir,'extra_cfg.yml'),'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
  const extra=mergeExtra(original,preset);
  await fs.mkdir(runtimeDirectory,{recursive:true});const outputDir=await fs.mkdtemp(path.join(runtimeDirectory,'servidor-'));
  for(const name of ['data_track_params.ini','csp_extra_options.ini'])try{const source=path.join(cfgDir,name),stat=await fs.lstat(source);if(stat.isFile()&&stat.size<=2*1024*1024)await fs.copyFile(source,path.join(outputDir,name));}catch(e){if(e.code!=='ENOENT')throw e;}
  const geo=trackParameters[preset.trackId];if(geo){const lat=Number(geo.latitude),lon=Number(geo.longitude),tz=String(geo.timezone||'');if(!Number.isFinite(lat)||Math.abs(lat)>90||!Number.isFinite(lon)||Math.abs(lon)>180||!/^[-A-Za-z0-9_+/]+$/.test(tz))throw Error('Coordenadas del circuito inválidas.');const target=path.join(outputDir,'data_track_params.ini');let text=await fs.readFile(target,'utf8').catch(e=>{if(e.code==='ENOENT')return '';throw e});if(!new RegExp(`^\\[${preset.trackId.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\]\\s*$`,'mi').test(text))await fs.writeFile(target,`${text}\n[${preset.trackId}]\nLATITUDE=${lat}\nLONGITUDE=${lon}\nTIMEZONE=${tz}\nNAME=${preset.trackId}\nHEADING_ANGLE=0\n`);}
  let files=[];try{files=await fs.readdir(cfgDir);}catch(e){if(e.code!=='ENOENT')throw e;}
  for(const name of files.filter(n=>/^plugin_[A-Za-z0-9_-]+_(?:cfg|config)\.yml$/i.test(n))){const source=path.join(cfgDir,name),stat=await fs.lstat(source);if(stat.isFile()&&stat.size<=2*1024*1024)await fs.copyFile(source,path.join(outputDir,name));}
  await fs.mkdir(path.join(outputDir,'cm_content'));
  await fs.writeFile(path.join(outputDir,'server_cfg.ini'),output.files['server_cfg.ini']);
  await fs.writeFile(path.join(outputDir,'entry_list.ini'),output.files['entry_list.ini']);
  await fs.writeFile(path.join(outputDir,'extra_cfg.yml'),extra);
  await fs.writeFile(path.join(outputDir,'cm_content','content.json'),output.files['content.json']);
  const workingDirectory=path.join(outputDir,'work');await fs.mkdir(path.join(workingDirectory,'cfg'),{recursive:true});
  try{await fs.copyFile(path.join(outputDir,'data_track_params.ini'),path.join(workingDirectory,'cfg','data_track_params.ini'));}catch(e){if(e.code!=='ENOENT')throw e;}
  for(const name of ['content','system','wwwroot','plugins'])try{const source=path.join(serverDirectory,name);if((await fs.stat(source)).isDirectory())await fs.symlink(path.resolve(source),path.join(workingDirectory,name),process.platform==='win32'?'junction':'dir');}catch(e){if(e.code!=='ENOENT')throw e;}
  for(const name of ['whitelist.txt','admin_whitelist.txt','blacklist.txt'])try{const source=path.join(serverDirectory,name);if((await fs.lstat(source)).isFile())await fs.copyFile(source,path.join(workingDirectory,name));}catch(e){if(e.code!=='ENOENT')throw e;}
  return {directory:outputDir,workingDirectory,warnings:output.warnings};
}

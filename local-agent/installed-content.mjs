import {readdir,stat} from 'node:fs/promises';
import path from 'node:path';
const valid=/^[A-Za-z0-9_][A-Za-z0-9_.-]{0,99}$/;
async function dirs(p){try{return (await readdir(p,{withFileTypes:true})).filter(x=>x.isDirectory()&&valid.test(x.name)).slice(0,5000).map(x=>x.name).sort((a,b)=>a.localeCompare(b));}catch(e){if(e.code==='ENOENT'||e.code==='ENOTDIR')return [];throw e;}}
async function exists(p){try{return (await stat(p)).isFile();}catch(e){if(e.code==='ENOENT'||e.code==='ENOTDIR')return false;throw e;}}
export async function getInstalledContent(server,game){
  const cars=await dirs(path.join(server,'content','cars')),tracks=await dirs(path.join(server,'content','tracks'));
  const skins={},layouts={};
  for(const id of cars){const a=await dirs(path.join(server,'content','cars',id,'skins'));const b=game?await dirs(path.join(game,'content','cars',id,'skins')):[];skins[id]=[...new Set([...a,...b])].sort((a,b)=>a.localeCompare(b));}
  for(const id of tracks){const root=path.join(server,'content','tracks',id);layouts[id]=[];for(const name of await dirs(root)){if(await exists(path.join(root,name,'data','surfaces.ini'))||await exists(path.join(root,name,'ai','fast_lane.ai'))||await exists(path.join(root,name,'ai','fast_lane.aip')))layouts[id].push(name);}}
  return {cars,tracks,skins,layouts};
}

import {readdir,stat} from 'node:fs/promises';
import path from 'node:path';
const valid=/^[A-Za-z0-9_][A-Za-z0-9_.-]{0,99}$/;
async function dirs(p,pattern=valid){try{return (await readdir(p,{withFileTypes:true})).filter(x=>x.isDirectory()&&pattern.test(x.name)&&x.name!=='.'&&x.name!=='..').slice(0,5000).map(x=>x.name).sort((a,b)=>a.localeCompare(b));}catch(e){if(e.code==='ENOENT'||e.code==='ENOTDIR')return [];throw e;}}
async function exists(p){try{return (await stat(p)).isFile();}catch(e){if(e.code==='ENOENT'||e.code==='ENOTDIR')return false;throw e;}}
export async function getInstalledContent(server,game){
  const serverCars=await dirs(path.join(server,'content','cars')),serverTracks=await dirs(path.join(server,'content','tracks'));
  const gameCars=game?await dirs(path.join(game,'content','cars')):[],gameTracks=game?await dirs(path.join(game,'content','tracks')):[];
  const cars=[...new Set([...serverCars,...gameCars])].sort((a,b)=>a.localeCompare(b)),tracks=[...new Set([...serverTracks,...gameTracks])].sort((a,b)=>a.localeCompare(b));
  const skins={},layouts={};
  async function batches(items,fn){for(let i=0;i<items.length;i+=24)await Promise.all(items.slice(i,i+24).map(fn));}
  const skinPattern=/^[\p{L}\p{M}\p{N}# _.,-]{1,100}$/u;
  await batches(cars,async id=>{const a=await dirs(path.join(server,'content','cars',id,'skins'),skinPattern);const b=game?await dirs(path.join(game,'content','cars',id,'skins'),skinPattern):[];skins[id]=[...new Set([...a,...b])].sort((a,b)=>a.localeCompare(b));});
  await batches(tracks,async id=>{const roots=[path.join(server,'content','tracks',id),...(game?[path.join(game,'content','tracks',id)]:[])],found=new Set();for(const root of roots)for(const name of await dirs(root))if(await exists(path.join(root,name,'data','surfaces.ini'))||await exists(path.join(root,name,'ai','fast_lane.ai'))||await exists(path.join(root,name,'ai','fast_lane.aip')))found.add(name);layouts[id]=[...found].sort((a,b)=>a.localeCompare(b));});
  return {cars,tracks,skins,layouts,serverCars,serverTracks};
}

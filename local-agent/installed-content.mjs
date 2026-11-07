import {readdir,lstat} from 'node:fs/promises';
import path from 'node:path';
const valid=/^[A-Za-z0-9_][A-Za-z0-9_.-]{0,99}$/;
async function dirs(p,pattern=valid){try{return (await readdir(p,{withFileTypes:true})).filter(x=>x.isDirectory()&&pattern.test(x.name)&&x.name!=='.'&&x.name!=='..').slice(0,5000).map(x=>x.name).sort((a,b)=>a.localeCompare(b));}catch(e){if(e.code==='ENOENT'||e.code==='ENOTDIR')return [];throw e;}}
async function exists(p){try{return (await lstat(p)).isFile();}catch(e){if(e.code==='ENOENT'||e.code==='ENOTDIR')return false;throw e;}}
export async function getInstalledContent(server,game){
  const serverDirs=await dirs(path.join(server,'content','cars')),serverTrackDirs=await dirs(path.join(server,'content','tracks'));
  const gameDirs=game?await dirs(path.join(game,'content','cars')):[],gameTrackDirs=game?await dirs(path.join(game,'content','tracks')):[];
  const check=async(root,items)=>{const found=[];for(let i=0;i<items.length;i+=24)await Promise.all(items.slice(i,i+24).map(async id=>{if(await exists(path.join(root,'content','cars',id,'data.acd')))found.push(id)}));return found.sort((a,b)=>a.localeCompare(b));};
  const serverCars=await check(server,serverDirs),gameCars=game?await check(game,gameDirs):[];
  const cars=[...new Set([...serverCars,...gameCars])].sort((a,b)=>a.localeCompare(b)),trackCandidates=[...new Set([...serverTrackDirs,...gameTrackDirs])].sort((a,b)=>a.localeCompare(b)),serverTracks=[],gameTracks=[];
  const skins={},layouts={},defaultTracks=[];
  async function batches(items,fn){for(let i=0;i<items.length;i+=24)await Promise.all(items.slice(i,i+24).map(fn));}
  const skinPattern=/^[\p{L}\p{M}\p{N}# _.,-]{1,100}$/u;
  await batches(cars,async id=>{const a=await dirs(path.join(server,'content','cars',id,'skins'),skinPattern);const b=game?await dirs(path.join(game,'content','cars',id,'skins'),skinPattern):[];skins[id]=[...new Set([...a,...b])].sort((a,b)=>a.localeCompare(b));});
  await batches(trackCandidates,async id=>{const roots=[{base:server,list:serverTracks},...(game?[{base:game,list:gameTracks}]:[])],found=new Set();let rootAvailable=false;for(const {base,list} of roots){const root=path.join(base,'content','tracks',id),hasDefault=await exists(path.join(root,'data','surfaces.ini'));let ready=hasDefault;rootAvailable||=hasDefault;for(const name of await dirs(root))if(await exists(path.join(root,name,'data','surfaces.ini'))){found.add(name);ready=true;}if(ready)list.push(id);}if(rootAvailable)defaultTracks.push(id);layouts[id]=[...found].sort((a,b)=>a.localeCompare(b));});
  const tracks=[...new Set([...serverTracks,...gameTracks])].sort((a,b)=>a.localeCompare(b));serverTracks.sort((a,b)=>a.localeCompare(b));gameTracks.sort((a,b)=>a.localeCompare(b));
  return {cars,tracks,skins,layouts,serverCars,serverTracks,defaultTracks};
}

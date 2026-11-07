import fs from 'node:fs/promises';
import path from 'node:path';
import {inflateRawSync} from 'node:zlib';
import {find as findTimezones} from 'geo-tz';

const validId=/^[A-Za-z0-9_][A-Za-z0-9_.-]{0,99}$/;
export function coordinate(value,axis){
  if(typeof value==='number')return Number.isFinite(value)&&Math.abs(value)<=(axis==='lat'?90:180)?value:null;
  if(typeof value!=='string')return null;const s=value.trim().toUpperCase();if(!s||s.length>80)return null;
  const directions=[...s.matchAll(/[NSEWO]/g)].map(x=>x[0]);if(directions.length>1)return null;const direction=directions[0]||'';if(direction&&!(axis==='lat'?['N','S']:['E','W','O']).includes(direction))return null;
  const body=s.replace(/[NSEWO]/g,'').replace(/[°º'′’"″\s]/g,' ').trim();if(!/^[+-]?\d+(?:\.\d+)?(?:\s+\d+(?:\.\d+)?){0,2}$/.test(body))return null;
  const nums=body.split(/\s+/).map(Number),degrees=nums[0],minutes=nums[1]||0,seconds=nums[2]||0;if(minutes>=60||seconds>=60)return null;
  const negative=degrees<0||direction==='S'||direction==='W'||direction==='O';if(degrees<0&&['N','E'].includes(direction))return null;
  const result=(Math.abs(degrees)+minutes/60+seconds/3600)*(negative?-1:1);return Math.abs(result)<=(axis==='lat'?90:180)?result:null;
}
export function locationFromMetadata(data,lookup=findTimezones){
  if(!data||typeof data!=='object'||!Array.isArray(data.geotags)||data.geotags.length<2)return null;
  const latitude=coordinate(data.geotags[0],'lat'),longitude=coordinate(data.geotags[1],'lon');if(latitude===null||longitude===null||(latitude===0&&longitude===0))return null;
  try{const zones=lookup(latitude,longitude);if(!Array.isArray(zones)||zones.length!==1||!/^[-A-Za-z0-9_+/]+$/.test(zones[0]))return null;new Intl.DateTimeFormat('en',{timeZone:zones[0]});return {latitude,longitude,timezone:zones[0]};}catch{return null;}
}
export function sectionLocation(text,id){
  if(!validId.test(id||''))return null;const lines=String(text||'').split(/\r?\n/);let inSection=false,fields={};
  for(const raw of lines){const line=raw.trim(),section=/^\[([^\]]+)\]/.exec(line);if(section){if(inSection)break;inSection=section[1].toLowerCase()===id.toLowerCase();continue;}if(inSection){const m=/^(LATITUDE|LONGITUDE|TIMEZONE)\s*=\s*([^;#]*)/i.exec(line);if(m)fields[m[1].toLowerCase()]=m[2].trim();}}
  if(!fields.latitude||!fields.longitude||!fields.timezone)return null;const latitude=Number(fields.latitude),longitude=Number(fields.longitude),timezone=fields.timezone;if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180||!/^[-A-Za-z0-9_+/]+$/.test(timezone))return null;try{new Intl.DateTimeFormat('en',{timeZone:timezone});return {latitude,longitude,timezone}}catch{return null;}
}
async function localMetadata(root,id,layout){if(!root)return null;const dir=path.join(root,'content','tracks',id);for(const rel of [layout?path.join('ui',layout,'ui_track.json'):'',path.join('ui','ui_track.json'),layout?path.join(layout,'ui','ui_track.json'):''].filter(Boolean)){try{const file=path.join(dir,rel),s=await fs.lstat(file);if(!s.isFile()||s.size>1024*1024)continue;const value=JSON.parse((await fs.readFile(file,'utf8')).replace(/^\uFEFF/,'')),result=locationFromMetadata(value);if(result)return result;}catch{}}return null;}
function crc32(buffer){let crc=0xffffffff;for(const byte of buffer){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
export async function archiveMetadata({fileId,trackId,layout,accessToken,fetchImpl=fetch}){
  if(!accessToken||!/^[A-Za-z0-9_-]{10,150}$/.test(fileId||'')||!validId.test(trackId||'')||(layout&&!validId.test(layout)))return null;
  try{
    const token=await accessToken(),headers={Authorization:`Bearer ${token}`},base=`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`;
    const meta=await fetchImpl(`${base}?fields=name,size`,{headers,signal:AbortSignal.timeout(10000)});if(!meta.ok)return null;const file=await meta.json(),size=Number(file.size);if(!/\.zip$/i.test(file.name||'')||!Number.isSafeInteger(size)||size<22)return null;
    async function range(a,b){if(a<0||b<a||b>=size||b-a+1>8*1024*1024)throw Error('Rango inválido');const r=await fetchImpl(`${base}?alt=media&supportsAllDrives=true`,{headers:{...headers,Range:`bytes=${a}-${b}`},signal:AbortSignal.timeout(15000)});if(r.status!==206||r.headers.get('content-range')!==`bytes ${a}-${b}/${size}`)throw Error('Lectura parcial no disponible');const bytes=Buffer.from(await r.arrayBuffer());if(bytes.length!==b-a+1)throw Error('Lectura incompleta');return bytes;}
    const start=Math.max(0,size-65557),tail=await range(start,size-1);let end=-1;for(let i=tail.length-22;i>=0;i--)if(tail.readUInt32LE(i)===0x06054b50&&i+22+tail.readUInt16LE(i+20)===tail.length){end=i;break;}if(end<0)return null;
    const entries=tail.readUInt16LE(end+10),length=tail.readUInt32LE(end+12),offset=tail.readUInt32LE(end+16);if(tail.readUInt16LE(end+4)||tail.readUInt16LE(end+6)||entries===0xffff||length===0xffffffff||offset===0xffffffff||!length||length>8*1024*1024||offset+length>start+end)return null;
    const index=await range(offset,offset+length-1),candidates=[];for(let p=0,i=0;i<entries;i++){if(p+46>index.length||index.readUInt32LE(p)!==0x02014b50)return null;const flags=index.readUInt16LE(p+8),method=index.readUInt16LE(p+10),crc=index.readUInt32LE(p+16),compressed=index.readUInt32LE(p+20),expanded=index.readUInt32LE(p+24),a=index.readUInt16LE(p+28),b=index.readUInt16LE(p+30),c=index.readUInt16LE(p+32),local=index.readUInt32LE(p+42),endEntry=p+46+a+b+c;if(endEntry>index.length)return null;const name=index.subarray(p+46,p+46+a).toString('utf8').replace(/\\/g,'/'),parts=name.split('/');const indexOfTrack=parts.findIndex(x=>x.toLowerCase()===trackId.toLowerCase());if(indexOfTrack>=0&&!parts.includes('..')&&!name.startsWith('/')&&parts.at(-1)?.toLowerCase()==='ui_track.json'&&!(flags&1)&&[0,8].includes(method)&&compressed>0&&compressed<=1024*1024&&expanded>0&&expanded<=1024*1024&&local!==0xffffffff){const suffix=parts.slice(indexOfTrack+1).map(x=>x.toLowerCase()).join('/');if(suffix==='ui/ui_track.json'||(layout&&suffix===`ui/${layout.toLowerCase()}/ui_track.json`))candidates.push({local,compressed,expanded,method,crc,rank:suffix==='ui/ui_track.json'?1:0});}p=endEntry;}
    candidates.sort((a,b)=>a.rank-b.rank);for(const e of candidates.slice(0,4)){const h=await range(e.local,e.local+29);if(h.readUInt32LE(0)!==0x04034b50)continue;const begin=e.local+30+h.readUInt16LE(26)+h.readUInt16LE(28),raw=await range(begin,begin+e.compressed-1),bytes=e.method===8?inflateRawSync(raw,{maxOutputLength:1024*1024}):raw;if(bytes.length!==e.expanded||crc32(bytes)!==e.crc)continue;try{const result=locationFromMetadata(JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,'')));if(result)return result}catch{}}
  }catch{}return null;
}
let officialCache=null,officialTime=0;
async function officialLocation(id,fetchImpl){try{if(!officialCache||Date.now()-officialTime>24*60*60*1000){const r=await fetchImpl('https://raw.githubusercontent.com/ac-custom-shaders-patch/acc-extension-config/master/config/data_track_params.ini',{signal:AbortSignal.timeout(6000)});if(!r.ok)return null;const text=await r.text();if(text.length>2*1024*1024)return null;officialCache=text;officialTime=Date.now();}return sectionLocation(officialCache,id);}catch{return null;}}
export async function resolveTrackLocation({serverDirectory,gameDirectory,trackId,layout,trackParameters={},originalParams='',fileId,accessToken,fetchImpl=fetch}){
  if(!validId.test(trackId||'')||(layout&&!validId.test(layout)))return null;
  const configured=trackParameters[trackId];if(configured)return {location:configured,source:'configuración local'};
  const existing=sectionLocation(originalParams,trackId);if(existing)return {location:existing,source:'AssettoServer'};
  for(const root of [serverDirectory,gameDirectory]){const location=await localMetadata(root,trackId,layout);if(location)return {location,source:'metadatos del circuito'};}
  const official=await officialLocation(trackId,fetchImpl);if(official)return {location:official,source:'lista de Custom Shaders Patch'};
  const archive=await archiveMetadata({fileId,trackId,layout,accessToken,fetchImpl});if(archive)return {location:archive,source:'metadatos del archivo de Drive'};
  const known={apvs_parana:{latitude:-31.763056,longitude:-60.376944,timezone:'America/Argentina/Buenos_Aires'}};if(known[trackId])return {location:known[trackId],source:'ubicación verificada'};
  return {location:{latitude:-34.6037,longitude:-58.3816,timezone:'America/Argentina/Buenos_Aires'},source:'ubicación predeterminada de Buenos Aires',fallback:true};
}
export function allowMissingTrackLocation(original){
  let text=original||'',eol=text.includes('\r\n')?'\r\n':'\n';const lines=text.split(/\r?\n/),matches=[];for(let i=0;i<lines.length;i++)if(/^IgnoreConfigurationErrors\s*:/.test(lines[i]))matches.push(i);if(matches.length>1)throw Error('La opción IgnoreConfigurationErrors está repetida.');
  if(!matches.length)return text+(text&&!text.endsWith('\n')?eol:'')+`IgnoreConfigurationErrors:${eol}  MissingTrackParams: true${eol}`;
  const start=matches[0],line=lines[start];if(!/^IgnoreConfigurationErrors\s*:\s*(?:#.*)?$/.test(line))throw Error('No se puede ajustar automáticamente la configuración de ubicación existente.');let end=start+1;while(end<lines.length&&(!lines[end].trim()||/^\s/.test(lines[end])||/^\s*#/.test(lines[end])))end++;const found=[];for(let i=start+1;i<end;i++)if(/^\s+MissingTrackParams\s*:/.test(lines[i]))found.push(i);if(found.length>1)throw Error('La opción MissingTrackParams está repetida.');if(found.length)lines[found[0]]=lines[found[0]].replace(/^(\s+)MissingTrackParams\s*:.*/, '$1MissingTrackParams: true');else lines.splice(start+1,0,'  MissingTrackParams: true');return lines.join(eol);
}

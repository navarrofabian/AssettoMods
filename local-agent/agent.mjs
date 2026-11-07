import http from 'node:http';
import {spawn} from 'node:child_process';
import {readFile,realpath,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {verifyFirebaseToken} from './auth.mjs';
import {preparePreset} from './prepare.mjs';
const local=path.dirname(fileURLToPath(import.meta.url));
const config=JSON.parse(await readFile(path.join(local,'agent-config.json'),'utf8').catch(()=>{throw Error('Falta local-agent/agent-config.json. Consultá SERVIDORES.md.')}));
if(!path.isAbsolute(config.serverDirectory||'')||!['AssettoServer.exe','acServer.exe'].includes(config.executable))throw Error('Configurá una carpeta absoluta y un ejecutable admitido.');
const dir=await realpath(config.serverDirectory),executable=await realpath(path.join(dir,config.executable));
if(path.dirname(executable).toLowerCase()!==dir.toLowerCase())throw Error('El ejecutable debe estar dentro de la carpeta configurada.');
const port=Number(config.serverHttpPort||8081);if(!Number.isInteger(port)||port<1||port>65535)throw Error('Puerto HTTP inválido.');
const origin='https://navarrofabian.github.io',keysUrl='https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
let processHandle=null,certs=null,expires=0,busy=false,activePort=port;
async function authorize(req){const match=/^Bearer ([A-Za-z0-9_.-]+)$/.exec(req.headers.authorization||'');if(!match)throw Error('Falta iniciar sesión');if(!certs||Date.now()>expires){const r=await fetch(keysUrl,{signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('No se pudo verificar Google');certs=await r.json();expires=Date.now()+3600000;}return verifyFirebaseToken(match[1],certs);}
async function start(prepared,preset){if(processHandle)throw Error('El servidor ya está iniciado por este agente.');activePort=Number(preset.httpPort);let child=spawn(executable,['-c',path.join(prepared.directory,'server_cfg.ini'),'-e',path.join(prepared.directory,'entry_list.ini')],{cwd:dir,stdio:'ignore',windowsHide:true});processHandle=child;child.once('exit',()=>{if(processHandle===child)processHandle=null});await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject)}).catch(e=>{if(processHandle===child)processHandle=null;throw e});}
async function stop(){if(!processHandle)throw Error('No hay un servidor iniciado por este agente.');const child=processHandle;await new Promise((resolve,reject)=>{let timer=setTimeout(()=>reject(Error('El servidor no se detuvo.')),5000);child.once('exit',()=>{clearTimeout(timer);resolve()});if(!child.kill()){clearTimeout(timer);reject(Error('No se pudo detener el servidor.'));}});}
async function status(){let players=[];if(processHandle)try{let r=await fetch(`http://127.0.0.1:${activePort}/JSON0`,{signal:AbortSignal.timeout(1500)});if(r.ok){let data=await r.json();players=(data.Cars||[]).filter(c=>c.IsConnected).map(c=>String(c.DriverName||'Jugador').slice(0,80));}}catch{}return {running:!!processHandle,players};}
async function installedContent(){const list=async sub=>{try{return (await readdir(path.join(dir,'content',sub),{withFileTypes:true})).filter(x=>x.isDirectory()&&/^[A-Za-z0-9_][A-Za-z0-9_.-]{0,99}$/.test(x.name)).slice(0,5000).map(x=>x.name);}catch{return [];}};return {cars:await list('cars'),tracks:await list('tracks')};}
async function checkDrive(id){
  if(!/^[A-Za-z0-9_-]{10,150}$/.test(id||''))throw Error('Identificador de Drive inválido.');
  let target=new URL('https://drive.google.com/uc?export=download&id='+encodeURIComponent(id));
  for(let n=0;n<5;n++){
    if(target.protocol!=='https:'||!/(^|\.)(google\.com|googleusercontent\.com)$/.test(target.hostname))throw Error('La descarga se redirigió a un dominio no admitido.');
    const r=await fetch(target,{headers:{Range:'bytes=0-0'},redirect:'manual',signal:AbortSignal.timeout(12000)});
    if(r.status>=300&&r.status<400&&r.headers.get('location')){await r.body?.cancel();target=new URL(r.headers.get('location'),target);continue;}
    const type=(r.headers.get('content-type')||'').toLowerCase(),disposition=(r.headers.get('content-disposition')||'').toLowerCase();await r.body?.cancel();
    return {direct:r.ok&&!type.includes('text/html')&&(disposition.includes('attachment')||/application\/(octet-stream|zip|x-zip-compressed|x-rar-compressed|vnd\.rar|x-7z-compressed)/.test(type)),status:r.status};
  }
  throw Error('Demasiadas redirecciones al comprobar el enlace.');
}
function json(res,code,data){res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Private-Network':'true'});res.end(JSON.stringify(data));}
async function readPreset(req){let chunks=[],size=0;for await(const chunk of req){size+=chunk.length;if(size>120000)throw Error('Configuración demasiado grande.');chunks.push(chunk);}try{let data=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!data.preset||typeof data.preset!=='object'||Array.isArray(data.preset))throw Error();return data.preset;}catch{throw Error('Configuración inválida.');}}
http.createServer(async(req,res)=>{
  if(req.headers.origin!==origin||req.headers.host!=='127.0.0.1:8876')return json(res,403,{error:'Origen no permitido'});
  if(req.method==='OPTIONS')return json(res,204,{});
  try{await authorize(req);const requestUrl=new URL(req.url,'http://127.0.0.1:8876');if(requestUrl.pathname==='/status'&&req.method==='GET')return json(res,200,await status());
    if(requestUrl.pathname==='/content'&&req.method==='GET')return json(res,200,await installedContent());
    if(requestUrl.pathname==='/check-drive'&&req.method==='GET')return json(res,200,await checkDrive(requestUrl.searchParams.get('id')));
    if(req.method!=='POST'||!['/start','/stop','/restart'].includes(req.url))return json(res,404,{error:'No encontrado'});
    if(busy)return json(res,409,{error:'Hay una operación en curso.'});busy=true;
    try{if(req.url==='/stop'){await stop();return json(res,200,await status());}if(req.url==='/start'&&processHandle)throw Error('El servidor ya está iniciado por este agente.');const preset=await readPreset(req);const prepared=await preparePreset(dir,path.join(local,'runtime'),preset);if(req.url==='/restart'&&processHandle)await stop();await start(prepared,preset);return json(res,200,{...await status(),message:prepared.warnings.join(' ')});}finally{busy=false;}
  }catch(e){return json(res,/Token|Firma|Cuenta|sesión|Google/.test(e.message)?401:400,{error:e.message});}
}).listen(8876,'127.0.0.1',()=>console.log('Agente disponible en 127.0.0.1:8876; solo acepta administradores verificados.'));

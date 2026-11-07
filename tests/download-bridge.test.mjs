import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createDownloadBridge} from '../local-agent/download-bridge.mjs';

test('enlaces temporales rechazan alteraciones y vencen',()=>{
 let time=1700000000000;const b=createDownloadBridge({accessToken:async()=>'',now:()=>time,secret:Buffer.alloc(32,2)});
 const link=b.issue('AbCdEf0123456789',60);assert.equal(b.verify(link),'AbCdEf0123456789');assert.equal(b.verify(link+'x'),null);
 time+=60000;assert.equal(b.verify(link),null);assert.throws(()=>b.issue('otro/archivo'));
 assert.equal(createDownloadBridge({accessToken:async()=>'',secret:Buffer.alloc(32,3)}).verify(link),null);
});

test('descarga solo con enlace válido y transmite rangos sin divulgar credenciales',async()=>{
 let called=0;const b=createDownloadBridge({accessToken:async()=>'token-secreto',fetchImpl:async(url,options)=>{called++;assert.equal(options.headers.authorization,'Bearer token-secreto');if(url.includes('fields='))return Response.json({name:'mod.zip',capabilities:{canDownload:true}});assert.match(url,/alt=media/);assert.equal(options.headers.Range,'bytes=0-2');return new Response('zip',{status:206,headers:{'content-type':'application/zip','content-range':'bytes 0-2/10','content-length':'3'}})}});
 const server=http.createServer(b.handle);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{const base=`http://127.0.0.1:${server.address().port}/descarga/`;const bad=await fetch(base+'invalido');assert.equal(bad.status,404);assert.equal(called,0);
 const good=await fetch(base+b.issue('AbCdEf0123456789'),{headers:{Range:'bytes=0-2'}});assert.equal(good.status,206);assert.equal(await good.text(),'zip');assert.equal(good.headers.get('content-range'),'bytes 0-2/10');assert.match(good.headers.get('content-disposition'),/mod.zip/);assert.equal(good.headers.get('authorization'),null);assert.equal(called,2);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

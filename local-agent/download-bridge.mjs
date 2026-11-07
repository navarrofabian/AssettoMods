import {createHmac, randomBytes, timingSafeEqual} from 'node:crypto';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';

// La clave vive solo en memoria: reiniciar el agente invalida todos los enlaces.
export function createDownloadBridge({accessToken, fetchImpl=fetch, now=Date.now, secret=randomBytes(32)}) {
  const sign=s=>createHmac('sha256',secret).update(s).digest('base64url');
  let active=0;
  function issue(id,ttlSeconds=86400) {
    if(!/^[A-Za-z0-9_-]{10,150}$/.test(id)) throw Error('Archivo de Drive inválido.');
    if(!Number.isInteger(ttlSeconds)||ttlSeconds<60||ttlSeconds>86400) throw Error('Duración inválida.');
    const payload=Buffer.from(JSON.stringify({id,exp:Math.floor(now()/1000)+ttlSeconds})).toString('base64url');
    return `${payload}.${sign(payload)}`;
  }
  function verify(token) {
    if(typeof token!=='string'||token.length>1024) return null;
    const parts=token.split('.');if(parts.length!==2)return null;
    const expected=Buffer.from(sign(parts[0]));const actual=Buffer.from(parts[1]);
    if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return null;
    try{const p=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'));return /^[A-Za-z0-9_-]{10,150}$/.test(p.id)&&Number.isInteger(p.exp)&&p.exp>Math.floor(now()/1000)?p.id:null;}catch{return null;}
  }
  async function handle(req,res){
    const fail=(status,message)=>{if(!res.headersSent){res.writeHead(status,{'content-type':'text/plain; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(message)}else res.destroy();};
    let counted=false,timer;try{
      if(!['GET','HEAD'].includes(req.method))return fail(405,'Método no permitido');
      const match=/^\/descarga\/([A-Za-z0-9_.-]+)$/.exec(new URL(req.url,'http://localhost').pathname);
      const id=match&&verify(match[1]);if(!id)return fail(404,'Enlace inválido o vencido');
      if(active>=2)return fail(429,'Hay demasiadas descargas simultáneas');active++;counted=true;
      const range=req.headers.range;if(range&&!/^bytes=\d*-\d*$/.test(range))return fail(416,'Rango inválido');
      const headers={authorization:`Bearer ${await accessToken()}`};if(range)headers.Range=range;
      const controller=new AbortController();timer=setTimeout(()=>controller.abort(),30000);
      res.once('close',()=>controller.abort());
      const metadata=await fetchImpl(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=name%2Ccapabilities(canDownload)&supportsAllDrives=true`,{headers:{authorization:headers.authorization},redirect:'error',signal:controller.signal});
      if(!metadata.ok){clearTimeout(timer);await metadata.body?.cancel();return fail(metadata.status===404?404:502,'No se pudo consultar el archivo en Drive');}
      const info=await metadata.json(),filename=String(info.name||'').replace(/[\r\n\0/\\]/g,'_');
      if(!/\.(zip|rar|7z)$/i.test(filename)||info.capabilities?.canDownload===false){clearTimeout(timer);return fail(403,'El archivo no está disponible para descargar');}
      let upstream;try{upstream=await fetchImpl(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media&supportsAllDrives=true`,{headers,redirect:'error',signal:controller.signal});}finally{clearTimeout(timer);}
      if(!upstream.ok){await upstream.body?.cancel();return fail(upstream.status===404?404:502,'No se pudo descargar el archivo desde Drive');}
      const out={'content-type':upstream.headers.get('content-type')||'application/octet-stream','content-disposition':`attachment; filename="download.${filename.split('.').pop().toLowerCase()}"; filename*=UTF-8''${encodeURIComponent(filename).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase())}`,'cache-control':'private, no-store','x-content-type-options':'nosniff'};
      for(const h of ['content-length','content-range','accept-ranges','etag','last-modified']){const v=upstream.headers.get(h);if(v)out[h]=v;}
      res.writeHead(upstream.status,out);if(req.method==='HEAD'||!upstream.body){await upstream.body?.cancel();return res.end();}
      await pipeline(Readable.fromWeb(upstream.body),res);
    }catch{fail(502,'No se pudo descargar el archivo desde Drive');}finally{clearTimeout(timer);if(counted)active--;}
  }
  return {issue,verify,handle};
}

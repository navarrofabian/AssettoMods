import {readFile} from 'node:fs/promises';

export function createDriveAuth({credentialsPath,tokenPath,fetchImpl=fetch,now=Date.now}) {
  let cached='',expires=0,inflight=null;
  return async function accessToken(){
    if(cached&&expires>now()+60000)return cached;
    if(inflight)return inflight;
    inflight=(async()=>{
      const [credentials,token]=await Promise.all([readFile(credentialsPath,'utf8').then(JSON.parse),readFile(tokenPath,'utf8').then(JSON.parse)]);
      const app=credentials.web||credentials.installed;
      if(!app?.client_id||!app?.client_secret||!token.refresh_token)throw Error('Falta la autorización local de Google Drive.');
      const response=await fetchImpl('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:app.client_id,client_secret:app.client_secret,refresh_token:token.refresh_token,grant_type:'refresh_token'}),signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw Error('Google rechazó la autorización de Drive.');
      const data=await response.json();if(!data.access_token||!Number.isFinite(Number(data.expires_in)))throw Error('Respuesta de Google inválida.');
      cached=data.access_token;expires=now()+Number(data.expires_in)*1000;return cached;
    })();
    try{return await inflight;}finally{inflight=null;}
  };
}

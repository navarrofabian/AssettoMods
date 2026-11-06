import fs from 'node:fs/promises';
import { mergeCatalog } from './catalog.mjs';

const names = ['GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','GOOGLE_REFRESH_TOKEN','DRIVE_ROOT_ID'];
const values = names.map(n => process.env[n]);
if (values.every(v => !v)) { console.log('Sin secretos de Drive: se publicará la copia guardada.'); process.exit(0); }
if (values.some(v => !v)) throw new Error('Faltan secretos de Drive; se canceló la actualización.');
const [clientId, clientSecret, refreshToken, root] = values;
if (!/^[\w-]+$/.test(root)) throw new Error('ID de carpeta raíz inválido.');
const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {method:'POST', headers:{'content-type':'application/x-www-form-urlencoded'}, body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,refresh_token:refreshToken,grant_type:'refresh_token'})});
if (!tokenResponse.ok) throw new Error(`Google rechazó la autorización (HTTP ${tokenResponse.status}). Revisá los secretos y permisos.`);
const {access_token} = await tokenResponse.json();
if (!access_token) throw new Error('Google no devolvió un token de acceso.');
const folders = [{id:root,path:''}], seen = new Set(), files = [];
while (folders.length) {
  const folder = folders.shift();
  if (seen.has(folder.id)) continue;
  seen.add(folder.id);
  let pageToken;
  do {
    const params = new URLSearchParams({q:`'${folder.id}' in parents and trashed = false`,fields:'nextPageToken,files(id,name,mimeType,size,modifiedTime)',pageSize:'1000',supportsAllDrives:'true',includeItemsFromAllDrives:'true'});
    if (pageToken) params.set('pageToken',pageToken);
    const response = await fetch('https://www.googleapis.com/drive/v3/files?'+params, {headers:{authorization:`Bearer ${access_token}`}});
    if (!response.ok) throw new Error(`No se pudo leer Drive (HTTP ${response.status}); se conserva la página anterior.`);
    const result = await response.json();
    for (const f of result.files || []) {
      if (f.mimeType === 'application/vnd.google-apps.folder') folders.push({id:f.id,path:folder.path+'/'+f.name});
      else if (/\.(zip|rar|7z)$/i.test(f.name)) files.push({...f,path:folder.path});
    }
    pageToken = result.nextPageToken;
  } while (pageToken);
}
const snapshot = JSON.parse(await fs.readFile('snapshot/catalogo.json','utf8'));
const result = mergeCatalog(snapshot, files);
await fs.mkdir('.runtime',{recursive:true});
await fs.writeFile('.runtime/catalogo.json',JSON.stringify(result));
console.log(`Drive leído: ${result.mods.length} archivos en ${seen.size} carpetas.`);

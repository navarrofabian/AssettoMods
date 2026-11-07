import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {publicMod} from './catalog.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root,'dist');
if (path.dirname(dist) !== root || path.basename(dist) !== 'dist') throw new Error('Destino inválido');
try { if ((await fs.lstat(dist)).isSymbolicLink()) throw new Error('El destino no puede ser un enlace'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
await fs.rm(dist,{recursive:true,force:true});
await fs.mkdir(path.join(dist,'assets'),{recursive:true});
await fs.mkdir(path.join(dist,'media'),{recursive:true});
const input = await fs.readFile(path.join(root, '.runtime/catalogo.json'),'utf8').catch(e => { if(e.code==='ENOENT') return fs.readFile(path.join(root,'snapshot/catalogo.json'),'utf8'); throw e; });
const data = JSON.parse(input);
if (!Array.isArray(data.mods) || !data.covers || typeof data.covers !== 'object') throw new Error('Catálogo inválido');
const mods = data.mods.map(publicMod);
const ids = new Set(mods.map(m => m.id));
const covers = {};
for (const [id, cover] of Object.entries(data.covers)) {
  if (!ids.has(id) || !cover || !Array.isArray(cover.images)) continue;
  const images = [];
  for (const img of cover.images) {
    const match = /^\.\/media\/([a-f0-9]{64}\.webp)$/.exec(img.url || '');
    if (!match) throw new Error('Ruta de portada inválida');
    const source = path.join(root,'snapshot/media',match[1]);
    if ((await fs.lstat(source)).isSymbolicLink()) throw new Error('Portada no válida');
    await fs.copyFile(source,path.join(dist,'media',match[1]));
    images.push({url:img.url, version:img.version});
  }
  if (images.length) covers[id] = {kind:'manual',url:images[0].url,version:images[0].version,images};
}
await fs.writeFile(path.join(dist,'catalogo.json'),JSON.stringify({mods,covers,connected:true,status:{running:false},zipImport:{running:false,message:'Sin iniciar'}}));
const databaseUrl = (process.env.FAVORITES_DATABASE_URL || 'https://assettomods-ea691-default-rtdb.firebaseio.com').trim().replace(/\/$/,'');
if (databaseUrl && !/^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:firebaseio\.com|firebasedatabase\.app)$/i.test(databaseUrl)) throw new Error('La URL de Firebase no es válida');
await fs.writeFile(path.join(dist,'favoritos-config.json'),JSON.stringify({databaseUrl}));
await fs.copyFile(path.join(root,'frontend/index.html'),path.join(dist,'index.html'));
await fs.copyFile(path.join(root,'frontend/favorites.mjs'),path.join(dist,'favorites.mjs'));
await fs.copyFile(path.join(root,'frontend/admin.mjs'),path.join(dist,'admin.mjs'));
for (const name of ['servers.html','servers.css','servers.mjs','servers-core.mjs','session-ui.mjs']) await fs.copyFile(path.join(root,'frontend',name),path.join(dist,name));
await fs.cp(path.join(root,'frontend/assets/session-cars'),path.join(dist,'assets/session-cars'),{recursive:true});
await fs.writeFile(path.join(dist,'firebase-config.json'),JSON.stringify({apiKey:process.env.FIREBASE_WEB_API_KEY || ''}));
for (const name of ['assetto-icon.png','nascar.png','actc.png','editar.png','drive.png','actc.avif']) await fs.copyFile(path.join(root,'frontend/assets',name),path.join(dist,'assets',name));
console.log(`Versión preparada: ${mods.length} mods, ${Object.keys(covers).length} con portadas.`);

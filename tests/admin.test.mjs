import test from 'node:test';
import assert from 'node:assert/strict';
import {readEdits,writeEdit,mergeCovers,saveCover,compressImage} from '../frontend/admin.mjs';
import {readFile} from 'node:fs/promises';

test('sin sesión no permite guardar ediciones', async () => {
  await assert.rejects(writeEdit('1234567890',{displayName:'Prueba'}),/Iniciá sesión/);
});
test('consulta ediciones públicas sin pedir credenciales de Drive', async () => {
  const original=globalThis.fetch;
  globalThis.fetch=async (url,options)=>{assert.match(url,/libraryEdits\.json$/);assert.equal(options.headers,undefined);return {ok:true,json:async()=>({abc:{displayName:'Prueba'}})};};
  try { assert.equal((await readEdits()).abc.displayName,'Prueba'); } finally { globalThis.fetch=original; }
});
test('las reglas limitan escritura de ediciones a las dos cuentas verificadas', async () => {
  const rules=JSON.parse(await readFile(new URL('../firebase-admin.rules.json',import.meta.url)));
  for(const path of ['libraryEdits']) {
    const rule=rules.rules[path].$id['.write'];
    assert.match(rule,/email_verified/);assert.match(rule,/google\.com/);
    assert.match(rule,/navarrofabian315@gmail\.com/);assert.match(rule,/aguspaz133@gmail\.com/);
  }
  assert.equal(rules.rules.favorites['.read'],true);
});
test('agregar y reemplazar portadas conserva las imágenes originales',()=>{
  const originals=[{url:'./media/a.webp',version:1},{url:'./media/b.webp',version:2}];
  const merged=mergeCovers(originals,{overrides:{0:'data:image/webp;base64,AAAA'},added:{'imagen_12345':'data:image/webp;base64,BBBB'}});
  assert.equal(merged.length,3);assert.equal(merged[0].url,'data:image/webp;base64,AAAA');
  assert.equal(merged[1].url,'./media/b.webp');assert.equal(originals[0].url,'./media/a.webp');
  assert.deepEqual(merged[2].cloudRef,{type:'added',key:'imagen_12345'});
});
test('sin sesión no permite guardar portadas y las reglas restringen ambos tipos de imagen',async()=>{
  await assert.rejects(saveCover('1234567890',{type:'added',key:'imagen_12345'},'data:image/webp;base64,AAAA'),/Iniciá sesión/);
  const rules=JSON.parse(await readFile(new URL('../firebase-admin.rules.json',import.meta.url)));
  for(const leaf of [rules.rules.customCoverIndex.$id,rules.rules.customCovers.$id.overrides.$n,rules.rules.customCovers.$id.added.$key]){
    assert.match(leaf['.write'],/email_verified/);assert.match(leaf['.write'],/navarrofabian315@gmail\.com/);assert.match(leaf['.write'],/aguspaz133@gmail\.com/);
  }
});
test('rechaza imágenes de entrada demasiado grandes',async()=>{
  await assert.rejects(compressImage({type:'image/jpeg',size:15*1024*1024+1}),/15 MB/);
  await assert.rejects(compressImage({type:'application/pdf',size:100}),/JPG, PNG o WebP/);
});
test('las configuraciones de servidores solo pueden leerse y escribirse por administradores verificados',async()=>{
  const rules=JSON.parse(await readFile(new URL('../firebase-admin.rules.json',import.meta.url)));
  assert.match(rules.rules.serverPresets['.read'],/email_verified/);
  assert.match(rules.rules.serverPresets.$id['.write'],/navarrofabian315@gmail\.com/);
  assert.match(rules.rules.serverPresets.$id['.write'],/aguspaz133@gmail\.com/);
});

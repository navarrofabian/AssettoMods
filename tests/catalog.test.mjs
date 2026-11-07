import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeCatalog, publicMod} from '../scripts/catalog.mjs';

test('conserva los cambios manuales y portadas; no publica campos privados', () => {
  const old = {id:'a',name:'antes.zip',displayName:'Nombre elegido',category:'Circuitos',country:'Argentina',tags:['Pack'],secret:'privado'};
  const cover = {kind:'manual',images:[{url:'./media/test.webp'}]};
  const result = mergeCatalog({mods:[old],covers:{a:cover,b:cover}},[{id:'a',name:'nuevo.zip',size:'7',path:'/privado',modifiedTime:'2026'}]);
  assert.equal(result.mods[0].displayName,'Nombre elegido');
  assert.equal(result.mods[0].category,'Circuitos');
  assert.equal(result.mods[0].name,'nuevo.zip');
  assert.equal(result.mods[0].secret,undefined);
  assert.equal(result.mods[0].path,undefined);
  assert.deepEqual(Object.keys(result.covers),['a']);
});
test('clasifica archivos nuevos y limita los campos publicados', () => {
  const result = mergeCatalog({mods:[],covers:{}},[{id:'b',name:'porsche_gt3.zip',path:'/Cars/GT3',size:'5',createdTime:'2026-11-07T10:00:00Z'}]);
  assert.equal(result.mods.length,1);
  assert.equal(result.mods[0].id,'b');
  assert.equal(result.mods[0].name,'porsche_gt3.zip');
  assert.equal(result.mods[0].createdTime,'2026-11-07T10:00:00Z');
  assert.equal(result.mods[0].category,'Automóviles');
  assert.equal(publicMod({id:'a',refresh_token:'secreto'}).refresh_token,undefined);
});

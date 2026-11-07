import test from 'node:test';
import assert from 'node:assert/strict';
import {readEdits,writeEdit} from '../frontend/admin.mjs';
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

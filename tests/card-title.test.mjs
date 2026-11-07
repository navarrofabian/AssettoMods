import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

test('los títulos automáticos se limpian y los nombres editados se conservan', async () => {
  const html = await readFile(new URL('../frontend/index.html',import.meta.url),'utf8');
  const start=html.indexOf('function formatModTitle('), end=html.indexOf('\nfunction coverImages',start);
  assert.ok(start>=0&&end>start);
  const title=vm.runInNewContext(`(${html.slice(start,end)})`);
  assert.equal(title({name:'ks_porsche_911_gt3_r_2016.zip'}),'KS Porsche 911 GT3 R 2016');
  assert.equal(title({name:'archivo.zip',displayName:'Mi nombre editado'}),'Mi nombre editado');
  assert.match(html,/filename=el\('div','meta filename',x\.name\)/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {selectCoverCandidates} from '../scripts/cover-queue.mjs';

test('conserva portadas y vuelve a incluir nuevos archivos pendientes aunque sean antiguos',()=>{
  const mods=[{id:'a',size:'10',createdTime:'2020-01-01',modifiedTime:'2020-01-01'},{id:'b',size:'10',createdTime:'2020-01-01',modifiedTime:'2020-01-01'}];
  const result=selectCoverCandidates(mods,{b:{images:[{}]}},{a:{pending:true,version:'2020-01-01'}},new Set(['a','b']),Date.parse('2026-11-07'));
  assert.deepEqual(result.map(m=>m.id),['a']);
});

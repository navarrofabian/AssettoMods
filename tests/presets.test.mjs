import test from 'node:test';
import assert from 'node:assert/strict';
import {sortedPresets} from '../frontend/presets.mjs';
test('ordena primero las sesiones guardadas más recientemente y conserva las antiguas',()=>{const values={vieja:JSON.stringify({name:'Vieja'}),nueva:JSON.stringify({name:'Nueva',savedAt:200}),anterior:JSON.stringify({name:'Anterior',savedAt:100}),otra:JSON.stringify({name:'Otra'}),invalida:'{'};assert.deepEqual(sortedPresets(values).map(x=>x.id),['nueva','anterior','vieja','otra']);});

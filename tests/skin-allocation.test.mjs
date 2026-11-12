import test from 'node:test';
import assert from 'node:assert/strict';
import {generateServerFiles} from '../frontend/servers-core.mjs';
const base={name:'Prueba',trackId:'monza',layout:'',maxClients:5,udpPort:9600,tcpPort:9600,httpPort:8081,practiceMinutes:60,qualifyMinutes:0,raceLaps:0,sunAngle:6,ambient:22,weather:'3_clear_type=15',timeOfDay:'12:00',timeMultiplier:1,aiMode:'none',trackUrl:'https://example.org/track.zip'};
test('distribuye skins y pilotos antes de repetir',()=>{
 const car={id:'coche',skin:'s1',url:'https://example.org/car.zip',availableSkins:[{id:'s1',driver:'Piloto A'},{id:'s2',driver:'Piloto B'},{id:'s3',driver:'Piloto C'}]};
 const skins=cfg=>[...cfg.matchAll(/^SKIN=(.*)$/gm)].map(x=>x[1]);
 assert.deepEqual(skins(generateServerFiles({...base,cars:[car]}).files['entry_list.ini']),['s1','s2','s3','s1','s2']);
 const other={...car,id:'otro',skin:'s4',availableSkins:[{id:'s4',driver:'Piloto A'},{id:'s5',driver:'Piloto D'}]};
 assert.deepEqual(skins(generateServerFiles({...base,maxClients:3,cars:[car,other]}).files['entry_list.ini']),['s1','s5','s2']);
});

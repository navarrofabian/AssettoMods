import test from 'node:test';
import assert from 'node:assert/strict';
import {driveDownload,generateServerFiles} from '../frontend/servers-core.mjs';
const base={name:'Amigos',trackId:'monza',layout:'',maxClients:2,udpPort:9600,tcpPort:9600,httpPort:8081,practiceMinutes:60,qualifyMinutes:0,raceLaps:0,sunAngle:6,ambient:22,weather:'3_clear_type=15',timeOfDay:'12:00',timeMultiplier:1,aiMode:'none',cars:[{id:'ks_porsche_911',skin:'00_default',url:'https://drive.google.com/uc?export=download&id=1234567890'}],trackUrl:'https://example.org/monza.zip'};
test('genera los archivos y el formato oficial de content.json',()=>{
  const {files,warnings}=generateServerFiles(base),content=JSON.parse(files['content.json']);
  assert.equal(content.cars.ks_porsche_911.url,base.cars[0].url);assert.equal(content.track.url,base.trackUrl);
  assert.equal(content.cars.ks_porsche_911.version,undefined);assert.match(files['server_cfg.ini'],/TRACK=monza/);
  assert.match(files['server_cfg.ini'],/GRAPHICS=3_clear_type=15_time=43200_mult=1/);assert.match(files['entry_list.ini'],/\[CAR_1\]/);
  assert.match(files['extra_cfg.yml'],/EnableServerDetails: true/);assert.ok(warnings.some(x=>x.includes('Drive')));
});
test('rechaza identificadores inventados o peligrosos y URLs inseguras',()=>{
  assert.throws(()=>generateServerFiles({...base,trackId:'../otra'}),/identificador/);
  assert.throws(()=>generateServerFiles({...base,name:'Nombre\nPASSWORD=123'}),/caracteres/);
  assert.throws(()=>generateServerFiles({...base,cars:[{...base.cars[0],url:'http://localhost/x'}]}),/HTTPS/);
  assert.equal(driveDownload('mal/valor'),'');
});

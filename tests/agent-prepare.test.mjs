import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import {preparePreset} from '../local-agent/prepare.mjs';

test('prepara una copia aislada y conserva la configuración avanzada original',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'assetto-agent-test-'));
  try{
    await fs.mkdir(path.join(root,'cfg'),{recursive:true});
    await fs.mkdir(path.join(root,'content','tracks','monza'),{recursive:true});
    await fs.mkdir(path.join(root,'content','cars','car1','skins','skin1'),{recursive:true});
    const original='# ajustes existentes\nEnableAi: false\nCustomOption: 42\n';await fs.writeFile(path.join(root,'cfg','extra_cfg.yml'),original);
    const preset={name:'Prueba',trackId:'monza',layout:'',maxClients:2,udpPort:9600,tcpPort:9600,httpPort:8081,practiceMinutes:60,qualifyMinutes:0,raceLaps:0,sunAngle:6,ambient:22,weather:'3_clear_type=15',timeOfDay:'12:00',timeMultiplier:1,aiMode:'auto',cars:[{id:'car1',skin:'skin1',url:'https://example.com/car.zip'}],trackUrl:'https://example.com/track.zip'};
    const result=await preparePreset(root,path.join(root,'runtime'),preset);
    assert.equal(await fs.readFile(path.join(root,'cfg','extra_cfg.yml'),'utf8'),original);
    const extra=await fs.readFile(path.join(result.directory,'extra_cfg.yml'),'utf8');assert.match(extra,/CustomOption: 42/);assert.match(extra,/EnableAi: true/);
    assert.equal(JSON.parse(await fs.readFile(path.join(result.directory,'cm_content','content.json'),'utf8')).track.url,preset.trackUrl);
    await assert.rejects(preparePreset(root,path.join(root,'runtime'),{...preset,trackId:'inexistente'}),/No se encontró/);
  }finally{if(path.dirname(root)!==os.tmpdir()||!path.basename(root).startsWith('assetto-agent-test-'))throw Error('Ruta temporal inválida');await fs.rm(root,{recursive:true,force:true});}
});

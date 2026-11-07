import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {getInstalledContent} from '../local-agent/installed-content.mjs';
test('enumera contenido del servidor y skins del juego, con variantes reales',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'assetto-content-test-')),server=path.join(root,'server'),game=path.join(root,'game');
 try{
  for(const p of ['server/content/cars/car1','server/content/tracks/track1/12/data','server/content/tracks/track1/ui','game/content/cars/car1/skins/skin1','game/content/cars/no_servidor/skins/skin2'])await fs.mkdir(path.join(root,p),{recursive:true});
  await fs.writeFile(path.join(server,'content/cars/car1/data.acd'),'datos');await fs.writeFile(path.join(game,'content/cars/no_servidor/data.acd'),'datos');
  await fs.writeFile(path.join(server,'content/tracks/track1/12/data/surfaces.ini'),'');
  const result=await getInstalledContent(server,game);assert.deepEqual(result.cars,['car1','no_servidor']);assert.deepEqual(result.serverCars,['car1']);assert.deepEqual(result.tracks,['track1']);assert.deepEqual(result.skins.car1,['skin1']);assert.deepEqual(result.layouts.track1,['12']);
  assert.deepEqual((await getInstalledContent(server,null)).skins.car1,[]);
 }finally{if(path.dirname(root)!==os.tmpdir()||!path.basename(root).startsWith('assetto-content-test-'))throw Error('Ruta temporal inválida');await fs.rm(root,{recursive:true,force:true});}
});

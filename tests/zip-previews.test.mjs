import test from 'node:test';
import assert from 'node:assert/strict';
import {findZipPreviews} from '../scripts/zip-previews.mjs';

function zip(name,data){
  let crc=0xffffffff;for(const b of data){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^(0xedb88320&-(crc&1));}crc=(crc^0xffffffff)>>>0;
  const n=Buffer.from(name),local=Buffer.alloc(30),entry=Buffer.alloc(46),end=Buffer.alloc(22);
  local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt32LE(crc,14);local.writeUInt32LE(data.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(n.length,26);
  entry.writeUInt32LE(0x02014b50,0);entry.writeUInt16LE(20,4);entry.writeUInt16LE(20,6);entry.writeUInt32LE(crc,16);entry.writeUInt32LE(data.length,20);entry.writeUInt32LE(data.length,24);entry.writeUInt16LE(n.length,28);
  const offset=local.length+n.length+data.length,dir=Buffer.concat([entry,n]);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);end.writeUInt32LE(dir.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([local,n,data,dir,end]);
}
test('lee imágenes de vista previa por rangos y rechaza rutas inseguras',async()=>{
  const image=Buffer.from([137,80,78,71,13,10,26,10,1,2,3]);
  const valid=zip('car/skins/uno/preview.png',image);
  const result=await findZipPreviews(valid.length,async(a,b)=>valid.subarray(a,b+1));
  assert.equal(result.length,1);assert.deepEqual(result[0].data,image);
  const unsafe=zip('../preview.png',image);
  assert.deepEqual(await findZipPreviews(unsafe.length,async(a,b)=>unsafe.subarray(a,b+1)),[]);
});

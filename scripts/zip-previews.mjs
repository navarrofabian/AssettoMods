import { inflateRawSync } from 'node:zlib';

const MAX_DIRECTORY = 4 * 1024 * 1024;
const MAX_IMAGE = 5 * 1024 * 1024;
const MAX_IMAGES = 6;
const MAX_COMPRESSED_TOTAL = 12 * 1024 * 1024;

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function imageType(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'png';
  if (buffer.length >= 12 && buffer.subarray(0,4).toString() === 'RIFF' && buffer.subarray(8,12).toString() === 'WEBP') return 'webp';
  return null;
}

// readRange returns precisely the requested inclusive interval from Drive.
// This parser never extracts paths or expands arbitrary archive entries.
export async function findZipPreviews(size, readRange) {
  if (!Number.isSafeInteger(size) || size < 22) throw Error('Tamaño de ZIP inválido');
  const tailStart = Math.max(0, size - 65557);
  const tail = await readRange(tailStart, size - 1);
  let end = -1;
  for (let i = tail.length - 22; i >= 0; i--) {
    if (tail.readUInt32LE(i) === 0x06054b50 && i + 22 + tail.readUInt16LE(i + 20) === tail.length) { end = i; break; }
  }
  if (end < 0) throw Error('No se encontró el índice ZIP');
  const disk = tail.readUInt16LE(end + 4), cdDisk = tail.readUInt16LE(end + 6);
  const diskEntries = tail.readUInt16LE(end + 8), entries = tail.readUInt16LE(end + 10);
  const cdSize = tail.readUInt32LE(end + 12), cdOffset = tail.readUInt32LE(end + 16);
  if (disk || cdDisk || diskEntries !== entries || entries === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) throw Error('ZIP dividido o ZIP64 no compatible');
  if (cdSize > MAX_DIRECTORY || cdOffset + cdSize > tailStart + end || cdOffset + cdSize > size) throw Error('Índice ZIP demasiado grande o inválido');
  if (!cdSize) return [];
  const cd = await readRange(cdOffset, cdOffset + cdSize - 1);
  const candidates = [];
  let offset = 0;
  for (let i = 0; i < entries; i++) {
    if (offset + 46 > cd.length || cd.readUInt32LE(offset) !== 0x02014b50) throw Error('Índice ZIP incompleto');
    const flags=cd.readUInt16LE(offset+8), method=cd.readUInt16LE(offset+10), crc=cd.readUInt32LE(offset+16);
    const compressed=cd.readUInt32LE(offset+20), unpacked=cd.readUInt32LE(offset+24);
    const nameLength=cd.readUInt16LE(offset+28), extraLength=cd.readUInt16LE(offset+30), commentLength=cd.readUInt16LE(offset+32);
    const diskStart=cd.readUInt16LE(offset+34), local=cd.readUInt32LE(offset+42), endEntry=offset+46+nameLength+extraLength+commentLength;
    if (endEntry > cd.length) throw Error('Nombre ZIP inválido');
    const name=cd.subarray(offset+46,offset+46+nameLength).toString('utf8').replace(/\\/g,'/');
    const safe=!name.startsWith('/')&&!name.split('/').includes('..')&&!name.includes('\0');
    if (safe && !(flags&1) && (method===0||method===8) && !diskStart && compressed>0 && compressed<=MAX_IMAGE && unpacked>0 && unpacked<=MAX_IMAGE && local!==0xffffffff && /(?:^|\/)preview\.(?:jpe?g|png|webp)$/i.test(name)) {
      candidates.push({name, flags, method, crc, compressed, unpacked, local});
    }
    offset=endEntry;
  }
  candidates.sort((a,b)=>Number(/\/skins\//i.test(b.name))-Number(/\/skins\//i.test(a.name))||a.name.localeCompare(b.name));
  const result=[]; let total=0; const names=new Set();
  for (const entry of candidates) {
    if(result.length>=MAX_IMAGES || total+entry.compressed>MAX_COMPRESSED_TOTAL) break;
    if(names.has(entry.name.toLowerCase())) continue; names.add(entry.name.toLowerCase());
    try {
      if(entry.local+30>size) continue;
      const head=await readRange(entry.local,entry.local+29);
      if(head.readUInt32LE(0)!==0x04034b50 || head.readUInt16LE(6)!==entry.flags || head.readUInt16LE(8)!==entry.method) continue;
      const dataStart=entry.local+30+head.readUInt16LE(26)+head.readUInt16LE(28);
      if(dataStart+entry.compressed>cdOffset || dataStart+entry.compressed>size) continue;
      const compressed=await readRange(dataStart,dataStart+entry.compressed-1); total+=entry.compressed;
      const data=entry.method===0?compressed:inflateRawSync(compressed,{maxOutputLength:MAX_IMAGE});
      const ext=imageType(data);if(!ext || data.length!==entry.unpacked || crc32(data)!==entry.crc) continue;
      result.push({data, ext, entry:entry.name, crc:entry.crc});
    } catch (e) {
      if(e.rangeFailure) throw e;
    }
  }
  return result;
}

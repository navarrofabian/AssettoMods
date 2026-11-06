import { infer } from './infer.mjs';

const fields = ['id','name','displayName','category','group','subcategory','scope','country','tags','size','modifiedTime','mimeType'];
export function publicMod(mod) {
  return Object.fromEntries(fields.filter(k => mod[k] !== undefined).map(k => [k, mod[k]]));
}
export function mergeCatalog(snapshot, files) {
  const previous = new Map(snapshot.mods.map(m => [m.id, m]));
  const mods = files.map(f => {
    const old = previous.get(f.id);
    return publicMod(old ? {...old, name:f.name, size:f.size, modifiedTime:f.modifiedTime, mimeType:f.mimeType} : {...f, ...infer(f)});
  });
  const ids = new Set(mods.map(m => m.id));
  const covers = Object.fromEntries(Object.entries(snapshot.covers || {}).filter(([id]) => ids.has(id)));
  return {mods, covers, connected:true, status:{running:false}, zipImport:{running:false, message:'Sin iniciar'}};
}

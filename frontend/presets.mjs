// Las sesiones antiguas no tienen fecha: conservan su orden relativo.
export function sortedPresets(stored){
  return Object.entries(stored||{}).map(([id,raw],index)=>{
    try{const preset=JSON.parse(raw);if(!preset||typeof preset!=='object'||Array.isArray(preset))return null;const time=Number(preset.savedAt);return {id,preset,index,time:Number.isFinite(time)&&time>0?time:0};}catch{return null;}
  }).filter(Boolean).sort((a,b)=>b.time-a.time||a.index-b.index);
}

export function selectCoverCandidates(mods,covers,attempts,known,now=Date.now(),max=3){
  const recent=now-30*24*60*60*1000;
  return mods.filter(m=>{
    const attempt=attempts[m.id];
    return !covers[m.id] && Number(m.size)>0 && (!known.has(m.id)||attempt?.pending||Date.parse(m.createdTime||m.modifiedTime||'')>=recent) &&
      (!attempt||attempt.pending||attempt.version!==String(m.modifiedTime||'')||Date.parse(attempt.retryAfter||'9999-01-01')<=now);
  }).sort((a,b)=>String(b.createdTime||b.modifiedTime||'').localeCompare(String(a.createdTime||a.modifiedTime||''))).slice(0,max);
}

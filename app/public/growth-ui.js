export function discussionTarget(event,seats) {
  const others=seats.filter(s=>s.key!==event.seat);
  if(event.addressedSeat==='none')return null;
  const explicit=others.find(s=>s.key===event.addressedSeat);if(explicit)return explicit.key;
  // Older saved sessions lack addressedSeat. Infer only an actual selected name.
  const text=String(event.response||'').toLowerCase();
  return others.map(s=>({key:s.key,index:Math.min(...[s.name,s.short].filter(Boolean).map(n=>{const escaped=n.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const match=new RegExp(`\\b${escaped}\\b`).exec(text);return match?match.index:Infinity;}))})).sort((a,b)=>a.index-b.index).find(s=>Number.isFinite(s.index))?.key||null;
}
export function growthReportSections(plan,reports=[],discussion=[]) {
  const sections=[{title:'Council conclusion',lines:[plan.summary||'',`Goals: ${plan.context||'Not specified'}`,`Submitted URLs: ${(plan.urls||[]).join(', ')}`]}];
  for(const when of ['First 7 days','Days 8–30','Days 31–90'])sections.push({title:when,lines:(plan.priorities||[]).filter(p=>p.when===when).flatMap(p=>[`${p.action} — ${p.page}`,`Owner: ${p.owner}. Why: ${p.reason}`,`Dependency: ${p.dependency}`,`Success check: ${p.successCheck}`])});
  sections.push({title:'Measurement',lines:(plan.measurements||[]).map(m=>`${m.metric}: ${m.how}. Baseline needed: ${m.baselineNeeded}`)});
  sections.push({title:'Differences of opinion',lines:(plan.disagreements||[]).map(d=>`${d.issue}: ${(d.views||[]).join('; ')}. Resolution: ${d.resolution}`)});
  for(const r of reports)sections.push({title:`${r.name} — specialist report`,lines:[r.opinion,`Assigned skills: ${(r.skills||[]).map(s=>s.id).join(', ')}`,...(r.strengths||[]).map(s=>`Strength (${s.page}): ${s.evidence}. ${s.meaning}`),...(r.opportunities||[]).flatMap(o=>[`${o.priority}: ${o.opportunity} — ${o.page}`,`Evidence: ${o.evidence}`,`Change: ${o.change}`,`Example: ${o.example}`,`Dependency: ${o.dependency}`,`Verify: ${o.verification}`]),...(r.contentIdeas||[]).map(i=>`Content idea (${i.page}): ${i.idea}. Reader need: ${i.readerNeed}. Original evidence needed: ${i.originalEvidenceNeeded}`),...(r.sourceReferences||[]).map(s=>`Method ${s.id}: ${s.title} (${s.url}). ${s.application}`),...(r.dataNeeded||[]).map(d=>`Data needed: ${d}`)]});
  sections.push({title:'Council discussion',lines:discussion.flatMap(d=>[`${d.name}: ${d.response}`,`Evidence (${d.page}): ${d.evidence}`])});
  sections.push({title:'Missing data and limitations',lines:[...(plan.dataNeeded||[]),...(plan.errors||[]).map(e=>`${e.name}: ${e.error}`),plan.limitations||'Sampled evidence only. No ranking guarantees.']});
  return sections;
}

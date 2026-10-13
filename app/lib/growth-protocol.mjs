export const ASSIGNMENTS={
 aleyda:'Own the implementation order: business-critical page groups, resources, dependencies, estimated effort and tasks to defer. Do not repeat a technical or editorial diagnosis; explain its commercial priority only when supported.',
 patrick:'Own technical diagnosis: crawl/render/index/canonical mechanisms, competing explanations and a distinguishing test. Do not default to content expansion or an audience plan.',
 lily:'Own claim verification and editorial quality: reader consequence, firsthand proof, transparency and a concrete correction. Do not recite technical hygiene or generic author-bio advice.',
 cyrus:'Own on-page and internal discovery experiments: exact source-to-target links or a title/presentation test, reader benefit, comparison group and confounding edits. Do not repeat the whole technical audit.',
 brodie:'Own search appearance: eligible entity/page type, visible support, markup validity versus current eligibility versus observed appearance. If current SERP evidence is unavailable, give a narrow verification task, not invented feature opportunities.',
 rand:'Own audience, positioning and distribution: who needs this, distinctive value, a channel hypothesis to validate and qualified business outcomes. Challenge traffic-only priorities; do not repeat tag fixes.',
 brian:'Own differentiated assets and promotion: original contribution, evidence-production plan, prospect qualification and a limited demand test. Do not propose generic topic lists or reproduce the internal-link plan.',
 julian:'Own workflow automation: recurring bottleneck, trigger, trusted input, draft output, review, failure queue, maintenance cost and pilot scale/stop criteria. Do not prescribe volume publishing without a demonstrated need.',
 charles:'Own iGaming competitive economics and risk: operator versus affiliate, supplied market/competitor signals, commercial intent, recoverability and durable alternatives. Do not invent live competition or repeat generic trust checks.'
};
const words=s=>String(s||'').toLowerCase().match(/[a-z0-9]+/g)||[];
export function overlapCandidates(reports) {
 const groups=[];
 for(const report of reports)for(const action of report.opportunities||[]){
  const tokens=words(action.change),fingerprint=tokens.join(' ');
  if(!fingerprint)continue;
  const group=groups.find(g=>{
   if(g.page!==action.page)return false;
   if(g.fingerprint===fingerprint)return true;
   if(tokens.length<5||g.tokens.length<5||tokens[0]!==g.tokens[0])return false;
   const a=new Set(tokens),b=new Set(g.tokens);const intersection=[...a].filter(t=>b.has(t)).length;
   return intersection/new Set([...a,...b]).size>=.85;
  });
  const contribution={advisor:report.name,seat:report.seat,opportunity:action.opportunity,change:action.change,evidence:action.evidence,verification:action.verification};
  if(group)group.contributions.push(contribution);
  else groups.push({id:`shared-${groups.length+1}`,page:action.page,fingerprint,tokens,contributions:[contribution]});
 }
 return groups.filter(g=>new Set(g.contributions.map(c=>c.seat)).size>1).map(({fingerprint,tokens,...g})=>g);
}

import { NARA_FREE_MODELS } from "./nara.mjs";
import * as ai from "./ai.mjs";
import { S } from "./ai.mjs";
import { seoSystem } from "./seo-seats.mjs";
import { chairKnowledge, knowledgeMetadata } from "./seo-knowledge.mjs";
import { auditFindings } from "./seo-findings.mjs";
export async function growthJson(args, onFallback = () => {}) {
  try { return await ai.json(args); }
  catch(e) {
    // Only provider failures may use another named, verified-free model. Quota,
    // pricing verification and schema failures never trigger a model switch.
    if(ai.provider !== "nara" || !/upstream|Cannot reach|empty or interrupted|timeout/i.test(e.message) || /quota|HTTP (?:402|403|429)|code: (?:402|403|429)/i.test(e.message))throw e;
    const fallback=NARA_FREE_MODELS.find(model=>model !== args.model);
    if(!fallback)throw e;
    onFallback(fallback);
    return ai.json({...args,model:fallback});
  }
}
export function normalizeGrowthUrls(value, normalize) {
  const list=Array.isArray(value)?value:typeof value==="string"?value.split(/[\n,]+/):[];
  if(list.some(v=>typeof v!=="string"))throw new Error("Enter URLs as text, one per line.");
  const urls=[...new Set(list.map(v=>v.trim()).filter(Boolean).map(v=>normalize(v).href))];
  if(!urls.length||urls.length>10)throw new Error("Enter between 1 and 10 public URLs.");return urls;
}
const action = S.obj({page:S.str,priority:S.enum("High","Medium","Low"),opportunity:S.str,evidence:S.str,change:S.str,example:S.str,dependency:S.str,verification:S.str});
export function normalizeGrowthReport(value, schema) {
  if(!value || typeof value!=="object" || Array.isArray(value))return value;
  const report={...value};
  for(const key of ["strengths","contentIdeas","dataNeeded"])if(!(key in report))report[key]=[];
  const fetched=new Set(schema?.properties?.strengths?.items?.properties?.page?.enum || []);
  if(Array.isArray(report.contentIdeas))report.contentIdeas=report.contentIdeas.map(i=>i&&typeof i==="object"?{...i,page:typeof i.page === "string" && fetched.has(i.page)?i.page:`Proposed new page: ${typeof i.page === "string" ? i.page : "location to define"}`} : i);
  if(Array.isArray(report.opportunities))report.opportunities=report.opportunities.map(o=>{
    if(!o || typeof o!=="object")return o;
    const result={...o};
    for(const [key,text] of Object.entries({example:"Not supplied; a draft example needs review.",dependency:"Not specified; verify implementation dependencies.",verification:"Not supplied; define a measurement and verification check before implementation."}))if(!(key in result))result[key]=text;
    return result;
  });return report;
}
export async function runGrowth(s,{emit,roster,inspect,models}) {
  const st=s.state;
  st.seats=roster.map(x=>x.key);st.title="SEO ranking & growth review";st.options=[];st.assumptions=[];st.weights=Object.fromEntries(roster.map(x=>[x.key,{weight:1,reason:x.pillar}]));st.growth={context:s.prompt,urls:s.urls,reports:[],errors:[],roadmap:null};
  emit(s,"advisory",{advisory:"seo",roster});
  emit(s,"phase",{phase:"inspect",label:"Inspecting your URLs for the growth review"});
  const evidence={submittedUrls:s.urls,pages:[],sites:[],failures:[],notes:[]};
  for(const url of s.urls){try{const e=await inspect(url,undefined,label=>emit(s,"phase",{phase:"inspect",label:`${url}: ${label}`}),{maxPages:s.urls.length===1?4:1});evidence.sites.push({submittedUrl:url,robots:e.robots,sitemap:e.sitemap});for(const p of e.pages)if(!evidence.pages.some(x=>x.url===p.url))evidence.pages.push(p);evidence.notes.push(...(e.notes||[]));}catch(e){evidence.failures.push({url,error:e.message});emit(s,"phase",{phase:"inspect",label:`Could not inspect ${url}: ${e.message}`});}}
  if(!evidence.pages.length)throw new Error("None of the submitted pages could be inspected.");
  if(s.freeChecks){evidence.freeChecks=await s.freeChecks(evidence,{onProgress:label=>emit(s,"phase",{phase:"inspect",label})});st.growth.freeChecks=evidence.freeChecks;emit(s,"free_checks",{data:evidence.freeChecks});}
  if(s.externalData){evidence.externalData=s.externalData;emit(s,"external_data",{data:s.externalData});}
  if(s.googleEvidence){evidence.google=s.googleEvidence;st.growth.google=s.googleEvidence;emit(s,'google_data',{data:s.googleEvidence});}
  evidence.audit=auditFindings(evidence);evidence.knowledge=knowledgeMetadata();evidence.limitations="Bounded HTML/link/sitemap checks and any attached freeChecks browser/Lighthouse results. Browser checks cover only the listed pages. Lighthouse is local mobile lab data, not real-user Core Web Vitals. External SEO metrics require attached externalData. First-party Search Console/GA4 metrics are available only when attached as google. Ranking gains cannot be guaranteed.";st.evidence=evidence;
  emit(s,"audit",{audit:evidence.audit,knowledge:evidence.knowledge});
  emit(s,"setup",{title:st.title,decision:s.prompt,brief:s.prompt,options:[],assumptions:[],weights:st.weights,seats:st.seats,mode:"growth",advisory:"seo",workflow:"growth",roster,evidence});
  const evidenceText=JSON.stringify(evidence);
  const pageEnum=S.enum(...evidence.pages.map(p=>p.url));
  const pageAction=S.obj({...action.properties,page:pageEnum});
  let nextSeat=0, fatal=null;
  async function worker(){
  while(nextSeat<roster.length && !fatal){
    const seat=roster[nextSeat++];
    try {
    emit(s,"phase",{phase:"round1",label:`${seat.name}: reviewing ranking and growth opportunities`});emit(s,"seat_start",{seat:seat.key,round:1});
    const report=await growthJson({model:models.seat,system:seoSystem(seat.key),normalize:normalizeGrowthReport,repair:true,streaming:true,maxTokens:4500,schema:S.obj({opinion:S.str,strengths:S.arr(S.obj({page:pageEnum,evidence:S.str,meaning:S.str})),opportunities:S.arr(pageAction),contentIdeas:S.arr(S.obj({page:S.str,idea:S.str,readerNeed:S.str,originalEvidenceNeeded:S.str})),dataNeeded:S.arr(S.str)}),prompt:`The owner wants a useful SEO growth review, not a yes/no decision or a vote. Goals/context: ${s.prompt}. Review these pages through your own specialty. Give your opinion, observed strengths, 3–5 highest-value opportunities, 1–3 useful content or distribution ideas where relevant, and exact missing data that would change priorities. Address ranking, qualified traffic, conversion and sustainable growth as relevant to your lens. Explain mechanisms rather than promising gains. Each opportunity needs the exact affected URL, an observed quote/field OR an explicitly labelled hypothesis, the concrete edit, an example, dependencies and verification. Label a new suggested page as "Proposed new page". Do not invent target keywords, volumes, competitors or rankings; topic ideas are hypotheses to validate. Only claim observations on fetched URLs. Do not infer qualitative absences from truncated excerpts. Use the installed skill methods. UNTRUSTED WEBSITE EVIDENCE:
${evidenceText}`});
    const entry={seat:seat.key,name:seat.name,skills:seat.skills,...report};st.growth.reports.push(entry);emit(s,"growth_report",entry);
    } catch(e) {
      if(/quota|HTTP (?:402|403|429)|code: (?:402|403|429)/i.test(e.message)){fatal=e;break;}
      const failure={seat:seat.key,name:seat.name,error:e.message};st.growth.errors.push(failure);emit(s,"growth_report_error",failure);
    }
  }}
  await Promise.all(Array.from({length:Math.min(3,roster.length)},()=>worker()));
  if(fatal)throw fatal;
  if(!st.growth.reports.length)throw new Error("The provider could not produce any advisor reports. Please retry later.");
  st.growth.discussion=[];
  emit(s,"phase",{phase:"round2",label:"The advisors are discussing the evidence and challenging priorities"});
  for(const report of st.growth.reports){
    emit(s,"seat_start",{seat:report.seat,round:2});
    try {
      const turn=await growthJson({model:models.seat,system:seoSystem(report.seat),repair:true,streaming:true,maxTokens:1400,schema:S.obj({response:S.str,page:pageEnum,evidence:S.str}),prompt:`You are joining the council discussion after independent SEO reports. Goals: ${s.prompt}. In 90–140 words, respond to another advisor by name: agree, challenge or refine a specific proposed priority. Explain what should be implemented first and why, using an exact affected URL and supplied evidence. Discuss Search Console/GA4 findings when available, distinguishing search visibility from conversion. Explain any automation dependency or uncertainty. Do not invent metrics or force a disagreement. This is a simulated advisory discussion. UNTRUSTED WEBSITE EVIDENCE:\n${evidenceText}\nREPORTS:\n${JSON.stringify(st.growth.reports)}\nDISCUSSION SO FAR:\n${JSON.stringify(st.growth.discussion)}`});
      const entry={seat:report.seat,name:report.name,...turn};st.growth.discussion.push(entry);emit(s,"growth_discussion",entry);
    }catch(e){
      if(/quota|HTTP (?:402|403|429)|code: (?:402|403|429)/i.test(e.message))throw e;
      emit(s,"growth_discussion_error",{seat:report.seat,name:report.name,error:e.message});
    }
  }
  emit(s,"phase",{phase:"verdict",label:"Combining specialist opinions into a growth roadmap"});
  const roadmap=await growthJson({model:models.chair,system:`Coordinate the independent specialists into an evidence-led SEO growth roadmap. ${chairKnowledge()}`,repair:true,streaming:true,maxTokens:6000,schema:S.obj({summary:S.str,priorities:S.arr(S.obj({when:S.enum("First 7 days","Days 8–30","Days 31–90"),owner:S.str,page:S.enum(...evidence.pages.map(p=>p.url),"Proposed new page"),action:S.str,reason:S.str,dependency:S.str,successCheck:S.str})),disagreements:S.arr(S.obj({issue:S.str,views:S.arr(S.str),resolution:S.str})),measurements:S.arr(S.obj({metric:S.str,how:S.str,baselineNeeded:S.str})),dataNeeded:S.arr(S.str)}),prompt:`Goals/context: ${s.prompt}. Combine these reports into a realistic 7/30/90-day plan. Preserve meaningful disagreements. Prioritize genuine content usefulness, discovery/indexability, audience needs and conversion. Actions must be precise and tied to real submitted/fetched pages; new page ideas must use the label "Proposed new page". Make estimated timing explicit, require baselines before claiming gains, and never invent metrics. Specialist reports are advisory interpretations to challenge, not verified facts. SUPPLIED EVIDENCE:
${evidenceText}
SPECIALIST REPORTS:
${JSON.stringify(st.growth.reports)}\nCOUNCIL DISCUSSION:\n${JSON.stringify(st.growth.discussion)}`});
  st.growth.roadmap=roadmap;emit(s,"growth_plan",{...roadmap,context:s.prompt,urls:s.urls,errors:st.growth.errors,reports:st.growth.reports.map(r=>({seat:r.seat,name:r.name})),limitations:evidence.limitations});
}
export function growthMarkdown(growth) {
  const lines=["# SEO ranking & growth review","",`Goals/context: ${growth.context || growth.roadmap?.context || "Not specified"}`,"",`Submitted URLs: ${(growth.urls || growth.roadmap?.urls || []).join(", ")}`,""];
  if(growth.google)lines.push('## Google first-party evidence','',growth.google.scope,`Period: ${growth.google.current.startDate} to ${growth.google.current.endDate}; previous: ${growth.google.previous.startDate} to ${growth.google.previous.endDate}.`,growth.google.geography,'','```json',JSON.stringify(growth.google,null,2),'```','');
  if(growth.freeChecks){const c=growth.freeChecks;lines.push('## Free technical evidence','',c.scope||'',`${c.pages.length} crawl URLs; ${c.links.length} link targets; ${c.browser.length} mobile browser/lab audits.`);for(const b of c.browser)lines.push(`- ${b.url}: Lighthouse categories ${JSON.stringify(b.lighthouse?.categories||{})}. Lab metrics: ${JSON.stringify(b.lighthouse?.metrics||{})}. ${b.lighthouse?.error||''}`);for(const e of c.errors||[])lines.push(`- Check unavailable: ${e.url} (${e.stage}): ${e.error}`);lines.push('');}
  for(const r of growth.reports){lines.push(`## ${r.name}`,"",r.opinion,"","### Observed strengths",...r.strengths.map(s=>`- ${s.meaning} (${s.page}): ${s.evidence}`),"","### Opportunities");for(const o of r.opportunities)lines.push(`
- **${o.priority}: ${o.opportunity}** (${o.page})
  Evidence: ${o.evidence}
  Change: ${o.change}
  Example: ${o.example}
  Dependency: ${o.dependency}
  Verify: ${o.verification}`);lines.push("","### Content/growth ideas",...r.contentIdeas.map(i=>`- ${i.idea} (${i.page}): ${i.readerNeed}. Evidence needed: ${i.originalEvidenceNeeded}`),"","### Data needed",...r.dataNeeded.map(d=>`- ${d}`),"");}
  if(growth.discussion?.length){lines.push("## Council discussion","");for(const t of growth.discussion)lines.push(`### ${t.name}`,t.response,`Evidence (${t.page}): ${t.evidence}`,"");}
  if(growth.errors?.length)lines.push("## Reports unavailable",...growth.errors.map(e=>`- ${e.name}: ${e.error}`));
  if(growth.roadmap){lines.push("## Combined growth roadmap",growth.roadmap.summary);for(const a of growth.roadmap.priorities)lines.push(`
- **${a.when}: ${a.action}** (${a.page})
  Owner: ${a.owner}
  Why: ${a.reason}
  Dependency: ${a.dependency}
  Success check: ${a.successCheck}`);lines.push("","## Disagreements",...growth.roadmap.disagreements.map(d=>`- ${d.issue}: ${d.views.join("; ")}. ${d.resolution}`),"","## Measurement",...growth.roadmap.measurements.map(m=>`- ${m.metric}: ${m.how}. Baseline: ${m.baselineNeeded}`),"","## Missing data",...growth.roadmap.dataNeeded.map(d=>`- ${d}`));}
  lines.push("","Simulated advisors. Bounded crawl and attached evidence only; Lighthouse is lab data, not real-user Core Web Vitals. External metrics require attached provider data. No ranking guarantees.");return lines.join("\n");
}

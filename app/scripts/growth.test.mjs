import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
process.env.AI_PROVIDER="omniroute";process.env.OMNIROUTE_API_KEY="fixture";
const {startCouncil,loadSaved,listSaved}=await import("../lib/council.mjs");
const {normalizeGrowthUrls,normalizeGrowthReport,growthMarkdown}=await import("../lib/growth.mjs");
const {normalizeWebsite}=await import("../lib/seo.mjs");
const {SESSIONS_DIR}=await import("../lib/env.mjs");
function fill(s){if(s.enum)return s.enum[0];if(s.type==="object")return Object.fromEntries(Object.entries(s.properties).map(([k,v])=>[k,fill(v)]));if(s.type==="array")return [];if(s.type==="boolean")return false;return "Fixture";}
test("Growth URLs normalize, deduplicate and validate",()=>{assert.deepEqual(normalizeGrowthUrls("example.com\nhttps://example.com/",normalizeWebsite),["https://example.com/"]);assert.throws(()=>normalizeGrowthUrls([],normalizeWebsite));assert.throws(()=>normalizeGrowthUrls([42],normalizeWebsite));assert.throws(()=>normalizeGrowthUrls("file:///tmp",normalizeWebsite));assert.throws(()=>normalizeGrowthUrls(Array.from({length:11},(_,i)=>`https://example.com/${i}`),normalizeWebsite));});
test("Growth review inspects URLs, gives every selected advisor a report, synthesizes and saves",async()=>{
 const original=globalThis.fetch;let requests=0;const inspected=[];
 globalThis.fetch=async(_url,opts)=>{requests++;const body=JSON.parse(opts.body);assert.equal(body.stream,false);const schema=JSON.parse(body.messages[0].content.split("No markdown or commentary.\n").at(-1));const value=fill(schema);
 assert.match(body.messages.at(-1).content,/FREE_AUDIT_FIXTURE/); if(schema.properties.opinion){value.opinion="A page-specific growth opportunity";value.strengths=[{page:"https://example.com/",evidence:"Fixture content",meaning:"Useful"}];value.opportunities=[{page:"https://example.com/",priority:"High",opportunity:"Clarify offer",evidence:"Fixture content",change:"Add accurate details",example:"Describe the real process",dependency:"Verify business inputs",verification:"Measure qualified leads"}];value.contentIdeas=[{page:"Proposed new page",idea:"A useful guide",readerNeed:"Comparison",originalEvidenceNeeded:"Firsthand evidence"}];value.dataNeeded=["Search Console baseline"];}
 else{value.summary="Prioritize a useful page update";value.priorities=[{when:"First 7 days",owner:"Site owner",page:"https://example.com/",action:"Update the page",reason:"Clarify offer",dependency:"Verified evidence",successCheck:"Measure leads"}];value.measurements=[{metric:"Qualified leads",how:"Analytics",baselineNeeded:"Last 28 days"}];}
 return Response.json({choices:[{finish_reason:"stop",message:{content:JSON.stringify(value)}}]});};
 let session;
 try{session=startCouncil("Grow qualified leads","full","seo","https://example.com/",{workflow:"growth",urls:["https://example.com/","https://example.com/service/","https://example.com/blocked/"],selectedSeats:["lily","julian"],freeChecks:async()=>({marker:"FREE_AUDIT_FIXTURE",pages:[],links:[],browser:[],structuredData:[]}),inspect:async(url,_read,_progress,opts)=>{inspected.push([url,opts.maxPages]);if(url.endsWith("blocked/"))throw new Error("HTTP 403");return {pages:[{url,title:"Fixture",textExcerpt:"Fixture content"}],notes:[],robots:{status:200},sitemap:{status:200}};}});
 const until=Date.now()+10000;while(session.status==="running"&&Date.now()<until)await new Promise(r=>setTimeout(r,15));assert.equal(session.status,"done",JSON.stringify(session.events.find(e=>e.type==="error")));assert.equal(requests,3);assert.deepEqual(inspected.map(x=>x[1]),[1,1,1]);assert.equal(session.state.evidence.failures.length,1);assert.ok(session.events.some(e=>e.type==="free_checks"));assert.equal(session.state.evidence.pages.length,2);assert.deepEqual(session.events.filter(e=>e.type==="growth_report").map(e=>e.seat),["lily","julian"]);assert.ok(session.events.some(e=>e.type==="growth_plan"));assert.ok(!session.events.some(e=>e.type==="round_done"));assert.equal(listSaved().find(s=>s.id===session.id).workflow,"growth");assert.equal(loadSaved(session.id).events.filter(e=>e.type==="growth_report").length,2);assert.match(growthMarkdown(session.state.growth),/Lily Ray|Julian Goldie/);assert.ok(fs.existsSync(path.join(session.dir,"growth.json")));
 }finally{globalThis.fetch=original;if(session?.dir&&path.dirname(session.dir)===SESSIONS_DIR&&path.basename(session.dir).startsWith(session.id+"-")){for(const file of ["events.json","evidence.json","brief.md","growth.json","growth.md"])fs.rmSync(path.join(session.dir,file),{force:true});fs.rmdirSync(session.dir);}}
});

test("Missing supporting report fields get explicit review notes, not invented advice",()=>{
 const report=normalizeGrowthReport({opinion:"Opinion",opportunities:[{page:"https://example.com/",priority:"High",opportunity:"Improve clarity",evidence:"Quote",change:"Clarify offer"}]});
 assert.deepEqual(report.strengths,[]);assert.match(report.opportunities[0].example,/Not supplied/);assert.equal(report.opportunities[0].change,"Clarify offer");assert.ok(!("page" in normalizeGrowthReport({opportunities:[{}]}).opportunities[0]));
});

test("New content locations are proposals rather than falsely inspected pages",()=>{const schema={properties:{strengths:{items:{properties:{page:{enum:["https://example.com/"]}}}}}};const r=normalizeGrowthReport({opportunities:[],contentIdeas:[{page:"https://example.com/new-guide/"},{page:"https://example.com/"}]},schema);assert.match(r.contentIdeas[0].page,/Proposed new page:/);assert.equal(r.contentIdeas[1].page,"https://example.com/");});

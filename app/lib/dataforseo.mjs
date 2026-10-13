import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { env, REPO_ROOT } from "./env.mjs";
import { normalizeWebsite } from "./seo.mjs";
export const DATAFORSEO_REVIEW_CAP=5;
export const dataforseoConfigured=()=>Boolean(env("DATAFORSEO_LOGIN")&&env("DATAFORSEO_PASSWORD"));
export function normalizeDataRequest(input){
 if(!Array.isArray(input?.urls))throw new Error("Enter 1–10 URLs.");
 const urls=[...new Set(input.urls.map(u=>normalizeWebsite(u).href))];if(!urls.length||urls.length>10)throw new Error("Enter 1–10 URLs.");
 const domains=[...new Set(urls.map(u=>new URL(u).hostname))];if(domains.some(d=>!d.includes(".")||/^[\d.]+$/.test(d)))throw new Error("DataForSEO requires public website domain names.");
 const country=String(input.country||"").trim(),language=String(input.language||"").trim();
 if(!/^[\p{L}\p{N} .'-]{2,80}$/u.test(country)||!/^[\p{L} .'-]{2,50}$/u.test(language))throw new Error("Choose the target country and language for this review.");
 return {urls,domains,country,language,backlinks:input.backlinks===true};
}
export function endpointEstimate(prices,limit){
 const rows=prices?.priority_normal;if(!Array.isArray(rows)||!rows.length)throw new Error("Cannot verify current DataForSEO endpoint pricing. Request blocked.");
 let amount=0;for(const row of rows){if(typeof row.cost!=="number"||!Number.isFinite(row.cost)||row.cost<0)throw new Error("Invalid current DataForSEO pricing.");if(row.cost_type==="per_request")amount+=row.cost;else if(row.cost_type==="per_result")amount+=row.cost*limit;else throw new Error("Unsupported DataForSEO pricing unit. Request blocked.");}return amount;
}
export function dataPlan(params,account){
 const tasks=[];for(const target of params.domains){
  for(const [kind,limit] of [["ranked_keywords",20],["competitors_domain",10]])tasks.push({endpoint:`dataforseo_labs/google/${kind}/live`,kind,target,limit,body:[{target,location_name:params.country,language_name:params.language,limit}],estimate:endpointEstimate(account.price?.dataforseo_labs?.[kind]?.live,limit)});
  if(params.backlinks){if(!account.backlinks_subscription_expiry_date||new Date(account.backlinks_subscription_expiry_date)<=new Date())throw new Error("Backlinks API subscription is not confirmed active. Leave backlinks unchecked or enable it in your DataForSEO account.");tasks.push({endpoint:"backlinks/summary/live",kind:"backlinks_summary",target,limit:1,body:[{target}],estimate:endpointEstimate(account.price?.backlinks?.summary?.live,1)});}
 }
 const estimatedUsd=tasks.reduce((n,t)=>n+t.estimate,0);if(estimatedUsd>DATAFORSEO_REVIEW_CAP)throw new Error("This review exceeds the $5 DataForSEO limit.");return {tasks,estimatedUsd};
}
function compact(task,results){
 return results.map(r=>task.kind==="ranked_keywords"?{target:r.target,total_count:r.total_count,items:(r.items||[]).slice(0,20).map(i=>({keyword:i.keyword_data?.keyword,search_volume:i.keyword_data?.keyword_info?.search_volume,keyword_difficulty:i.keyword_data?.keyword_properties?.keyword_difficulty,rank:i.ranked_serp_element?.serp_item?.rank_absolute,url:i.ranked_serp_element?.serp_item?.url,last_updated:i.keyword_data?.keyword_info?.last_updated_time}))}:task.kind==="competitors_domain"?{target:r.target,items:(r.items||[]).slice(0,10).map(i=>({domain:i.domain,avg_position:i.avg_position,intersections:i.intersections_count,organic:i.metrics?.organic}))}:Object.fromEntries(Object.entries(r).filter(([k,v])=>["target","rank","backlinks","referring_domains","referring_main_domains","broken_backlinks","backlinks_spam_score","referring_links_tld"].includes(k))));
}
export class DataForSeo {
 constructor(request=null){this.quotes=new Map();this.request=request||this.api.bind(this);}
 async api(endpoint,body){
  if(!dataforseoConfigured())throw new Error("Save DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD in the server .env and restart.");
  const headers={Authorization:"Basic "+Buffer.from(env("DATAFORSEO_LOGIN")+":"+env("DATAFORSEO_PASSWORD")).toString("base64"),"content-type":"application/json"};
  let response;try{response=await fetch(`https://api.dataforseo.com/v3/${endpoint}`,{method:body?"POST":"GET",headers,body:body?JSON.stringify(body):undefined,redirect:"error",signal:AbortSignal.timeout(90000)});}catch{throw new Error("DataForSEO connection failed. No automatic paid retries were made.");}
  if(!response.ok)throw new Error(`DataForSEO HTTP ${response.status}. Check API access.`);
  let data;try{data=await response.json();}catch{throw new Error("Invalid DataForSEO response; paid retry blocked.");}return data;
 }
 async account(){const r=await this.request("appendix/user_data");if(r.status_code!==20000||r.tasks?.[0]?.status_code!==20000||!r.tasks[0].result?.[0]?.price)throw new Error("DataForSEO account/pricing verification failed.");return r.tasks[0].result[0];}
 async preview(input){const params=normalizeDataRequest(input);const plan=dataPlan(params,await this.account());const id=crypto.randomUUID();const q={id,params,...plan,expires:Date.now()+600000,used:false};this.quotes.set(id,q);return {id,country:params.country,language:params.language,capUsd:5,estimatedUsd:plan.estimatedUsd,expires:q.expires,requests:plan.tasks.map(({endpoint,target,limit,estimate})=>({endpoint,target,limit,estimatedUsd:estimate})),note:"Estimate uses your current account rates and bounded result limits. No paid data calls have been made. Approve this exact request plan to proceed."};}
 async collect(id,input){
  const q=this.quotes.get(id);if(!q||q.used||q.expires<Date.now())throw new Error("DataForSEO preview expired or was already used. Preview again.");
  const params=normalizeDataRequest(input);if(JSON.stringify(params)!==JSON.stringify(q.params))throw new Error("URLs or market settings changed. Preview the updated request plan.");q.used=true;
  const pack={provider:"DataForSEO",country:params.country,language:params.language,retrievedAt:new Date().toISOString(),scope:"Domain-level indexed keyword/competitor data; not Search Console or a complete keyword list. Volume and traffic metrics are provider estimates.",capUsd:5,approvedEstimateUsd:q.estimatedUsd,actualCostUsd:0,reservedCostUsd:0,results:[],errors:[]};
  const directory=path.join(REPO_ROOT,"dataforseo-data");fs.mkdirSync(directory,{recursive:true});const file=path.join(directory,id+".json");
  try { for(const task of q.tasks){
   const current=dataPlan(params,await this.account()).tasks.find(t=>t.endpoint===task.endpoint&&t.target===task.target);
   if(!current||current.estimate>task.estimate+1e-9||pack.actualCostUsd+pack.reservedCostUsd+current.estimate>Math.min(5,q.estimatedUsd)+1e-9){pack.errors.push("Pricing changed or the approved budget would be exceeded; remaining calls blocked.");break;}
   // Reserve this request before posting, because ambiguous errors may still be billed.
   pack.reservedCostUsd+=current.estimate;fs.writeFileSync(file,JSON.stringify(pack,null,2));
   let r;try{r=await this.request(task.endpoint,task.body);}catch(e){pack.errors.push(e.message);break;}
   if(typeof r.cost!=="number"||!Number.isFinite(r.cost)||r.cost<0){pack.errors.push("Actual cost could not be verified; reservation retained and remaining calls blocked.");break;}
   pack.reservedCostUsd-=current.estimate;pack.actualCostUsd+=r.cost;
   fs.writeFileSync(file,JSON.stringify(pack,null,2));
   if(r.status_code!==20000||r.tasks?.[0]?.status_code!==20000){pack.errors.push(`DataForSEO endpoint failed (code ${r.tasks?.[0]?.status_code||r.status_code}); no paid retry.`);break;}
   pack.results.push({endpoint:task.endpoint,target:task.target,costUsd:r.cost,result:compact(task,r.tasks[0].result||[])});
   fs.writeFileSync(file,JSON.stringify(pack,null,2));
   if(pack.actualCostUsd>q.estimatedUsd+1e-9){pack.errors.push("Provider cost exceeded the approved estimate; remaining calls blocked.");break;}
  } } catch(e) { pack.errors.push(e.message); }
  fs.writeFileSync(file,JSON.stringify(pack,null,2));return pack;
 }
}
export const dataforseo=new DataForSeo();

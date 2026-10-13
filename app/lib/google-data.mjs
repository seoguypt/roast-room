import {googleOAuth} from './google-oauth.mjs';
import {normalizeWebsite} from './seo.mjs';
export function propertyContains(site,url){const u=new URL(url);if(site.startsWith('sc-domain:')){const host=site.slice(10).toLowerCase();return u.hostname===host||u.hostname.endsWith('.'+host);}try{const p=new URL(site);return p.origin===u.origin&&u.pathname.startsWith(p.pathname);}catch{return false;}}
export function googleReview(input,urls,now=new Date()){
 const targets=[...new Set(urls.map(u=>normalizeWebsite(u).href))];if(!targets.length||targets.length>10)throw Error('Google reports require 1–10 URLs.');
 const gsc=typeof input?.gscProperty==='string'?input.gscProperty.trim():'',ga4=String(input?.ga4Property||'').trim();if(!gsc&&!ga4)throw Error('Select Search Console and/or a GA4 property.');
 if(gsc&&(!targets.every(u=>propertyContains(gsc,u))||gsc.length>2048))throw Error('All submitted URLs must belong to the selected Search Console property. Review different properties separately.');
 if(ga4&&!/^\d{1,15}$/.test(ga4))throw Error('GA4 property ID must be numeric, not a G- measurement ID.');
 const day=86400000,endDefault=new Date(now.getTime()-3*day).toISOString().slice(0,10),startDefault=new Date(Date.parse(endDefault)-27*day).toISOString().slice(0,10);
 const startDate=input.startDate||startDefault,endDate=input.endDate||endDefault;
 const valid=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
 if(!valid(startDate)||!valid(endDate)||endDate>now.toISOString().slice(0,10)||startDate>endDate)throw Error('Choose a valid past date range.');
 const days=Math.round((Date.parse(endDate)-Date.parse(startDate))/day)+1;if(days>90)throw Error('Google reviews support up to 90 days at a time.');
 return {urls:targets,gscProperty:gsc,ga4Property:ga4,current:{startDate,endDate},previous:{startDate:new Date(Date.parse(startDate)-days*day).toISOString().slice(0,10),endDate:new Date(Date.parse(startDate)-day).toISOString().slice(0,10)}};
}
export function gaFilter(urls){return {andGroup:{expressions:[{filter:{fieldName:'sessionDefaultChannelGroup',stringFilter:{matchType:'EXACT',value:'Organic Search'}}},{orGroup:{expressions:urls.map(raw=>{const u=new URL(raw);return {andGroup:{expressions:[{filter:{fieldName:'hostName',stringFilter:{matchType:'EXACT',value:u.hostname}}},{filter:{fieldName:'landingPage',stringFilter:{matchType:'EXACT',value:u.pathname}}}]}};})}}]}};}
function reportRows(r){return {rows:(r.rows||[]).slice(0,100).map(row=>Object.fromEntries([...(r.dimensionHeaders||[]).map((h,i)=>[h.name,row.dimensionValues?.[i]?.value]),...(r.metricHeaders||[]).map((h,i)=>[h.name,Number(row.metricValues?.[i]?.value)])])),rowCount:r.rowCount||0,metadata:r.metadata||{},scope:'Rows are bounded, aggregate and subject to Google privacy thresholds, modeling, consent and tracking configuration.'};}
export class GoogleData{
 constructor(request=googleOAuth.request.bind(googleOAuth)){this.request=request;}
 async properties(){const out={gsc:[],ga4:[],errors:[]};
  const results=await Promise.allSettled([this.request('https://www.googleapis.com/webmasters/v3/sites'),this.request('https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200')]);
  if(results[0].status==='fulfilled')out.gsc=(results[0].value.siteEntry||[]).filter(s=>s.permissionLevel!=='siteUnverifiedUser').map(s=>({id:s.siteUrl,permission:s.permissionLevel}));else out.errors.push({source:'Search Console',error:results[0].reason.message});
  if(results[1].status==='fulfilled'){for(const a of results[1].value.accountSummaries||[])for(const p of a.propertySummaries||[])out.ga4.push({id:p.property?.replace('properties/',''),name:p.displayName,account:a.displayName});if(results[1].value.nextPageToken)out.errors.push({source:'GA4',error:'Only the first 200 account summaries are listed. Enter another accessible property ID manually.'});}else out.errors.push({source:'GA4 property discovery',error:results[1].reason.message});return out;
 }
 async collect(settings,urls){const params=googleReview(settings,urls);const out={provider:'Google first-party',retrievedAt:new Date().toISOString(),current:params.current,previous:params.previous,geography:'All countries. The advisory target market does not filter these historical reports.',urls:params.urls,gsc:null,ga4:null,errors:[],scope:'GSC reports Google organic search clicks/impressions/average position, not GA4 sessions. GA4 reports Organic Search sessions and tracked key events/revenue, not causal or complete attribution. Empty or missing results do not prove zero demand or conversions.'};
  async function attempt(source,task){try{return await task();}catch(e){out.errors.push({source,error:e.message});return null;}}
  if(params.gscProperty){const endpoint='https://www.googleapis.com/webmasters/v3/sites/'+encodeURIComponent(params.gscProperty)+'/searchAnalytics/query';const filter='^(?:'+params.urls.map(u=>u.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+')$';
   out.gsc={property:params.gscProperty,scope:'Web search, final data, exact submitted URLs. Top query rows can omit anonymized/low-volume queries; average position is historical and aggregated, not a live rank.',periods:{},indexing:[]};
   for(const [name,range]of Object.entries({current:params.current,previous:params.previous})){const base={...range,type:'web',dataState:'final',dimensionFilterGroups:[{filters:[{dimension:'page',operator:'includingRegex',expression:filter}]}]};
    const pages=await attempt('GSC '+name+' pages',()=>this.request(endpoint,{...base,dimensions:['page'],rowLimit:10}));const queries=await attempt('GSC '+name+' queries',()=>this.request(endpoint,{...base,dimensions:['query','page'],rowLimit:100}));
    out.gsc.periods[name]={pages:pages?.rows||null,queries:queries?.rows||null};
   }
   for(const url of params.urls){const r=await attempt('GSC indexing '+url,()=>this.request('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect',{inspectionUrl:url,siteUrl:params.gscProperty,languageCode:'en-US'}));if(r)out.gsc.indexing.push({url,indexStatus:r.inspectionResult?.indexStatusResult||{},richResults:r.inspectionResult?.richResultsResult||{},scope:'Google stored index inspection; not a live crawl or indexing request.'});}
  }
  if(params.ga4Property){const endpoint=`https://analyticsdata.googleapis.com/v1beta/properties/${params.ga4Property}:runReport`,filter=gaFilter(params.urls);
   out.ga4={property:params.ga4Property,scope:'Organic Search sessions landing on exact submitted hostnames and URL paths; URL query strings are merged. Includes tracked key events (leads only if configured), ecommerce purchases and purchase revenue in the property currency.',periods:{}};
   for(const [name,range]of Object.entries({current:params.current,previous:params.previous})){const r=await attempt('GA4 '+name+' landing pages',()=>this.request(endpoint,{dateRanges:[range],dimensions:[{name:'hostName'},{name:'landingPage'}],metrics:['sessions','engagedSessions','keyEvents','ecommercePurchases','purchaseRevenue','sessionKeyEventRate'].map(name=>({name})),dimensionFilter:filter,limit:'100',returnPropertyQuota:true}));out.ga4.periods[name]=r?reportRows(r):null;}
   const events=await attempt('GA4 tracked key events',()=>this.request(endpoint,{dateRanges:[params.current],dimensions:[{name:'hostName'},{name:'landingPage'},{name:'eventName'}],metrics:[{name:'keyEvents'},{name:'eventCount'}],dimensionFilter:filter,metricFilter:{filter:{fieldName:'keyEvents',numericFilter:{operation:'GREATER_THAN',value:{int64Value:'0'}}}},limit:'100'}));out.ga4.keyEvents=events?reportRows(events):null;
  }return out;
 }
}
export const googleData=new GoogleData();

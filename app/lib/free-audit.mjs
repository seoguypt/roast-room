import {load} from 'cheerio';
import {XMLValidator} from 'fast-xml-parser';
import {fetchPublic,extractPage,allowsSample,normalizeWebsite} from './seo.mjs';
import {browserAudit} from './audit-browser.mjs';
import {assertCrawlable,isAffiliatePath} from './crawl-policy.mjs';
export function schemaChecks(html,url){
 const $=load(html),issues=[];let blocks=0;
 $('script[type="application/ld+json"]').each((index,el)=>{blocks++;try{const root=JSON.parse($(el).text());
  const walk=(v,location)=>{if(!v||typeof v!=='object')return;if(Array.isArray(v)){v.forEach((n,i)=>walk(n,location+'['+i+']'));return;}
   if('@type' in v&&!(typeof v['@type']==='string'||(Array.isArray(v['@type'])&&v['@type'].every(t=>typeof t==='string'))))issues.push({url,block:index+1,path:location,issue:'@type must be a string or array of strings'});
   for(const k of ['url','@id'])if(typeof v[k]==='string'&&!v[k].startsWith('_:'))try{new URL(v[k],url);}catch{issues.push({url,block:index+1,path:location+'.'+k,issue:'Invalid URL reference'});}
   for(const [k,n]of Object.entries(v))if(typeof n==='object')walk(n,location+'.'+k);
  };walk(root,'$');if(!root||typeof root!=='object')issues.push({url,block:index+1,issue:'JSON-LD root is not an object or array'});
 }catch{issues.push({url,block:index+1,issue:'Invalid JSON syntax'});}});
 return {url,blocks,issues,scope:'JSON syntax, type shape and URL-reference checks; not exhaustive Schema.org vocabulary or Google rich-result eligibility validation.'};
}
export function sitemapEntries(xml,base){
 const validity=XMLValidator.validate(xml);if(validity!==true)return {kind:'invalid',entries:[],issues:[{url:base,issue:`Malformed XML: ${validity.err.msg} (line ${validity.err.line})`}]};
 const $=load(xml,{xmlMode:true});const kind=$('sitemapindex').length?'index':$('urlset').length?'urlset':'invalid';
 const entries=[];const issues=[];$('loc').each((_i,n)=>{const raw=$(n).text().trim();try{if(isAffiliatePath(new URL(raw).pathname)){issues.push({url:raw,issue:'Excluded affiliate URL: never fetched'});return;}const url=normalizeWebsite(raw);if(!/^https?:\/\//i.test(raw))throw Error();entries.push(url.href);if(url.origin!==new URL(base).origin)issues.push({url:raw,issue:'Cross-origin sitemap URL; verify ownership and sitemap scope'});}catch{issues.push({url:raw,issue:'Invalid or non-absolute sitemap URL'});}});
 if(kind==='invalid')issues.push({url:base,issue:'Expected urlset or sitemapindex root'});if(!entries.length)issues.push({url:base,issue:'No usable loc entries'});if(new Set(entries).size<entries.length)issues.push({url:base,issue:'Duplicate loc entries'});
 return {kind,entries,issues};
}
export async function freeAudit(evidence,{read=fetchPublic,browser=browserAudit,onProgress=()=>{},maxPages=20,maxLinks=50,maxBrowserPages=3}={}){
 const pack={checkedAt:new Date().toISOString(),limits:{maxPages,maxLinks,maxBrowserPages,sitemapUrls:20},pages:[],links:[],sitemaps:[],structuredData:[],browser:[],errors:[]};
 const cache=new Map();const get=async url=>{assertCrawlable(url);if(!cache.has(url))cache.set(url,read(url));const result=await cache.get(url);assertCrawlable(result.url);return result;};
 const robots=new Map((evidence.sites||[]).map(s=>[new URL(s.submittedUrl).origin,s.robots]));
 for(const [origin,r]of robots)if(r?.status===200)try{const full=await get(origin+'/robots.txt');robots.set(origin,{status:full.status,excerpt:full.body});}catch{robots.set(origin,{status:0});}
 const allowed=url=>{const u=new URL(url),r=robots.get(u.origin);return r&&(r.status===200||r.status===404)&&allowsSample(r.status===200?r.excerpt||'':'',u.pathname);};
 const queue=[...(evidence.submittedUrls||evidence.pages.map(p=>p.url))],seen=new Set();
 while(queue.length&&seen.size<maxPages){const url=queue.shift();if(seen.has(url)||!allowed(url))continue;seen.add(url);onProgress(`Crawling ${url} (${seen.size}/${maxPages})`);
  try{const r=await get(url);const item={requestedUrl:url,url:r.url,status:r.status,redirectChain:r.redirectChain||[]};
   if(r.status>=200&&r.status<300&&/text\/html/i.test(r.headers['content-type']||'')){const p=extractPage(r);Object.assign(item,{title:p.title,canonical:p.canonical,robotsMeta:p.robotsMeta,internalLinks:p.internalLinks});pack.structuredData.push(schemaChecks(r.body,r.url));
    if(!evidence.pages.some(x=>x.url===p.url))evidence.pages.push({...p,textExcerpt:p.textExcerpt.slice(0,1500)});
    for(const l of p.internalLinks)if(!seen.has(l.url)&&!new URL(l.url).search&&!/\.(pdf|png|jpg|zip|mp4|xml)$/i.test(new URL(l.url).pathname)&&queue.length<100)queue.push(l.url);
   }pack.pages.push(item);
  }catch(e){pack.errors.push({url,stage:'crawl',error:e.message});}
 }
 const sources=new Map();for(const p of pack.pages)for(const l of p.internalLinks||[]){if(sources.size>=maxLinks&&!sources.has(l.url))continue;if(!sources.has(l.url))sources.set(l.url,[]);sources.get(l.url).push(p.url);}
 for(const p of pack.pages)if(p.canonical&&sources.size<maxLinks)try{const u=normalizeWebsite(new URL(p.canonical,p.url).href).href;if(!sources.has(u))sources.set(u,[p.url]);}catch{}
 for(const [url,from]of sources){if(isAffiliatePath(new URL(url).pathname)){pack.links.push({url,from,status:'Excluded affiliate link: never fetched'});continue;}if(!allowed(url)){pack.links.push({url,from,status:'Skipped: robots unavailable or disallowed'});continue;}onProgress(`Checking internal link ${pack.links.length+1}/${sources.size}`);try{const r=await get(url);pack.links.push({url,from,status:r.status,finalUrl:r.url,redirectChain:r.redirectChain||[]});}catch(e){pack.links.push({url,from,error:e.message});}}
 const sitemapSeen=new Set();let sitemapChecks=0;
 for(const site of evidence.sites||[]){const resource=site.sitemap;if(resource?.status!==200||sitemapSeen.has(resource.url))continue;sitemapSeen.add(resource.url);try{const r=await get(resource.url);let parsed=sitemapEntries(r.body,r.url);let entries=parsed.entries;
  if(parsed.kind==='index'){entries=[];for(const child of parsed.entries.slice(0,2)){if(new URL(child).origin!==new URL(site.submittedUrl).origin)continue;const c=await get(child);const cp=sitemapEntries(c.body,c.url);pack.sitemaps.push({url:child,status:c.status,kind:cp.kind,issues:cp.issues,totalEntries:cp.entries.length});if(cp.kind==='urlset')entries.push(...cp.entries);}}
  const checks=[];for(const url of [...new Set(entries)].slice(0,Math.max(0,20-sitemapChecks))){sitemapChecks++;if(!allowed(url)){checks.push({url,skipped:'Robots unavailable, disallowed or outside reviewed origin'});continue;}try{const c=await get(url);checks.push({url,status:c.status,finalUrl:c.url,redirectChain:c.redirectChain||[]});}catch(e){checks.push({url,error:e.message});}}
  pack.sitemaps.push({url:resource.url,kind:parsed.kind,totalEntries:parsed.entries.length,issues:parsed.issues,checks});
 }catch(e){pack.errors.push({url:resource.url,stage:'sitemap',error:e.message});}}
 for(const p of evidence.pages.slice(0,maxBrowserPages)){if(!allowed(p.url))continue;onProgress(`Browser and Lighthouse: ${p.url}`);try{const b=await browser(p.url,{onProgress});b.comparison={sourceTitle:p.title,renderedTitle:b.rendered.title,sourceCanonical:p.canonical,renderedCanonical:b.rendered.canonical,sourceH1Count:p.h1Count,renderedH1Count:b.rendered.h1Count,sourceWordCount:p.wordCount,renderedWordCount:b.rendered.wordCount,textChanged:p.textExcerpt!==b.rendered.textExcerpt};pack.browser.push(b);}catch(e){pack.errors.push({url:p.url,stage:'browser/Lighthouse',error:e.message});}}
 const incoming=new Map();for(const l of pack.links)for(const from of new Set(l.from)){if(!incoming.has(l.url))incoming.set(l.url,new Set());incoming.get(l.url).add(from);}
 pack.internalLinking=pack.pages.map(p=>({url:p.url,incomingFromCrawledPages:incoming.get(p.url)?.size||0,outgoingSampled:p.internalLinks?.length||0}));
 pack.scope='Bounded public-site crawl and internal-link/sitemap samples. Affiliate /go/ URLs are deliberately excluded, not broken-link findings. Zero observed incoming links does not prove an orphan page. Browser/Lighthouse failures are unknown, not passes. Lighthouse is lab data, not field Core Web Vitals.';return pack;
}

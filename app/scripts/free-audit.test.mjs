import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {freeAudit,schemaChecks,sitemapEntries} from '../lib/free-audit.mjs';
import {safeProxy} from '../lib/audit-browser.mjs';
import {auditFindings} from '../lib/seo-findings.mjs';
const root='https://example.com/';
test('bounded crawl preserves broken links, redirect chains, duplicates, render differences and schema evidence',async()=>{
 const calls=[];const read=async url=>{calls.push(url);let body='<html><title>Shared title</title><h1>Title</h1><a href="/other">Other</a><a href="/missing">Missing</a><script type="application/ld+json">{"@type":42}</script></html>',status=200,final=url,redirectChain=[];
 if(url.endsWith('robots.txt'))body='User-agent: *\nDisallow: /private';if(url.endsWith('sitemap.xml'))body='<urlset><url><loc>https://example.com/missing</loc></url></urlset>';if(url.endsWith('/missing'))status=404;if(url.endsWith('/other')){final=root+'final';redirectChain=[{from:url,to:final}];}return {url:final,status,body,headers:{'content-type':'text/html'},redirectChain};};
 const evidence={submittedUrls:[root],pages:[{url:root,title:'Shared title',canonical:'',h1Count:1,wordCount:2,textExcerpt:'Title'}],sites:[{submittedUrl:root,robots:{status:200},sitemap:{status:200,url:root+'sitemap.xml'}}]};
 const browser=async url=>({url,rendered:{title:'Rendered title',canonical:'',h1Count:1,wordCount:2,textExcerpt:'Title'},lighthouse:{categories:{performance:.9}}});
 evidence.freeChecks=await freeAudit(evidence,{read,browser,maxPages:3,maxLinks:2,maxBrowserPages:1});const p=evidence.freeChecks;
 assert.equal(p.pages.length,3);assert.equal(p.links.length,2);assert.equal(p.browser.length,1);assert.equal(p.links.find(l=>l.url.endsWith('/missing')).status,404);assert.equal(p.sitemaps[0].checks[0].status,404);assert.equal(p.structuredData[0].issues[0].issue,'@type must be a string or array of strings');assert.ok(p.pages.find(p=>p.redirectChain.length));assert.equal(calls.filter(u=>u===root+'missing').length,1);
 const findings=auditFindings(evidence).findings;assert.ok(findings.some(f=>f.category==='Broken internal link'));assert.ok(findings.some(f=>f.category==='Rendering'));assert.ok(findings.some(f=>f.observation.includes('Same title')));
});
test('sitemap and JSON-LD validation expose precise errors without eligibility claims',()=>{
 assert.equal(schemaChecks('<script type="application/ld+json">{oops</script>',root).issues[0].issue,'Invalid JSON syntax');
 const s=sitemapEntries('<urlset><url><loc>/relative</loc></url><url><loc>https://other.com/</loc></url></urlset>',root);assert.equal(s.issues.length,2);assert.match(schemaChecks('',root).scope,/not exhaustive/);
 assert.match(sitemapEntries('<urlset><url></urlset>',root).issues[0].issue,/Malformed XML/);
});
test('robots disallow prevents linked fetches and browser audit',async()=>{
 const called=[];const read=async url=>{called.push(url);return {url,status:200,headers:{'content-type':'text/html'},body:url.endsWith('robots.txt')?'Disallow: /': '<title>Test</title>'};};
 const e={submittedUrls:[root],pages:[{url:root}],sites:[{submittedUrl:root,robots:{status:200}}]};const r=await freeAudit(e,{read,browser:async()=>{throw Error('Must not run');}});assert.equal(r.pages.length,0);assert.equal(r.browser.length,0);assert.deepEqual(called,[root+'robots.txt']);
});
test('browser proxy rejects local destinations before forwarding',async()=>{
 const proxy=await safeProxy();try{const status=await new Promise((resolve,reject)=>{const req=http.get({host:'127.0.0.1',port:proxy.port,path:'http://127.0.0.1/'},r=>{r.resume();resolve(r.statusCode);});req.on('error',reject);});assert.equal(status,403);
 const status2=await new Promise((resolve,reject)=>{const req=http.request({host:'127.0.0.1',port:proxy.port,method:'CONNECT',path:'127.0.0.1:443'});req.on('connect',(res,s)=>{s.destroy();resolve(res.statusCode);});req.on('error',reject);req.end();});assert.equal(status2,403);
 }finally{await proxy.close();}
});

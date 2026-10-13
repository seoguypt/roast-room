import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DataForSeo, endpointEstimate } from '../lib/dataforseo.mjs';
import { REPO_ROOT } from '../lib/env.mjs';
const input={urls:['https://example.com/'],country:'United States',language:'English'};
function account(rate=.012){return {status_code:20000,tasks:[{status_code:20000,result:[{price:{dataforseo_labs:Object.fromEntries(['ranked_keywords','competitors_domain'].map(k=>[k,{live:{priority_normal:[{cost_type:'per_request',cost:rate},{cost_type:'per_result',cost:.00012}]}}]))}}]}]};}
const success={status_code:20000,cost:.012,tasks:[{status_code:20000,result:[]}]};
const cleanup=q=>fs.rmSync(path.join(REPO_ROOT,'dataforseo-data',q.id+'.json'),{force:true});
test('preview is uncharged, binds the market and allows one collection',async()=>{
 let posts=0;const d=new DataForSeo(async(e)=>e==='appendix/user_data'?account():(posts++,success));
 const q=await d.preview(input);assert.equal(posts,0);assert.ok(q.estimatedUsd<5);
 await assert.rejects(d.collect(q.id,{...input,country:'Romania'}),/changed/);assert.equal(posts,0);
 try {const p=await d.collect(q.id,input);assert.equal(posts,2);assert.equal(p.actualCostUsd,.024);await assert.rejects(d.collect(q.id,input),/already used/);}finally{cleanup(q);}
});
test('unsupported prices and plans above cap fail closed',async()=>{
 assert.throws(()=>endpointEstimate({priority_normal:[{cost_type:'unknown',cost:1}]},20),/Unsupported/);
 const d=new DataForSeo(async()=>account(3));await assert.rejects(d.preview(input),/exceeds/);
});
test('price increase blocks paid collection',async()=>{
 let reads=0,posts=0;const d=new DataForSeo(async(e)=>e==='appendix/user_data'?account(++reads===1?.012:.02):(posts++,success));
 const q=await d.preview(input);try{const p=await d.collect(q.id,input);assert.equal(posts,0);assert.match(p.errors[0],/Pricing changed/);}finally{cleanup(q);}
});
test('ambiguous billed failure retains reservation without retry',async()=>{
 let posts=0;const d=new DataForSeo(async(e)=>{if(e==='appendix/user_data')return account();posts++;throw new Error('Connection failed');});
 const q=await d.preview(input);try{const p=await d.collect(q.id,input);assert.equal(posts,1);assert.ok(p.reservedCostUsd>0);assert.equal(p.results.length,0);}finally{cleanup(q);}
});
test('account failure after a paid result preserves partial evidence and cost',async()=>{
 let reads=0;const d=new DataForSeo(async(e)=>{if(e!=='appendix/user_data')return success;if(++reads===3)throw new Error('Account unavailable');return account();});
 const q=await d.preview(input);try{const p=await d.collect(q.id,input);assert.equal(p.results.length,1);assert.equal(p.actualCostUsd,.012);assert.match(p.errors[0],/Account unavailable/);const saved=JSON.parse(fs.readFileSync(path.join(REPO_ROOT,'dataforseo-data',q.id+'.json')));assert.equal(saved.results.length,1);}finally{cleanup(q);}
});

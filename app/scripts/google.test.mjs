import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {EventEmitter} from 'node:events';
import {GoogleOAuth,GoogleTokenStore,GOOGLE_SCOPES} from '../lib/google-oauth.mjs';
import {GoogleData,googleReview,gaFilter,propertyContains} from '../lib/google-data.mjs';
function memory(){let data;return {exists:()=>Boolean(data),read:async()=>data,write:async v=>data=v,clear:()=>data=null};}
function oauthFixture(scope=GOOGLE_SCOPES.join(' ')){
 const store=memory();let exchanges=0;const client=new EventEmitter();client.generateCodeVerifierAsync=async()=>({codeVerifier:'private-verifier',codeChallenge:'challenge'});client.generateAuthUrl=args=>'https://accounts.google.com/o/oauth2/v2/auth?'+new URLSearchParams({...args,scope:args.scope.join(' ')});client.getToken=async args=>{exchanges++;assert.equal(args.codeVerifier,'private-verifier');return {tokens:{refresh_token:'private-refresh',access_token:'private-access',scope}};};client.setCredentials=()=>{};client.revokeToken=async()=>{};return {auth:new GoogleOAuth({store,clientFactory:()=>client}),store,exchanges:()=>exchanges};
}
test('Google OAuth requests read-only scopes and PKCE; callback binds cookie/state and is single-use',async()=>{
 const f=oauthFixture(),a=await f.auth.begin(),url=new URL(a.url),state=url.searchParams.get('state');assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert.ok(GOOGLE_SCOPES.every(s=>s.endsWith('.readonly')));
 await assert.rejects(f.auth.finish({state,code:'code',cookie:'wrong'}),/verified/);assert.equal(f.exchanges(),0);
 await f.auth.finish({state,code:'code',cookie:a.cookie});assert.equal(f.auth.status().connected,true);assert.ok(!JSON.stringify(f.auth.status()).includes('private-refresh'));
 await assert.rejects(f.auth.finish({state,code:'code',cookie:a.cookie}),/verified/);assert.equal(f.exchanges(),1);await f.auth.disconnect();assert.equal(f.auth.status().connected,false);
});
test('partial consent and cancelled login do not save tokens',async()=>{
 const f=oauthFixture(GOOGLE_SCOPES[0]),a=await f.auth.begin();await assert.rejects(f.auth.finish({state:new URL(a.url).searchParams.get('state'),code:'code',cookie:a.cookie}),/Both read-only/);assert.equal(f.store.exists(),false);
 const g=oauthFixture(),b=await g.auth.begin();await g.auth.disconnect();await assert.rejects(g.auth.finish({state:new URL(b.url).searchParams.get('state'),code:'code',cookie:b.cookie}),/verified/);assert.equal(g.exchanges(),0);
});
test('saved Google tokens are encrypted at rest and round-trip without plaintext',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'roast-google-test-')),s=new GoogleTokenStore(dir);try{await s.write({refresh_token:'TEST_TOKEN_NEVER_PLAINTEXT'});assert.equal(fs.readFileSync(s.file).includes(Buffer.from('TEST_TOKEN_NEVER_PLAINTEXT')),false);assert.equal((await s.read()).refresh_token,'TEST_TOKEN_NEVER_PLAINTEXT');s.clear();assert.equal(s.exists(),false);}finally{for(const name of ['tokens.enc','tokens.enc.tmp','key'])fs.rmSync(path.join(dir,name),{force:true});fs.rmdirSync(dir);}
});
test('Google report validation binds properties, real dates, bounded ranges and preceding periods',()=>{
 assert.equal(propertyContains('sc-domain:example.com','https://otherexample.com/'),false);assert.equal(propertyContains('sc-domain:example.com','https://shop.example.com/'),true);assert.equal(propertyContains('https://example.com/blog/','https://example.com/blog2/'),false);
 assert.throws(()=>googleReview({gscProperty:'sc-domain:other.com'},['https://example.com/']),/belong/);assert.throws(()=>googleReview({ga4Property:'G-ABC'},['https://example.com/']),/numeric/);assert.throws(()=>googleReview({ga4Property:'123',startDate:'2026-02-30'},['https://example.com/']),/valid/);
 const p=googleReview({ga4Property:'123',startDate:'2026-09-01',endDate:'2026-09-28'},['https://example.com/'],new Date('2026-10-13'));assert.deepEqual(p.previous,{startDate:'2026-08-04',endDate:'2026-08-31'});
 const filter=JSON.stringify(gaFilter(['https://example.com/blog/?x=1']));assert.match(filter,/Organic Search/);assert.match(filter,/example.com/);assert.match(filter,/landingPage/);assert.ok(!filter.includes('x=1'));
});
test('Google evidence uses bounded read reports and preserves partial failures as unknown',async()=>{
 const calls=[];const g=new GoogleData(async(url,body)=>{calls.push({url,body});if(url.includes('index:inspect'))throw Error('No inspection permission');if(url.includes('searchAnalytics'))return {rows:[{keys:['https://example.com/'],clicks:7,impressions:100,ctr:.07,position:8}]};return {dimensionHeaders:[{name:'hostName'},{name:'landingPage'}],metricHeaders:[{name:'sessions'}],rows:[{dimensionValues:[{value:'example.com'},{value:'/'}],metricValues:[{value:'12'}]}],rowCount:1,metadata:{currencyCode:'USD'}};});
 const r=await g.collect({gscProperty:'sc-domain:example.com',ga4Property:'123',startDate:'2026-09-01',endDate:'2026-09-28'},['https://example.com/']);assert.equal(calls.length,8);assert.equal(r.gsc.periods.current.pages[0].clicks,7);assert.equal(r.ga4.periods.current.rows[0].sessions,12);assert.equal(r.gsc.indexing.length,0);assert.equal(r.errors.length,1);assert.match(r.scope,/Empty or missing/);assert.ok(calls.filter(c=>c.url.includes('searchAnalytics')).every(c=>c.body.dataState==='final'&&c.body.rowLimit<=100));assert.ok(calls.every(c=>!c.url.includes('indexing.googleapis')));
});
test('property discovery isolates errors between Search Console and Analytics',async()=>{const g=new GoogleData(async url=>{if(url.includes('webmasters'))throw Error('Missing permission');return {accountSummaries:[{displayName:'Owner',propertySummaries:[{property:'properties/123',displayName:'Site'}]}]};});const p=await g.properties();assert.equal(p.gsc.length,0);assert.equal(p.ga4[0].id,'123');assert.equal(p.errors.length,1);});

import test from 'node:test';
import assert from 'node:assert/strict';
import { workspaceFetch } from '../public/workspace-fetch.js';

test('Voice requests handle expired workspace authentication separately from model failures',async()=>{
  const originalFetch=globalThis.fetch, originalWindow=globalThis.window, redirects=[];
  globalThis.window={location:{assign:path=>redirects.push(path)}};
  try {
    globalThis.fetch=async()=>Response.json({error:'Sign in to the advisory workspace.'},{status:401});
    await assert.rejects(workspaceFetch('/api/tts/status'),/workspace session expired/);
    await assert.rejects(workspaceFetch('/api/tts/speech',{method:'POST'}),/Sign in again/);
    assert.deepEqual(redirects,['/?signin=expired']);
    globalThis.fetch=async()=>Response.json({error:'Model unavailable'},{status:503});
    assert.equal((await workspaceFetch('/api/tts/status')).status,503);
    globalThis.fetch=async()=>Response.json({status:'ready'});
    assert.equal((await workspaceFetch('/api/tts/status')).status,200);
  }finally{globalThis.fetch=originalFetch;if(originalWindow===undefined)delete globalThis.window;else globalThis.window=originalWindow;}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {CODEX_MODEL,codexArgs,codexEnvironment,parseCodexOutput} from '../lib/codex.mjs';

test('Codex pins the requested model and subscription-only, restricted execution',()=>{
 const args=codexArgs('/fixture/schema.json');
 assert.equal(CODEX_MODEL,'gpt-6.1-sol');assert.equal(args[args.indexOf('--model')+1],CODEX_MODEL);
 assert.ok(args.includes('forced_login_method="chatgpt"'));assert.ok(args.includes('--ignore-user-config'));
 assert.equal(args[args.indexOf('--sandbox')+1],'read-only');assert.ok(args.includes('shell_tool'));assert.ok(args.includes('multi_agent'));
 assert.ok(!args.some(a=>a.includes('dangerously')));assert.ok(args.includes('/fixture/schema.json'));
 const env=codexEnvironment({PATH:'safe-path',OPENAI_API_KEY:'secret',CODEX_API_KEY:'secret',NARA_API_KEY:'secret',GOOGLE_CLIENT_SECRET:'secret',APP_ACCESS_PASSWORD:'secret',DATAFORSEO_PASSWORD:'secret',HF_TOKEN:'secret'});
 assert.equal(env.PATH,'safe-path');assert.deepEqual(Object.keys(env).sort(),['CODEX_HOME','PATH']);
});
test('Codex accepts completed messages only and reports failures without leaking raw errors',()=>{
 const out=parseCodexOutput(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'{"opinion":"Useful"}'}})+'\n'+JSON.stringify({type:'turn.completed',usage:{input_tokens:23,output_tokens:5}}));
 assert.equal(out.text,'{"opinion":"Useful"}');assert.equal(out.usage.input_tokens,23);
 assert.throws(()=>parseCodexOutput(JSON.stringify({type:'turn.failed',error:{message:'secret diagnostic'}})),e=>!e.message.includes('secret diagnostic')&&e.message.includes('no alternate model'));
 assert.throws(()=>parseCodexOutput(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'incomplete'}})),/incomplete answer/);
});

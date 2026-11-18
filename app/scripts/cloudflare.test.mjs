import test from 'node:test';
import assert from 'node:assert/strict';
import {allowedStatePath,sameSecret} from '../../cloudflare/state-policy.mjs';
test('Cloudflare state bridge admits only app state, never arbitrary paths or model config',()=>{
 for(const p of ['tts/assignments.json','tts/clone-'+'a'.repeat(32)+'.safetensors','google/key','google/tokens.enc','codex/auth.json','sessions/2026-11-18-example/growth.json'])assert.equal(allowedStatePath(p),true,p);
 for(const p of ['../.env','/data/google/key','google/../key','codex/config.toml','sessions/../../etc/passwd','tts/key.wav','google/key/extra','google/key\n'])assert.equal(allowedStatePath(p),false,p);
 const secret='Bearer '+'x'.repeat(48);assert.ok(sameSecret(secret,secret));assert.ok(!sameSecret(secret+'x',secret));assert.ok(!sameSecret('Bearer wrong',secret));assert.ok(!sameSecret('',''));
});

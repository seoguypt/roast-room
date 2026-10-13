import test from "node:test";
import assert from "node:assert/strict";
import { LocalSpeech } from "../public/tts.js";
class Context {
  currentTime = 0;
  resume() { return Promise.resolve(); }
  createBuffer(_channels, count, rate) { return { duration: count / rate, copyToChannel() {} }; }
  createBufferSource() { return { playbackRate: {}, connect() {}, start() {}, stop() { this.stopped = true; } }; }
  destination = {};
}
test("Pocket streaming playback, voice assignment, errors and cancellation", async () => {
  const original = { fetch: globalThis.fetch, AudioContext: globalThis.AudioContext };
  globalThis.AudioContext = Context;
  try {
    const speech = new LocalSpeech(); speech.catalog = [{voiceURI:"alba"},{voiceURI:"marius"}];
    globalThis.fetch = async () => { assert.fail("Muted speech must not request inference"); };
    assert.equal(await speech.say("Muted"), false);
    speech.enabled = true; speech.assignments.julian = "clone-fixture";
    globalThis.fetch = async (_url, options) => {
      assert.equal(JSON.parse(options.body).voice, "clone-fixture");
      assert.equal(JSON.parse(options.body).stream, true);
      const pcm = new Uint8Array(new Float32Array([.1,.2,.3,.4]).buffer);
      return new Response(new ReadableStream({start(c){c.enqueue(pcm.slice(0,3));c.enqueue(pcm.slice(3));c.close();}}),{headers:{"X-Sample-Rate":"24000"}});
    };
    assert.equal(await speech.say("Hello", {key:"julian"}), true);
    const errors=[];
    globalThis.fetch = async () => Response.json({error:"Model unavailable"},{status:503});
    assert.equal(await speech.say("Failed",{onError:e=>errors.push(e)}),false); assert.deepEqual(errors,["Model unavailable"]);
    globalThis.fetch = async () => new Response(new Uint8Array([0,1,2]),{headers:{"X-Sample-Rate":"24000"}});
    assert.equal(await speech.say("Truncated",{onError:e=>errors.push(e)}),false); assert.match(errors.at(-1),/incomplete/);
    globalThis.fetch = (_url, options) => new Promise((_resolve,reject)=>options.signal.addEventListener("abort",()=>reject(new DOMException("Cancelled","AbortError"))));
    const pending=speech.say("Cancel"); speech.cancel(); assert.equal(await pending,false); assert.equal(speech.pending,null);
  } finally { Object.assign(globalThis,original); }
});

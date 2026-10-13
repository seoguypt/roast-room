import test from "node:test";
import assert from "node:assert/strict";
import { checkFreePlan, NARA_FREE_MODELS, NARA_DEFAULT_MODEL, NARA_PLANS } from "../lib/nara.mjs";

process.env.AI_PROVIDER = "nara";
process.env.NARA_API_KEY = "test-nara-key";
process.env.OMNIROUTE_BASE_URL = "https://paid.example/v1";
const ai = await import("../lib/ai.mjs");
const freePlan = () => ({ data: [{ code: "free", is_active: true, price_daily_idr: 0, price_weekly_idr: 0, models: [...NARA_FREE_MODELS] }] });
const args = { model: NARA_DEFAULT_MODEL, system: "Chair", prompt: "Decide", schema: ai.S.obj({ label: ai.S.enum("GO") }) };

test("Free-only policy rejects routers, paid aliases, missing plans, changed prices and removed models", () => {
  checkFreePlan(NARA_DEFAULT_MODEL, freePlan());
  for (const model of ["auto", "auto/bynara", "gpt-5.6-sol", "made-up-free"]) assert.throws(() => checkFreePlan(model, freePlan()), /blocks/);
  for (const catalog of [{}, { data: [] }, { data: [{ ...freePlan().data[0], is_active: false }] }, { data: [{ ...freePlan().data[0], price_daily_idr: 1 }] }, { data: [{ ...freePlan().data[0], price_weekly_idr: 1 }] }, { data: [{ ...freePlan().data[0], models: [] }] }]) {
    assert.throws(() => checkFreePlan(NARA_DEFAULT_MODEL, catalog), /no paid fallback/);
  }
});

test("Paid model is blocked before any network request", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => { assert.fail("No network request allowed"); };
  try { await assert.rejects(ai.json({ ...args, model: "auto/bynara" }), /blocks/); }
  finally { globalThis.fetch = original; }
});

test("NaraRouter verifies live Free plan then calls only its fixed endpoint with the free alias", async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push(url);
    if (url === NARA_PLANS) return Response.json(freePlan());
    assert.equal(url, "https://router.bynara.id/v1/chat/completions");
    assert.equal(options.headers.Authorization, "Bearer test-nara-key");
    assert.equal(options.redirect, "error");
    assert.equal(JSON.parse(options.body).model, NARA_DEFAULT_MODEL);
    assert.equal(JSON.parse(options.body).reasoning_effort, "none");
    assert.deepEqual(JSON.parse(options.body).response_format, { type: "json_object" });
    return Response.json({ choices: [{ finish_reason: "stop", message: { content: '{"label":"GO"}' } }] });
  };
  try { assert.deepEqual(await ai.json(args), { label: "GO" }); assert.equal(calls.length, 2); }
  finally { globalThis.fetch = original; }
});

test("Unverifiable pricing blocks inference", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async url => { assert.equal(url, NARA_PLANS); return Response.json({ data: [] }); };
  try { await assert.rejects(ai.json(args), /no paid fallback/); }
  finally { globalThis.fetch = original; }
});

test("Exhausted free quota stops without retries or alternative models", async () => {
  const original = globalThis.fetch;
  let inferenceCalls = 0;
  globalThis.fetch = async url => {
    if (url === NARA_PLANS) return Response.json(freePlan());
    inferenceCalls++;
    return new Response("quota exhausted", { status: 429 });
  };
  try { await assert.rejects(ai.json(args), /no paid fallback/); assert.equal(inferenceCalls, 1); }
  finally { globalThis.fetch = original; }
});

test("Nara structured reports stream JSON with free-model and reasoning controls",async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{if(url===NARA_PLANS)return Response.json(freePlan());const body=JSON.parse(options.body);assert.equal(body.stream,true);assert.equal(body.reasoning_effort,"none");assert.deepEqual(body.response_format,{type:"json_object"});return new Response('data: '+JSON.stringify({choices:[{delta:{content:'{"label":"GO"}'},finish_reason:"stop"}]})+'\n\ndata: [DONE]\n\n',{headers:{"content-type":"text/event-stream"}});};
 try{assert.deepEqual(await ai.json({...args,streaming:true}),{label:"GO"});}finally{globalThis.fetch=original;}
});

test("Growth provider fallback uses only the other verified-free alias and stops on quota",async()=>{
 const {growthJson}=await import("../lib/growth.mjs");const original=globalThis.fetch;let models=[],quota=false;
 globalThis.fetch=async(url,options)=>{if(url===NARA_PLANS)return Response.json(freePlan());const body=JSON.parse(options.body);models.push(body.model);if(quota)return new Response("quota",{status:429});if(models.length===1)return Response.json({error:{code:"upstream_error"}});return Response.json({choices:[{finish_reason:"stop",message:{content:'{"label":"GO"}'}}]});};
 try{assert.deepEqual(await growthJson(args),{label:"GO"});assert.deepEqual(models,[NARA_DEFAULT_MODEL,NARA_FREE_MODELS[1]]);quota=true;models=[];await assert.rejects(growthJson(args),/quota/);assert.equal(models.length,1);}finally{globalThis.fetch=original;}
});

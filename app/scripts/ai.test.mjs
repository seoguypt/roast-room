import test from "node:test";
import assert from "node:assert/strict";

process.env.AI_PROVIDER = "omniroute";
process.env.OMNIROUTE_API_KEY = "test-key";
const ai = await import("../lib/ai.mjs");

test("OmniRoute streams split SSE chunks and sends credentials server-side", async () => {
  const original = globalThis.fetch;
  const deltas = [];
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "http://127.0.0.1:20128/v1/chat/completions");
    assert.equal(options.headers.Authorization, "Bearer test-key");
    const body = JSON.parse(options.body);
    assert.equal(body.messages[0].content, "Brain");
    assert.equal(body.model, "free-combo");
    return new Response(new ReadableStream({ start(c) {
      const data = 'data: {"choices":[{"delta":{"content":"Hello"}}]}\r\n\r\ndata: {"choices":[{"delta":{"content":" world"},"finish_reason":"stop"}]}\n\ndata: [DONE]';
      for (let i = 0; i < data.length; i += 7) c.enqueue(new TextEncoder().encode(data.slice(i, i + 7)));
      c.close();
    } }));
  };
  try {
    assert.equal(await ai.stream({ model: "free-combo", system: [{ text: "Brain" }], messages: [{ role: "user", content: "Decision" }], onText: d => deltas.push(d) }), "Hello world");
    assert.deepEqual(deltas, ["Hello", " world"]);
  } finally { globalThis.fetch = original; }
});

test("Chair JSON is parsed and validated; invalid or truncated results fail", async () => {
  const original = globalThis.fetch;
  const schema = ai.S.obj({ label: ai.S.enum("GO", "WAIT"), conditions: ai.S.arr(ai.S.str) });
  const args = { model: "free-combo", system: "Chair", prompt: "Decide", schema };
  function reply(content, finish_reason = "stop") {
    globalThis.fetch = async () => Response.json({ choices: [{ message: { content }, finish_reason }], usage: { prompt_tokens: 10, completion_tokens: 5 } });
  }
  try {
    reply('```json\n{"label":"GO","conditions":["Test"]}\n```');
    assert.deepEqual(await ai.json(args), { label: "GO", conditions: ["Test"] });
    reply('{"label":"GO"}');
    await assert.rejects(ai.json(args), /missing conditions/);
    reply('{"label":"MAYBE","conditions":[]}');
    await assert.rejects(ai.json(args), /invalid enum/);
    globalThis.fetch = async () => Response.json({ error: { code: "upstream_timeout", message: "private provider details" } });
    await assert.rejects(ai.json(args), /upstream error.*upstream_timeout/);
    reply(null);
    await assert.rejects(ai.json(args), /empty Chair answer/);
    reply("   ");
    await assert.rejects(ai.json(args), /empty Chair answer/);
    reply('{}', "length");
    await assert.rejects(ai.json(args), /max_tokens/);
  } finally { globalThis.fetch = original; }
});

test("Interrupted streams and authentication failures surface as errors", async () => {
  const original = globalThis.fetch;
  const args = { model: "free-combo", system: "Brain", messages: [] };
  try {
    globalThis.fetch = async () => new Response('data: {"choices":[{"delta":{"content":"Partial"}}]}\n');
    await assert.rejects(ai.stream(args), /interrupted/);
    globalThis.fetch = async () => new Response("private provider details", { status: 401 });
    await assert.rejects(ai.stream(args), /HTTP 401/);
  } finally { globalThis.fetch = original; }
});

test("Invalid Chair JSON gets one bounded repair with the same model",async()=>{
  const original=globalThis.fetch;let calls=0;
  const args={model:"free-combo",system:"Chair",prompt:"Decide",schema:ai.S.obj({seat:ai.S.enum("julian","charles")}),repair:true};
  globalThis.fetch=async(_url, options)=>{const body=JSON.parse(options.body);assert.equal(body.model,"free-combo");calls++;return Response.json({choices:[{finish_reason:"stop",message:{content:JSON.stringify({seat:calls===1?"unknown":"julian"})}}]});};
  try{assert.deepEqual(await ai.json(args),{seat:"julian"});assert.equal(calls,2);calls=0;globalThis.fetch=async()=>{calls++;return Response.json({choices:[{finish_reason:"stop",message:{content:"invalid"}}]});};await assert.rejects(ai.json(args));assert.equal(calls,2);}finally{globalThis.fetch=original;}
});

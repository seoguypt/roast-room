import { env } from "./env.mjs";
import * as anthropic from "./anthropic.mjs";
import { NARA_BASE, checkAllowedModel, assertFreeModel, reserveFreeSlot } from "./nara.mjs";
import {codexRequest,codexConnected} from './codex.mjs';
export { S } from "./anthropic.mjs";

export const provider = env("AI_PROVIDER") || "anthropic";
if (!["anthropic", "omniroute", "nara", "codex"].includes(provider)) throw new Error("AI_PROVIDER must be anthropic, omniroute, nara or codex");
const keyName = provider === "nara" ? "NARA_API_KEY" : provider === "omniroute" ? "OMNIROUTE_API_KEY" : "ANTHROPIC_API_KEY";
const providerName = provider === "nara" ? "NaraRouter" : "OmniRoute";
export const usage = provider === "anthropic" ? anthropic.usage : { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, calls: 0 };
export const hasKey = () => provider==='codex'?codexConnected():Boolean(env(keyName));
export const setupMessage = provider === 'codex' ? 'Connect your Codex subscription below. All advisors and the Chair use gpt-6.1-sol; subscription limits apply, with no paid API fallback.' : provider === "nara"
  ? "Create a free account at router.bynara.id/register, generate an API key in its dashboard, add NARA_API_KEY to .env, then restart Roast Room. Only verified free models are allowed."
  : provider === "omniroute"
  ? "Start OmniRoute, connect a provider, then add OMNIROUTE_API_KEY to .env and restart Roast Room."
  : "Add ANTHROPIC_API_KEY to .env and restart Roast Room.";

function systemText(system) {
  return typeof system === "string" ? system : system.map((b) => b.text || "").join("\n\n");
}

async function request(body) {
  if (provider === "nara") {
    checkAllowedModel(body.model);
    // Nara reasoning shares max_tokens with visible output. Reserve the budget
    // for the council's JSON and cards instead of an internal reasoning trace.
    body = { ...body, reasoning_effort: "none" };
  }
  const base = provider === "nara" ? NARA_BASE : (env("OMNIROUTE_BASE_URL") || "http://127.0.0.1:20128/v1").replace(/\/$/, "");
  let response;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (provider === "nara") {
      await reserveFreeSlot();
      await assertFreeModel(body.model);
    }
    try {
      response = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${env(keyName)}`, "content-type": "application/json" },
        redirect: "error",
        body: JSON.stringify(body), signal: AbortSignal.timeout(180000),
      });
    } catch {
      throw new Error(`Cannot reach ${providerName}. Check the connection and provider availability.`);
    }
    if (provider === "nara" && [402, 403, 429].includes(response.status)) {
      await response.body?.cancel();
      throw new Error(`NaraRouter returned HTTP ${response.status}: access or free quota unavailable. Council stopped; no paid fallback.`);
    }
    if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 2) break;
    await response.body?.cancel();
    await new Promise((resolve) => setTimeout(resolve, 2000 * 2 ** attempt));
  }
  if (!response.ok) throw new Error(`${providerName} returned HTTP ${response.status}. Check the quota, model and API key.`);
  return response;
}

function tally(u) {
  if (!u) return;
  usage.input += u.prompt_tokens || u.input_tokens || 0;
  usage.output += u.completion_tokens || u.output_tokens || 0;
}

export async function stream(args) {
  if(provider==='codex'){const result=await codexRequest({system:systemText(args.system),prompt:args.messages.map(m=>`${m.role}: ${m.content}`).join('\n\n')});tally(result.usage);usage.calls++;args.onText?.(result.text);return result.text;}
  if (provider === "anthropic") return anthropic.stream(args);
  const response = await request({ model: args.model, max_tokens: args.maxTokens || 2000, stream: true,
    ...(args.jsonOutput && provider === "nara" ? { response_format: { type: "json_object" }, temperature: 0.2 } : {}),
    messages: [{ role: "system", content: systemText(args.system) }, ...args.messages] });
  if(response.headers.get("content-type")?.includes("application/json")) {
    const result=await response.json();
    if(result.error)throw new Error(`${providerName} returned an upstream error instead of the requested stream. Please retry later; no paid fallback.`);
    throw new Error(`${providerName} did not provide the requested text stream.`);
  }
  const decoder = new TextDecoder();
  let buffer = "", text = "", completed = false;
  function line(value) {
    if (!value.startsWith("data:")) return;
    const data = value.slice(5).trim();
    if (data === "[DONE]") { completed = true; return; }
    const event = JSON.parse(data);
    if (event.error) {
      const raw=event.error.code ?? event.error.type ?? event.error.status;
      const code=typeof raw==="number" || (typeof raw==="string" && /^[a-zA-Z0-9_-]{1,60}$/.test(raw)) ? raw : "unspecified";
      throw new Error(`${providerName} reported a stream error (code: ${code}).`);
    }
    tally(event.usage);
    const choice = event.choices?.[0];
    if (choice?.finish_reason === "length") throw new Error("Advisor output hit max_tokens.");
    if (choice?.finish_reason) completed = true;
    const delta = choice?.delta?.content;
    if (delta) { text += delta; args.onText?.(delta); }
  }
  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });
    let index;
    while ((index = buffer.indexOf("\n")) >= 0) { line(buffer.slice(0, index).trim()); buffer = buffer.slice(index + 1); }
  }
  buffer += decoder.decode();
  if (buffer.trim()) line(buffer.trim());
  if (!completed || !text.trim()) throw new Error(`${providerName} returned an empty or interrupted advisor response.`);
  usage.calls++;
  return text;
}

// Validate prompted JSON locally: free providers do not all support strict JSON-schema output.
export function validate(value, schema, location = "result") {
  if (schema.enum && !schema.enum.includes(value)) throw new Error(`${location}: invalid enum value`);
  const type = schema.type;
  if (type === "array") {
    if (!Array.isArray(value)) throw new Error(`${location}: expected array`);
    value.forEach((v, i) => validate(v, schema.items, `${location}[${i}]`));
  } else if (type === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${location}: expected object`);
    for (const key of schema.required || []) if (!(key in value)) throw new Error(`${location}: missing ${key}`);
    for (const [key, v] of Object.entries(value)) {
      if (!schema.properties[key]) throw new Error(`${location}: unexpected ${key}`);
      validate(v, schema.properties[key], `${location}.${key}`);
    }
  } else if (type === "integer" ? !Number.isInteger(value) : typeof value !== type) throw new Error(`${location}: expected ${type}`);
}

export async function json(args) {
  if(provider==='codex'){
    const result=await codexRequest(args);tally(result.usage);usage.calls++;
    let parsed=JSON.parse(result.text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));
    if(args.normalize)parsed=args.normalize(parsed,args.schema);validate(parsed,args.schema);return parsed;
  }
  if (provider === "anthropic") return anthropic.json(args);
  if(provider === "nara" && args.streaming) {
    const content=await stream({model:args.model,maxTokens:args.maxTokens || 4000,jsonOutput:true,system:systemText(args.system)+"\nReturn only valid JSON matching this schema. No markdown or commentary.\n"+JSON.stringify(args.schema),messages:[{role:"user",content:args.prompt}]});
    try { let value=JSON.parse(content.trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,"")); if(args.normalize)value=args.normalize(value,args.schema);validate(value,args.schema);return value; }
    catch(e){if(!args.repair||args._repairAttempt)throw e;return json({...args,_repairAttempt:true,prompt:args.prompt+"\nCorrect the previous invalid JSON/schema answer: "+e.message+". Use only the schema's exact enum values."});}
  }
  const response = await request({ model: args.model, max_tokens: args.maxTokens || 4000, stream: false,
    ...(provider === "nara" ? { response_format: { type: "json_object" }, temperature: 0.2 } : {}),
    messages: [{ role: "system", content: systemText(args.system) + "\nReturn only valid JSON matching this schema. No markdown or commentary.\n" + JSON.stringify(args.schema) },
      { role: "user", content: args.prompt }] });
  const result = await response.json();
  tally(result.usage); usage.calls++;
  if (result.error) {
    const rawCode = typeof result.error === "object" ? result.error.code ?? result.error.type : undefined;
    const code = typeof rawCode === "number" || (typeof rawCode === "string" && /^[a-zA-Z0-9_-]{1,60}$/.test(rawCode)) ? rawCode : "unspecified";
    console.warn("[council] Provider error in HTTP 200", JSON.stringify({ provider, model: args.model, code }));
    throw new Error(`${providerName} reported an upstream error (code: ${code}) despite HTTP 200. Please retry; no paid fallback was used.`);
  }
  const choice = result.choices?.[0];
  const content = choice?.message?.content;
  if (choice?.finish_reason === "length" || typeof content !== "string" || !content.trim()) {
    const details = { provider, model: args.model, finishReason: choice?.finish_reason || null, contentType: typeof content, contentChars: typeof content === "string" ? content.length : 0, completionTokens: result.usage?.completion_tokens || 0, reasoningTokens: result.usage?.completion_tokens_details?.reasoning_tokens || 0 };
    // Metadata only: never log keys, prompts, response content or reasoning.
    console.warn("[council] Chair output unavailable", JSON.stringify(details));
    if (choice?.finish_reason === "length") throw new Error("Chair output hit max_tokens before completing its answer.");
    throw new Error(`${providerName} returned an empty Chair answer (finish: ${details.finishReason || "unknown"}, output tokens: ${details.completionTokens}). Please retry; no paid fallback was used.`);
  }
  try {
    let parsed = JSON.parse(content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
    if (args.normalize) parsed = args.normalize(parsed, args.schema);
    validate(parsed, args.schema);
    return parsed;
  } catch (e) {
    if (!args.repair || args._repairAttempt) throw e;
    console.warn("[council] Retrying invalid Chair JSON once", JSON.stringify({ provider, model: args.model }));
    return json({ ...args, _repairAttempt: true, prompt: args.prompt + "\n\nYour previous answer failed JSON/schema validation: " + e.message + ". Return a corrected answer. Use ONLY exact enum keys shown in the schema, never display names or invented seats. No markdown." });
  }
}

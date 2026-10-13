import { dataforseo, dataforseoConfigured } from "./lib/dataforseo.mjs";
import { freeAudit } from "./lib/free-audit.mjs";
import {googleOAuth} from './lib/google-oauth.mjs';
import {googleData,googleReview} from './lib/google-data.mjs';
import {deployment,authorized} from './lib/deployment.mjs';
import { normalizeGrowthUrls, growthMarkdown } from "./lib/growth.mjs";
import { ttsRequest } from "./lib/tts.mjs";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { APP_ROOT, env } from "./lib/env.mjs";
import { SEATS } from "./lib/seats.mjs";
import { startCouncil, validateSelectedSeats, getSession, subscribe, listSaved, loadSaved, MODELS } from "./lib/council.mjs";
import { usage, provider, hasKey, setupMessage } from "./lib/ai.mjs";
import { SEO_SEATS, normalizeWebsite } from "./lib/seo.mjs";
import * as watch from "./lib/watch.mjs";

const PORT = Number(process.env.PORT) || 4730;
const PUBLIC = path.join(APP_ROOT, "public");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".ico": "image/x-icon", ".json": "application/json", ".ttf": "font/ttf", ".txt": "text/plain; charset=utf-8" };

let running = null; // one council at a time (API runner)
let collectingData = false;

// "viewer" (default): the room plays councils that /roast-room runs in Claude Code.
// "api": the room can also run councils itself on ANTHROPIC_API_KEY (COUNCIL_RUNNER=api in .env).
const RUNNER = (process.env.COUNCIL_RUNNER || env("COUNCIL_RUNNER") || "viewer").toLowerCase() === "api" ? "api" : "viewer";
watch.startWatching();

function send(res, code, body, type = "application/json") {
  res.writeHead(code, { "content-type": type, "cache-control": "no-store" });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
}

async function readJson(req) {
  let raw = "";
  for await (const c of req) { raw += c; if (raw.length > 1e5) throw new Error("body too large"); }
  return raw ? JSON.parse(raw) : {};
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;
  try {
    if(p==='/health')return send(res,200,{status:'ok'});
    if(!authorized(req.headers.authorization,deployment)){if(deployment.public&&!deployment.password)return send(res,503,{error:'Set APP_ACCESS_PASSWORD in Coolify before enabling this private advisory workspace.'});res.setHeader('WWW-Authenticate','Basic realm="Advisory workspace", charset="UTF-8"');return send(res,401,'Sign in to the advisory workspace.','text/plain');}
    if(p.startsWith('/api/')){const origin=req.headers.origin;if(!deployment.allowedHosts.has(url.hostname)||(origin&&!deployment.allowedOrigins.has(origin)))return send(res,403,{error:'Use the configured app origin for API requests.'});}
    if(p.startsWith('/api/google/')){
      const origin=req.headers.origin;if(origin&&!deployment.allowedOrigins.has(origin))return send(res,403,{error:'Use the configured app origin to connect Google.'});
      if(p==='/api/google/status')return send(res,200,googleOAuth.status());
      if(p==='/api/google/connect'&&req.method==='POST'){const auth=await googleOAuth.begin();res.setHeader('Set-Cookie',`roast_google_state=${auth.cookie}; HttpOnly; SameSite=Lax; Path=/api/google; Max-Age=600${deployment.public?'; Secure':''}`);return send(res,200,{url:auth.url});}
      if(p==='/api/google/callback'){
        const cookie=req.headers.cookie?.split(';').map(c=>c.trim()).find(c=>c.startsWith('roast_google_state='))?.slice('roast_google_state='.length);
        try{await googleOAuth.finish({state:url.searchParams.get('state'),code:url.searchParams.get('code'),error:url.searchParams.get('error'),cookie});res.setHeader('Set-Cookie','roast_google_state=; HttpOnly; SameSite=Lax; Path=/api/google; Max-Age=0');return send(res,200,'<!doctype html><meta name="referrer" content="no-referrer"><title>Google connected</title><h1>Google connected</h1><p>Read-only access is ready. Return to the review tab and refresh properties.</p><a href="/">Return to Roast Room</a><script>window.close()</script>','text/html; charset=utf-8');}catch(e){return send(res,400,'<!doctype html><meta name="referrer" content="no-referrer"><title>Google connection failed</title><h1>Google connection failed</h1><p>Access was declined, expired, or could not be verified. Return to the app and connect again. Check your OAuth client configuration and grant both read-only permissions.</p>','text/html; charset=utf-8');}
      }
      if(p==='/api/google/properties')return send(res,200,await googleData.properties());
      if(p==='/api/google/disconnect'&&req.method==='POST')return send(res,200,await googleOAuth.disconnect());
      return send(res,404,{error:'Unknown Google endpoint.'});
    }
    if (p === "/api/tts/status" || (req.method === "POST" && ["/api/tts/speech", "/api/tts/clone", "/api/tts/assign"].includes(p))) {
      let body;
      if (req.method === "POST") {
        const chunks = []; let bytes = 0;
        for await (const chunk of req) { bytes += chunk.length; if (bytes > 10_000_000) return send(res, 413, { error: "Voice upload must be under 10 MB." }); chunks.push(chunk); }
        body = Buffer.concat(chunks);
      }
      const response = await ttsRequest(p.split("/").pop(), body);
      res.writeHead(response.status, { "content-type": response.headers.get("content-type") || "application/json", "cache-control": "no-store", "X-Sample-Rate": response.headers.get("x-sample-rate") || "" });
      for await (const chunk of response.body) { if (res.destroyed) break; res.write(chunk); }
      res.end(); return;
    }
    if(p === "/api/dataforseo/status")return send(res,200,{configured:dataforseoConfigured(),capUsd:5});
    if(p === "/api/dataforseo/preview" && req.method === "POST")return send(res,200,await dataforseo.preview(await readJson(req)));
    if (p === "/api/seats") return send(res, 200, { seats: SEATS, rosters: { business: SEATS, seo: SEO_SEATS }, models: MODELS, runner: RUNNER, provider, hasKey: hasKey(), setupMessage });
    if (p === "/api/usage") return send(res, 200, usage);
    if (p === "/api/council" && req.method === "POST") {
      if(collectingData)return send(res,409,{error:"A review is collecting approved data. Please wait."});
      if (RUNNER !== "api") return send(res, 403, { error: "This room is a viewer. Run /roast-room in Claude Code, or set COUNCIL_RUNNER=api in .env." });
      if (!hasKey()) return send(res, 503, { error: setupMessage });
      if (running && getSession(running)?.status === "running") return send(res, 409, { error: "A council is already in session. Wait for its verdict." });
      const { prompt = "", mode, advisory = "business", website = "", selectedSeats, urls, workflow, dataforseoApproval, country, language,googleSettings } = await readJson(req);
      if (!["business", "seo"].includes(advisory)) return send(res, 400, { error: "Choose Business Advisory or SEO Advisory." });
      try { validateSelectedSeats(advisory, selectedSeats); } catch (e) { return send(res, 400, { error: e.message }); }
      if (typeof prompt !== "string") return send(res, 400, { error: "Enter your question as text." });
      let target = "", targets = [];
      const review = advisory === "seo" && workflow !== "debate";
      if (advisory === "seo") {
        try { targets = review ? normalizeGrowthUrls(urls || website, normalizeWebsite) : [normalizeWebsite(website).href]; target = targets[0]; } catch (e) { return send(res, 400, { error: e.message }); }
      } else if (prompt.trim().length < 10) return send(res, 400, { error: "Give the council a real decision (at least a sentence)." });
      if(review && (typeof country!=="string"||typeof language!=="string"||country.trim().length<2||language.trim().length<2))return send(res,400,{error:"Choose a country and language for this review."});
      const question = prompt.trim().slice(0, 4000) || `Review how these pages can earn qualified search traffic and grow: ${targets.join(", ")}. Identify improvements, content opportunities, and a practical roadmap.`;
      const context = review ? question + `\nTarget market: ${country.trim().slice(0,80)}; language: ${language.trim().slice(0,50)}.` : question;
      let externalData;
      let googleEvidence;
      if(googleSettings){if(!review)return send(res,400,{error:'Google reports require an SEO growth review.'});try{googleReview(googleSettings,targets);}catch(e){return send(res,400,{error:e.message});}if(!googleOAuth.status().connected)return send(res,400,{error:'Connect Google before including private reports.'});}
      if(dataforseoApproval && (!review||dataforseoApproval.approved!==true))return send(res,400,{error:"Explicit DataForSEO approval is required for a growth review."});
      if(dataforseoApproval||googleSettings){if(collectingData || (running && getSession(running)?.status === "running"))return send(res,409,{error:"A review is already running."});collectingData=true;try{if(googleSettings)googleEvidence=await googleData.collect(googleSettings,targets);if(dataforseoApproval)externalData=await dataforseo.collect(dataforseoApproval.id,{urls:targets,country,language,backlinks:dataforseoApproval.backlinks});}finally{collectingData=false;}}
      const s = startCouncil(context, mode === "quick" ? "quick" : "full", advisory, target, { selectedSeats, workflow: review ? "growth" : "debate", urls: targets, externalData,googleEvidence,freeChecks:review?freeAudit:undefined });
      running = s.id;
      return send(res, 200, { id: s.id });
    }
    if(p.startsWith("/api/growth/")) {
      const id=decodeURIComponent(p.split("/")[3]);const session=getSession(id)||loadSaved(id);
      if(!session)return send(res,404,{error:"Report not found"});
      const growth=session.state?.growth||{reports:session.events.filter(e=>e.type==="growth_report"),roadmap:session.events.find(e=>e.type==="growth_plan")};
      if(!growth.reports.length)return send(res,404,{error:"Growth report not available"});
      res.writeHead(200,{"content-type":"text/markdown; charset=utf-8","content-disposition":`attachment; filename="${id}-growth.md"`});res.end(growthMarkdown(growth));return;
    }
    if (p.startsWith("/api/stream/")) {
      const id = decodeURIComponent(p.split("/").pop());
      const s = getSession(id) || watch.getLive(id);
      if (!s) return send(res, 404, { error: "no such session" });
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" });
      res.write(": connected\n\n");
      const ping = setInterval(() => res.write(": ping\n\n"), 15000);
      res.on("close", () => clearInterval(ping));
      return subscribe(s, res);
    }
    if (p === "/api/sessions") {
      const all = [...listSaved(), ...watch.listLive()].sort((a, b) => (a.id < b.id ? 1 : -1));
      const apiRunning = running && getSession(running)?.status === "running" ? running : null;
      return send(res, 200, { sessions: all, running: apiRunning, live: watch.runningId() });
    }
    if (p.startsWith("/api/sessions/")) {
      const id = decodeURIComponent(p.split("/").pop());
      const x = watch.getLive(id);
      const j = loadSaved(id) || (x && { id, title: x.title, mode: x.mode, status: x.status, events: x.events });
      return j ? send(res, 200, j) : send(res, 404, { error: "not found" });
    }
    // static
    const file = path.normalize(path.join(PUBLIC, p === "/" ? "index.html" : p));
    if (!file.startsWith(PUBLIC) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(res, 404, "Not found", "text/plain");
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    send(res, 500, { error: String(e.message || e) });
  }
});

server.listen(PORT, deployment.host, () => console.log(`Roast Room on ${deployment.origin} (${RUNNER === "api" ? "viewer + API runner" : "viewer: run /roast-room in Claude Code"})`));

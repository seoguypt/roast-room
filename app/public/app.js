import { LocalSpeech } from "./tts.js";
const speech = new LocalSpeech();
import { downloadVerdictPdf } from "./pdf.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const SAMPLES = [
  ["Raise my prices?", "I run a coaching business doing $30k a month with 15 active clients at $2,000 each. I want to raise the price to $3,500. Options: raise for everyone now, raise for new clients only, or keep $2,000. Close rate is about 50% on sales calls. I'm leaning toward raising for everyone because I'm underpaid."],
  ["First salesperson?", "I'm a solo founder of a B2B SaaS at $25k MRR growing 5% a month. I do every sales call myself (about 20 hours a week) and I'm burning out. Should I hire a full-time account executive at $120k base, hire a part-time commission-only closer, or keep selling myself for six more months? I have $150k in the bank."],
  ["Second product?", "My agency makes $80k a month building AI automations for dentists. A few clients asked for an AI receptionist product. Should I build the receptionist as a separate SaaS, offer it as an add-on to existing clients only, or stay focused on the agency? Team of 6, about $200k cash."],
  ["Quit my job?", "I make $180k a year at a tech company. My side business (a paid newsletter) makes $6k a month and grew 8% a month this year. I have 9 months of expenses saved. Should I quit now, quit in 6 months, or keep both and hire a writer?"],
];

const EXAMPLE = "I run a coaching business at $30k a month with 15 clients at $2,000 each. Should I raise to $3,500 for everyone, raise for new clients only, or keep $2,000? Close rate is about 50% and I have $40k in the bank. Success is $45k a month by March. I'm leaning toward raising for everyone because I'm underpaid.";

// The how-to, shown in the side panel while the room is empty and in "How it works".
const VIEWER_GUIDE = `
  <div class="guide">
    <div class="guide-sec">
      <h4>How to use the Roast Room</h4>
      <ol>
        <li><span>Open Claude Code in this folder.</span></li>
        <li><span>Type <code>/roast-room</code> and your decision.</span></li>
        <li><span>Answer the Chair's questions. Then watch the council argue it out here.</span></li>
        <li><span>When the verdict lands, download it as a PDF.</span></li>
      </ol>
    </div>
    <div class="guide-sec">
      <h4>What to put in your question</h4>
      <ul>
        <li><span><b>The decision</b> in one line.</span></li>
        <li><span><b>Your options.</b> Two or three. "Keep doing what I do now" counts.</span></li>
        <li><span><b>Your numbers.</b> Revenue, cash, and team size.</span></li>
        <li><span><b>Your limits.</b> Deadline, hours, and budget.</span></li>
        <li><span><b>What success looks like</b>, and by when.</span></li>
        <li><span><b>Which way you're leaning</b>, and why. The council tests it.</span></li>
      </ul>
      <p class="note" style="margin-top:8px">Left something out? The Chair asks before the council starts.</p>
    </div>
    <div class="guide-sec">
      <h4>Example</h4>
      <div class="example">
        <p><code>/roast-room</code> ${EXAMPLE.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>
        <button class="ghost" type="button" data-copy-example>Copy this example</button>
      </div>
    </div>
    <div class="guide-sec">
      <h4>Good to know</h4>
      <ul>
        <li><span><b>Full council:</b> 7 advisors, 3 rounds. For big calls that are hard to undo.</span></li>
        <li><span><b>Quick:</b> add <code>--quick</code> for 4 advisors and 2 rounds. Uses far less of your plan.</span></li>
        <li><span><b>Every council is saved.</b> Open Past sessions to replay one or download its PDF.</span></li>
      </ul>
    </div>
  </div>`;

function guide() {
  if (state.advisory === "seo" && state.runner === "api") return `<div class="guide"><div class="guide-sec"><h4>SEO Advisory</h4><ol><li>Enter 1–10 public URLs, one per line.</li><li>Choose a country and language; optionally add your audience and growth goals.</li><li>Select the advisors whose opinions you want.</li><li>Turn Voice on. Hear each opinion, watch the advisors discuss priorities, then get the combined 7/30/90-day roadmap.</li></ol></div><div class="guide-sec"><h4>Your SEO council</h4><p>${state.seats.map(s => esc(s.name)).join(", ")}.</p><p>Each simulated seat combines its sourced profile with your installed specialist SEO skills. Opening cards include page-specific audit findings, proposed fixes and verification steps. Click an advisor to see their focus and public sources.</p></div><div class="guide-sec"><h4>What the council checks</h4><p>Each submitted URL is inspected for content, titles, descriptions, headings, canonicals, robots tags, internal links, image alt attributes and JSON-LD. A single URL also samples up to three linked pages. robots.txt and sitemap.xml are checked.</p><p>Pages are read as server HTML. This is a sampled advisory, not a full crawl. Optional approved DataForSEO checks add indexed keywords, competitor domains and backlink summaries. Free checks crawl up to 20 pages, sample up to 50 internal links and 20 sitemap URLs, and render/run mobile Lighthouse on up to 3 pages. Connect Google and select properties to add historical Search Console and GA4 evidence. Real-user Core Web Vitals are unavailable.</p></div><div class="guide-sec"><h4>AI model</h4><p>${state.provider === "nara" ? "NaraRouter Free-plan eligibility is checked before each request. Paid models and auto routing are blocked; exhausted quota stops the council." : "Usage follows the configured provider's plan."}</p></div></div>`;
  if (state.runner !== "api") return VIEWER_GUIDE;
  return VIEWER_GUIDE
    .replace('Open Claude Code in this folder.', 'Enter your decision in the form on this page.')
    .replace('Type <code>/roast-room</code> and your decision.', 'Choose Full council or Quick, then click Convene the council.')
    .replace("Answer the Chair's questions. Then watch the council argue it out here.", 'Watch the advisors debate live, then read the verdict.')
    .replace("Left something out? The Chair asks before the council starts.", 'Include the key numbers. The Chair labels assumptions when details are missing.')
    .replace('<code>/roast-room</code> ', '')
    .replace('add <code>--quick</code> for 4 advisors and 2 rounds. Uses far less of your plan.', 'choose Quick for 4 advisors, with a vote round if needed. Uses fewer API calls.')
    .replace('<h4>Good to know</h4>', `<h4>Good to know</h4><p class="note">${state.provider === "nara" ? "NaraRouter free-only mode: requests use allowlisted free models, verified against the current Free plan. No auto routing or paid fallback. Quota errors stop the council." : state.provider === "omniroute" ? "Councils use your connected OmniRoute providers and their quotas. Choose free providers in OmniRoute to avoid paid usage." : "Councils use the configured provider. Codex subscription mode has no paid API fallback."}</p>`);
}

const SHAPES = ["base", "open", "mid", "blink"];
const portrait = (key, shape = "base") => state.advisory === "seo" ? `/portraits/seo/${key}-sheet.png` : `/portraits/${key}-${shape}.webp`;
const avatar = (key, className = "") => state.advisory === "seo"
  ? `<span class="seo-avatar ${esc(className)}" role="img" aria-label="Illustrated ${esc(state.byKey[key]?.name || key)}" style="background-image:url('${portrait(key)}')"></span>`
  : `<img class="${esc(className)}" src="${portrait(key)}" alt="${esc(state.byKey[key]?.short || key)}">`;
const ROUND_NAME = ["", "Opening", "Debate", "Vote"];

const state = {
  advisory: "business", evidence: null,
  seats: [], byKey: {}, session: null, options: [], weights: {}, active: [], round: 0,
  cards: { 1: {}, 2: {}, 3: {} }, replaying: false, verdict: null, links: [], geo: {}, setup: null, wait: null,
};

// ------------------------------------------------------------- boot
async function boot() {
  const r = await fetch("/api/seats").then((x) => x.json());
  state.seats = r.seats;
  state.rosters = r.rosters || { business: r.seats };
  state.byKey = Object.fromEntries(r.seats.map((s) => [s.key, s]));
  state.runner = r.runner;
  state.hasKey = r.hasKey;
  state.provider = r.provider;
  $("#apiSetup").textContent = r.setupMessage;
  $("#apiSetup").hidden = r.runner !== "api" || r.hasKey;
  $("#convene").disabled = r.runner === "api" && !r.hasKey;
  renderAdvisorChoices();
  renderSeats();
  renderSamples();
  bindUI();
  new ResizeObserver(() => { layoutStage(); drawLinks(); }).observe($("#stage"));
  startBlinking();
  reset();
  typeIn($("#composer h2"));
  typeIn($("#waiting h2"));
  const ss = await fetch("/api/sessions").then((x) => x.json());
  if (ss.running) attach(ss.running);
  else if (ss.live) attach(ss.live);
  refreshUsage();
  setInterval(watchForLive, 2500);
  setInterval(tickWait, 1000);
}

// a council started in Claude Code shows up here on its own
const seenLive = new Set();
async function watchForLive() {
  const ss = await fetch("/api/sessions").then((x) => x.json()).catch(() => null);
  const id = ss?.live || ss?.running;
  if (!id || seenLive.has(id) || id === state.session) return;
  seenLive.add(id);
  attach(id);
}

// AIS arrival: a heading types in a character at a time, blur to sharp
function typeIn(el) {
  if (!el) return;
  const text = el.textContent;
  el.classList.add("typein");
  // characters sit inside a nowrap span per word, so lines only break between words
  let i = 0;
  el.innerHTML = text.split(" ").map((word) => `<span class="wd">${[...word].map((c) => `<span class="ch" style="animation-delay:${i++ * 22}ms">${esc(c)}</span>`).join("")}</span>`).join(" ");
  el.setAttribute("aria-label", text);
}

function renderSamples() {
  if (state.advisory === "seo") { $("#samples").innerHTML = ""; return; }
  $("#samples").innerHTML = SAMPLES.map(([t], i) => `<button type="button" data-i="${i}">${esc(t)}</button>`).join("");
  $("#samples").onclick = (e) => {
    const b = e.target.closest("button"); if (!b) return;
    $("#prompt").value = SAMPLES[b.dataset.i][1];
    $("#prompt").focus();
  };
}

function selectAdvisory(advisory, roster = state.rosters?.[advisory]) {
  state.advisory = advisory;
  state.seats = roster || state.rosters.business;
  state.byKey = Object.fromEntries(state.seats.map(s => [s.key, s]));
  $("#advisory").value = advisory;
  $("#stage").classList.toggle("seo-advisory", advisory === "seo");
  $("#websiteField").hidden = advisory !== "seo";
  $("#seoMarket").hidden = advisory !== "seo";
  if(advisory==='seo')void refreshGoogle(false);
  $("#seoCountry").required = $("#seoLanguage").required = advisory === "seo";
  $(".mode").hidden = advisory === "seo";
  $("#convene").textContent = advisory === "seo" ? "Start SEO council review" : "Convene the council";
  $(".advisor-picker .note").textContent = advisory === "seo" ? "Select at least two. Each selected advisor writes an independent report." : "Select at least two. Your chosen advisors participate in every round.";
  $("#prompt").setAttribute("aria-label", advisory === "seo" ? "Growth goals and business context" : "Your decision");
  if(!state.session){const labels=advisory === "seo" ? ["Pages","Opinions","Opportunities","Plan","Measurement","Roadmap"] : ["Brief","Openings","Fault lines","Debate","Vote","Verdict"]; $$(".stepper li").forEach((li,i)=>li.textContent=labels[i]);}
  $("#seoScope").hidden = advisory !== "seo";
  $("#website").required = advisory === "seo";
  $("#prompt").required = advisory !== "seo";
  $("#prompt").minLength = advisory === "seo" ? 0 : 10;
  $("#prompt").placeholder = advisory === "seo" ? "Optional context: audience, country, offers, competitors you know, current traffic and conversions, and your growth goals. No question is required." : "Give them the decision, your options, a few numbers (revenue, cash, team), and which way you're leaning.";
  $("#composer h2").textContent = advisory === "seo" ? "Which URLs should the advisors review?" : "What decision do you need help with?";
  $("#composer h2").setAttribute("aria-label", $("#composer h2").textContent);
  $('input[name="mode"][value="full"] + span').innerHTML = `Full council <small>${state.seats.length} seats, 3 rounds</small>`;
  $(".disclaimer").textContent = advisory === "seo" ? "Simulated SEO advisors inspired by public work. Not the real people; no affiliation or endorsement. Findings cite bounded HTML/crawl/browser checks and any approved DataForSEO evidence. Lighthouse is lab performance, not real-user data." : "Simulated advisors built from each person's public work and drawn as caricatures. They are not the people and do not speak for them.";
  renderSeats();
  renderAdvisorChoices();
  renderSamples();
}

function renderAdvisorChoices() {
  state.picked = new Set(state.seats.map(s => s.key));
  state.customPicked = false;
  $("#cloneSeat").innerHTML = state.seats.map(s => `<option value="${s.key}">${esc(s.name)}</option>`).join("");
  $("#advisorChoices").innerHTML = state.seats.map(s => `<label class="advisor-choice"><input type="checkbox" value="${s.key}" checked>${avatar(s.key, "picker-avatar")}<span><b>${esc(s.name)}</b><small>${esc(s.pillar)}</small></span></label>`).join("");
  updateAdvisorCount();
}
function updateAdvisorCount() {
  $("#advisorCount").textContent = `${state.picked.size} advisors selected`;
  $('input[name="mode"][value="full"] + span').innerHTML = `Full council <small>${state.picked.size} seats, 3 rounds</small>`;
  $('input[name="mode"][value="quick"] + span').innerHTML = `Quick <small>${state.customPicked ? state.picked.size : 4} seats, 2 rounds</small>`;
  $$("#seats .seat, #plates .nameplate").forEach(el => el.classList.toggle("advisor-unselected", !state.picked.has(el.dataset.seat)));
}
function renderSeats() {
  $("#seats").innerHTML = state.seats.map((s, i) => `
    <div class="seat" id="seat-${s.key}" data-seat="${s.key}" style="--d:-${(i * 1.7) % 6}s" tabindex="0" role="button" aria-label="${esc(s.name)}, ${esc(s.pillar)}. Open card.">
      <div class="think" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="bust" data-shape="base" style="--seat-color:${s.color}">${state.advisory === "seo" ? `<span class="seo-portrait" style="background-image:url('${portrait(s.key)}')" aria-hidden="true"></span>` : SHAPES.map((sh) => `<img class="${sh}" src="${portrait(s.key, sh)}" alt="" draggable="false">`).join("")}</div>
    </div>`).join("");
  $("#plates").innerHTML = state.seats.map((s) => `
    <div class="nameplate" id="plate-${s.key}" data-seat="${s.key}">
      <b>${esc(state.advisory === "seo" ? s.name : s.short === "Gary V" ? "Gary V" : s.name)}</b>
      <small>${esc(s.pillar)}</small>
      <div class="meta"><span class="pips" title="Weight on this decision"></span><span class="chip" hidden></span><span class="score" hidden></span></div>
    </div>`).join("");
  layoutStage();
  startBlinking();
}

// The table is an ellipse seen from the front. Seats sit along its far edge: the
// middle seat is farthest (higher, smaller), the end seats nearest (lower, bigger).
function layoutStage() {
  const stage = $("#stage");
  const W = stage.clientWidth;
  const narrow = matchMedia("(max-width: 820px)").matches;
  const H = narrow ? Math.round(W * 0.62) : stage.clientHeight;
  const cx = W / 2, cy = H * (narrow ? 0.98 : 0.9), rx = W * 0.48, ry = H * (narrow ? 0.46 : 0.42);
  const t = $("#table");
  Object.assign(t.style, { left: `${cx - rx}px`, top: `${cy - ry}px`, width: `${rx * 2}px`, height: `${ry * 2}px` });
  const edge = (x) => cy - ry * Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2));
  stage.dataset.seatCount = state.seats.length;
  const xs = state.seats.map((_s, i) => 0.085 + 0.83 * i / Math.max(1, state.seats.length - 1));
  const density = Math.min(1, 7 / state.seats.length);
  state.seats.forEach((s, i) => {
    const x = W * xs[i];
    const d = ((x - cx) / rx) ** 2;
    const size = H * (narrow ? 0.5 + 0.08 * d : 0.37 + 0.07 * d) * density;
    const bottom = edge(x) + size * 0.2;
    const el = $(`#seat-${s.key}`);
    Object.assign(el.style, { left: `${x - size / 2}px`, top: `${bottom - size}px`, width: `${size}px`, height: `${size}px`, zIndex: 10 + Math.round(d * 10) });
    const pl = $(`#plate-${s.key}`);
    pl.style.left = `${x}px`;
    pl.style.top = `${edge(x) + H * 0.01}px`; // straddles the table edge, over the chest
    state.geo[s.key] = { x, head: bottom - size * 0.72, top: bottom - size * 0.9, size };
  });
  const c = $("#center");
  if (narrow) {
    stage.style.paddingTop = `${H}px`; // the scene sits on top; captions flow below it
  } else {
    stage.style.paddingTop = "";
    // the captions start below the lowest nameplate they could collide with
    const inner = state.seats.slice(1, -1).map(s => $(`#plate-${s.key}`));
    const top = Math.max(H * 0.55, ...inner.map((p) => p.offsetTop + p.offsetHeight / 2)) + H * 0.035;
    Object.assign(c.style, { left: `${W * 0.2}px`, width: `${W * 0.6}px`, top: `${top}px`, height: `${H - top - H * 0.09}px` });
  }
  const sp = state.speaking ? state.geo[state.speaking] : null;
  if (sp) moveSpot(state.speaking);
}

function moveSpot(key) {
  const g = state.geo[key]; const spot = $("#spot");
  if (!g) { spot.classList.remove("on"); return; }
  spot.style.left = `${g.x}px`;
  spot.style.top = `${g.head}px`;
  spot.style.width = spot.style.height = `${g.size * 1.9}px`;
  spot.classList.add("on");
}

async function refreshGoogle(properties=true){
  try{const r=await fetch('/api/google/status'),s=await r.json();if(!r.ok)throw Error(s.error);state.googleConnected=s.connected;$('#googleDisconnect').hidden=!s.connected;
    $('#googleRedirect').textContent=s.redirectUri;
    $('#googleStatus').textContent=s.connected?'Google connected · read-only Search Console and GA4 access.':s.configured?'Ready to connect. Sign in with your Google account.':'Google login needs the one-time OAuth client setup below.';
    if(!s.connected){$('#googleUse').checked=false;$('#googleOptions').hidden=true;return;}
    if(properties){$('#googleStatus').textContent='Loading accessible Google properties…';const p=await fetch('/api/google/properties'),d=await p.json();if(!p.ok)throw Error(d.error);$('#gscProperties').innerHTML=d.gsc.map(v=>`<option value="${esc(v.id)}">${esc(v.permission)}</option>`).join('');$('#ga4Properties').innerHTML=d.ga4.map(v=>`<option value="${esc(v.id)}">${esc(v.name)} · ${esc(v.account)}</option>`).join('');$('#googleStatus').textContent=`Google connected · ${d.gsc.length} Search Console properties · ${d.ga4.length} GA4 properties. `+d.errors.map(e=>e.source+': '+e.error).join(' ');}
  }catch(e){$('#googleStatus').textContent=e.message;}
}
async function refreshCodex(){
  $("#codexConnect").hidden=state.provider!=="codex";if(state.provider!=="codex")return;
  try{const r=await fetch('/api/codex/status'),d=await r.json();if(!r.ok)throw Error(d.error);state.hasKey=d.connected;
    $("#codexStatus").textContent=d.connected?'Connected · gpt-6.1-sol · subscription limits apply.':d.login?.error||'Connect your ChatGPT account to use your Codex subscription.';
    $("#apiSetup").hidden=d.connected;$("#convene").disabled=!d.connected;$("#codexDevice").hidden=!d.login?.code;$("#codexCode").textContent=d.login?.code||'';
    return d.connected;
  }catch(e){$("#codexStatus").textContent=e.message;return false;}
}
function bindUI() {
  void refreshCodex();
  $("#codexRefresh").addEventListener('click',()=>refreshCodex());
  $("#codexLogin").addEventListener('click',async()=>{
    $("#codexLogin").disabled=true;$("#codexStatus").textContent='Preparing OpenAI device sign-in…';
    try{const r=await fetch('/api/codex/connect',{method:'POST'}),d=await r.json();if(!r.ok)throw Error(d.error);await refreshCodex();let polls=0;const timer=setInterval(async()=>{if(await refreshCodex()||++polls>180)clearInterval(timer);},5000);}
    catch(e){$("#codexStatus").textContent=e.message;}finally{$("#codexLogin").disabled=false;}
  });
  $('#googleRefresh').addEventListener('click',()=>refreshGoogle());
  $('#googleLogin').addEventListener('click',async()=>{const popup=window.open('about:blank','roastroom-google');try{const r=await fetch('/api/google/connect',{method:'POST'}),a=await r.json();if(!r.ok)throw Error(a.error);if(!popup)throw Error('Allow the Google sign-in popup, then connect again.');popup.location.href=a.url;let polls=0;const timer=setInterval(()=>{if(popup.closed||++polls>120){clearInterval(timer);void refreshGoogle();}},2500);}catch(e){popup?.close();$('#googleStatus').textContent=e.message;}});
  $('#googleDisconnect').addEventListener('click',async()=>{try{const r=await fetch('/api/google/disconnect',{method:'POST'});if(!r.ok)throw Error('Could not disconnect Google.');$('#gscProperties').innerHTML=$('#ga4Properties').innerHTML='';$('#gscProperty').value=$('#ga4Property').value='';await refreshGoogle(false);}catch(e){toast(e.message);}});
  $('#googleUse').addEventListener('change',()=>{$('#googleOptions').hidden=!$('#googleUse').checked;});
  function clearQuote(){state.dfsQuote=null;$("#dfsApprove").checked=false;$("#dfsQuote").textContent="";}
  for(const id of ["website","seoCountry","seoLanguage","dfsBacklinks"])$("#"+id).addEventListener("input",clearQuote);
  $("#dfsUse").addEventListener("change",async()=>{clearQuote();$("#dfsOptions").hidden=!$("#dfsUse").checked;if($("#dfsUse").checked){try{const status=await fetch("/api/dataforseo/status").then(r=>r.json());$("#dfsStatus").textContent=status.configured?"Credentials saved. Preview account rates before approving a paid fetch.":"Add DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD from DataForSEO API Access to the server .env, then restart.";}catch{$("#dfsStatus").textContent="Could not check DataForSEO setup.";}}});
  $("#dfsPreview").addEventListener("click",async()=>{
    clearQuote();$("#dfsPreview").disabled=true;$("#dfsQuote").textContent="Checking current account rates. No paid data queries yet…";
    try{const r=await fetch("/api/dataforseo/preview",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({urls:$("#website").value.split(/\n+/).map(s=>s.trim()).filter(Boolean),country:$("#seoCountry").value,language:$("#seoLanguage").value,backlinks:$("#dfsBacklinks").checked})});const q=await r.json();if(!r.ok)throw new Error(q.error);state.dfsQuote=q;$("#dfsQuote").innerHTML=`<p><b>Estimated cost: $${q.estimatedUsd.toFixed(4)} · limit $5</b></p><ul>${q.requests.map(t=>`<li>${esc(t.target)} · ${esc(t.endpoint)} · up to ${t.limit} result(s) · $${t.estimatedUsd.toFixed(4)}</li>`).join("")}</ul><p>${esc(q.note)}</p>`;}catch(e){$("#dfsQuote").textContent=e.message;}finally{$("#dfsPreview").disabled=false;}
  });
  async function loadVoices() {
    try {
      const data = await speech.refresh();
      Object.assign(speech.assignments, data.assignments || {});
      const assignedNames = Object.keys(data.assignments || {}).map(key => Object.values(state.rosters || {}).flat().find(s => s.key === key)?.name || key);
      if (assignedNames.length) $("#cloneStatus").textContent = "Assigned voices: " + assignedNames.join(", ");
      const voices = speech.voices();
      $("#ttsVoice").innerHTML = `<option value="">Auto voices</option>` + voices.map(v => {
        const key = v.voiceURI.startsWith("clone-") && Object.keys(data.assignments || {}).find(key => data.assignments[key] === v.voiceURI);
        const advisor = key && Object.values(state.rosters || {}).flat().find(s => s.key === key);
        return `<option value="${esc(v.voiceURI)}">${esc(advisor ? advisor.name + " (cloned)" : v.name)}</option>`;
      }).join("");
      $("#ttsVoice").value = speech.voiceURI;
      const ready = data.status === "ready";
      try { speech.enabled=localStorage.getItem("councilVoiceEnabled")==="true"; } catch {}
      $("#ttsToggle").setAttribute("aria-pressed",String(speech.enabled));$("#ttsToggle").textContent=speech.enabled?"Voice on":"Voice off";
      $("#ttsToggle").disabled = !ready; $("#ttsTest").disabled = !ready; $("#cloneBtn").disabled = !ready || !data.voiceCloning;
      $("#ttsStatus").textContent = ready ? data.error || "Pocket TTS · local CPU · voice cloning" : data.error || "Downloading and warming Pocket TTS…";
      if (data.status === "loading") setTimeout(loadVoices, 5000);
    } catch(e) { $("#ttsStatus").textContent = e.message; $("#ttsToggle").disabled = true; $("#ttsTest").disabled = true; }
  }
  loadVoices();
  $("#ttsRefresh").addEventListener("click", loadVoices);
  $("#cloneBtn").addEventListener("click", async () => {
    const file = $("#cloneFile").files[0];
    if (!file || file.size > 10_000_000) return toast("Choose a 16-bit PCM WAV under 10 MB, 3–30 seconds long.");
    if (!$("#cloneConsent").checked) return toast("Confirm that you have permission to use this voice.");
    const key = $("#cloneSeat").value;
    $("#cloneBtn").disabled = true; $("#cloneStatus").textContent = "Creating voice…";
    try {
      const response = await fetch("/api/tts/clone", { method: "POST", headers: { "content-type": "audio/wav" }, body: file });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      const assignment = await fetch("/api/tts/assign", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ advisor: key, voice: data.voiceURI }) });
      if (!assignment.ok) throw new Error("Voice created but its assignment could not be saved. Select it from the voice menu.");
      speech.assignments[key] = data.voiceURI;
      try { localStorage.setItem("councilVoiceAssignments", JSON.stringify(speech.assignments)); } catch {}
      $("#cloneStatus").textContent = `Voice assigned to ${state.byKey[key]?.name || key}.`;
      await loadVoices();
    } catch(e) { $("#cloneStatus").textContent = e.message; } finally { $("#cloneBtn").disabled = false; }
  });
  try { speech.assignments = JSON.parse(localStorage.getItem("councilVoiceAssignments") || "{}"); } catch {}
  $("#ttsToggle").addEventListener("click", () => {
    speech.enabled = !speech.enabled;
    try { localStorage.setItem("councilVoiceEnabled",String(speech.enabled)); } catch {}
    $("#ttsToggle").setAttribute("aria-pressed", String(speech.enabled));
    $("#ttsToggle").textContent = speech.enabled ? "Voice on" : "Voice off";
    if (!speech.enabled) speech.cancel();
    else speech.say("Council voices enabled.", { onError: toast });
  });
  $("#ttsVoice").addEventListener("change", e => { speech.voiceURI = e.target.value; speech.cancel(); });
  $("#ttsTest").addEventListener("click", () => {
    speech.enabled = true; $("#ttsToggle").setAttribute("aria-pressed", "true"); $("#ttsToggle").textContent = "Voice on";
    speech.say("Welcome to the advisory council. Your selected advisors will read their key points aloud.", { onError: toast });
  });
  window.addEventListener("pagehide", () => speech.cancel());
  $("#advisorChoices").addEventListener("change", e => {
    const input = e.target;
    if (input.type !== "checkbox") return;
    input.checked ? state.picked.add(input.value) : state.picked.delete(input.value);
    state.customPicked = true;
    updateAdvisorCount();
  });
  $("#allAdvisors").addEventListener("click", () => { renderAdvisorChoices(); updateAdvisorCount(); });
  $("#advisory").addEventListener("change", () => {
    $("#prompt").value = "";
    selectAdvisory($("#advisory").value);
    $("#feed").innerHTML = guide();
  });
  $("#composer").addEventListener("submit", async (e) => {
    e.preventDefault();
    if(speech.enabled){speech.context ||= new AudioContext();void speech.context.resume();}
    const prompt = $("#prompt").value.trim();
    if (state.advisory !== "seo" && prompt.length < 10) return toast("Give the council a real decision, at least a sentence.");
    const website = $("#website").value.trim();
    if (state.advisory === "seo" && !website) return toast("Enter the website or page URL.");
    if (state.picked.size < 2) return toast("Choose at least two advisors.");
    let dataforseoApproval;
    let googleSettings;
    if(state.advisory==='seo'&&$('#googleUse').checked){if(!state.googleConnected)return toast('Connect Google first.');googleSettings={gscProperty:$('#gscProperty').value,ga4Property:$('#ga4Property').value,startDate:$('#googleStart').value||undefined,endDate:$('#googleEnd').value||undefined};if(!googleSettings.gscProperty&&!googleSettings.ga4Property)return toast('Select a Search Console and/or GA4 property.');}
    if(state.advisory === "seo" && $("#dfsUse").checked){if(!state.dfsQuote || !$("#dfsApprove").checked)return toast("Preview DataForSEO costs and approve the displayed plan first.");dataforseoApproval={id:state.dfsQuote.id,approved:true,country:$("#seoCountry").value,language:$("#seoLanguage").value,backlinks:$("#dfsBacklinks").checked};}
    const mode = $('input[name="mode"]:checked').value;
    $("#convene").disabled = true;
    try {
      if(googleSettings)$('#googleStatus').textContent='Reading selected Google reports and stored indexing information…';
      const r = await fetch("/api/council", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt, mode, country:$("#seoCountry").value,language:$("#seoLanguage").value,dataforseoApproval,googleSettings, advisory: state.advisory, website, workflow: state.advisory === "seo" ? "growth" : "debate", selectedSeats: state.advisory === "seo" || state.customPicked ? [...state.picked] : undefined }) });
      const j = await r.json();
      if (!r.ok) return toast(j.error || "Could not start the council.");
      attach(j.id);
    } catch {
      toast("Could not reach the server. Check that it is running and try again.");
    } finally {
      $("#convene").disabled = !state.hasKey;
    }
  });
  const openFrom = (e) => { const b = e.target.closest("[data-seat]"); if (b) openCard(b.dataset.seat); };
  $("#seats").addEventListener("click", openFrom);
  $("#plates").addEventListener("click", openFrom);
  $("#seats").addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openFrom(e); } });
  $("#feed").addEventListener("click", (e) => { const report=e.target.closest("[data-growth-seat]"); if(report)return openCard(report.dataset.growthSeat); if (e.target.closest("details")) return; const c = e.target.closest(".feed-card"); if (c) openCard(c.dataset.seat, Number(c.dataset.round)); });
  $("#waitHistory").addEventListener("click", openHistory);
  $("#waitGuide").addEventListener("click", openGuide);
  $("#guideBtn").addEventListener("click", openGuide);
  document.addEventListener("click", async (e) => {
    if (e.target.closest("[data-copy-example]")) {
      try { await navigator.clipboard.writeText((state.runner === "api" ? "" : "/roast-room ") + EXAMPLE); toast(state.runner === "api" ? "Copied. Paste it into the decision form." : "Copied. Paste it into Claude Code."); }
      catch { toast("Copy didn't work here. Select the text and copy it."); }
    }
    if (e.target.closest("[data-pdf]")) savePdf(e.target.closest("[data-pdf]"));
  });
  $("#historyBtn").addEventListener("click", openHistory);
  $("#newBtn").addEventListener("click", reset);
  $("#verdictSheet").addEventListener("click", (e) => { if (e.target.id === "verdictSheet" || e.target.closest("[data-close]")) $("#verdictSheet").hidden = true; });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") $("#verdictSheet").hidden = true; });
  $$(".speed button").forEach((b) => b.addEventListener("click", () => {
    player.speed = Number(b.dataset.speed);
    $$(".speed button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  }));
  $("#skipBtn").addEventListener("click", () => player.skip());
}

// ------------------------------------------------------------- the player
// Every event goes through one ordered queue. Seats speak one at a time, at a
// readable pace, even though the API answers them in parallel. Skip ahead drains
// whatever is queued instantly; new events after that animate again.
const player = {
  q: [], busy: false, epoch: 0, speed: 1, fast: false, timers: new Set(),
  push(ev) { this.q.push(ev); this.info(); this.pump(); },
  async pump() {
    if (this.busy) return;
    this.busy = true;
    const my = this.epoch;
    while (this.q.length && my === this.epoch) {
      const ev = this.q.shift();
      this.info();
      hideWait();
      try { await handle(ev); } catch (e) { console.error(e); }
    }
    if (my === this.epoch) { this.busy = false; this.fast = false; this.info(); }
  },
  sleep(ms) {
    if (this.fast || ms <= 0) return Promise.resolve();
    return new Promise((res) => { const t = setTimeout(() => { this.timers.delete(o); res(); }, ms / this.speed); const o = { t, res }; this.timers.add(o); });
  },
  flushTimers() { for (const o of this.timers) { clearTimeout(o.t); o.res(); } this.timers.clear(); },
  skip() { speech.cancel(); this.fast = true; this.flushTimers(); },
  reset() { speech.cancel(); this.epoch++; this.q.length = 0; this.fast = true; this.flushTimers(); this.busy = false; this.fast = false; this.info(); },
  info() {
    const waiting = this.q.filter((e) => ["seat_done","growth_report"].includes(e.type)).length;
    $("#queueInfo").textContent = waiting ? `${waiting} lines up next` : "";
  },
};

// ------------------------------------------------------------- session wiring
function reset() {
  state.dfsQuote=null;$("#dfsApprove").checked=false;$("#dfsQuote").textContent="";$("#seoCountry").value="";$("#seoLanguage").value="";
  state.growthReports = {}; state.growthErrors = {}; state.growthPlan = null; state.workflow = "debate";
  state.es?.close();
  player.reset();
  Object.assign(state, { session: null, options: [], weights: {}, active: [], round: 0, cards: { 1: {}, 2: {}, 3: {} }, replaying: false, verdict: null, links: [], speaking: null, setup: null, wait: null });
  hideWait();
  $("#stage").classList.remove("live");
  $("#topic").hidden = true;
  $("#composer").hidden = state.runner !== "api";
  $("#waiting").hidden = state.runner === "api";
  $("#caption").hidden = true;
  $("#cruxes").hidden = true;
  $("#plate").hidden = true;
  $("#playbar").hidden = true;
  $("#newBtn").hidden = true;
  $("#verdictSheet").hidden = true;
  $("#panelHead").textContent = "Getting started";
  $("#feed").innerHTML = guide();
  $$(".vote").forEach((b) => b.remove());
  $$(".seat").forEach((el) => { el.classList.remove("absent", "speaking", "thinking", "addressed"); $(".bust", el).dataset.shape = "base"; });
  $$(".nameplate").forEach((el) => { el.classList.remove("absent", "speaking"); $(".chip", el).hidden = true; $(".score", el).hidden = true; $(".pips", el).innerHTML = ""; });
  $("#spot").classList.remove("on");
  $$(".stepper li").forEach((li) => li.classList.remove("active", "done"));
  drawLinks();
}

function begin(id) {
  reset();
  state.session = id;
  $("#composer").hidden = true;
  $("#waiting").hidden = true;
  $("#newBtn").hidden = false;
  $("#playbar").hidden = false;
  $("#panelHead").textContent = "Key points";
  $("#feed").innerHTML = '<div class="empty">One line per seat as the council talks. Click a seat to read its full card.</div>';
  $("#stage").classList.add("live");
  chairSays("The council is taking their seats", { dots: true });
}

function attach(id) {
  begin(id);
  const es = new EventSource(`/api/stream/${id}`);
  state.es = es;
  es.onmessage = (m) => {
    const ev = JSON.parse(m.data);
    if (ev.type === "end") { es.close(); refreshUsage(); return; }
    if (ev.type === "delta") return; // seats speak from their finished cards
    if (ev.type === "usage") return refreshUsage();
    if (ev.type === "seat_error") return toast(`${state.byKey[ev.seat].short} hit an error: ${ev.error}`);
    player.push(ev);
  };
  es.onerror = () => { /* the browser retries; the server replays from the start */ };
}

// ------------------------------------------------------------- event handling
const STEP_OF = { inspect: "setup", setup: "setup", round1: "round1", cruxes: "cruxes", round2: "round2", draft: "round3", round3: "round3", skip3: "round3", verdict: "verdict" };
const ORDER = ["setup", "round1", "cruxes", "round2", "round3", "verdict"];

function setStep(step) {
  const idx = ORDER.indexOf(step);
  $$(".stepper li").forEach((li) => {
    const i = ORDER.indexOf(li.dataset.step);
    li.classList.toggle("done", i < idx);
    li.classList.toggle("active", i === idx);
  });
}

async function handle(ev) {
  switch (ev.type) {
    case "advisory": selectAdvisory(ev.advisory, ev.roster); break;
    case "evidence": state.evidence = ev.evidence; feedPhase(`Inspected ${ev.evidence.pages.length} pages. The council will discuss their HTML evidence.`); break;
    case "phase": {
      state.wait = { phase: ev.phase, label: ev.label, at: ev.at || Date.now() };
      setStep(STEP_OF[ev.phase] || "setup");
      feedPhase(ev.label);
      const thinking = ["inspect", "setup", "cruxes", "draft", "verdict"].includes(ev.phase);
      if (thinking || ev.phase === "skip3") {
        chairSays(ev.label.replace(/^The Chair is /, "").replace(/^./, (c) => c.toUpperCase()), { dots: thinking });
        await player.sleep(1400);
      }
      break;
    }
    case 'google_data': {
      const d=ev.data,section=document.createElement('section');section.className='growth-report';section.innerHTML=`<h3>Google first-party evidence</h3><p>${esc(d.current.startDate)} – ${esc(d.current.endDate)} · compared with ${esc(d.previous.startDate)} – ${esc(d.previous.endDate)}</p><p>${esc(d.geography)}</p><p>${esc(d.scope)}</p>`+['gsc','ga4'].filter(k=>d[k]).map(k=>`<details><summary>${k==='gsc'?'Search Console: queries, clicks, impressions, position and indexing':'GA4: organic landing visits, key events and purchases'} · ${esc(d[k].property)}</summary><pre>${esc(JSON.stringify(d[k],null,2))}</pre></details>`).join('')+(d.errors||[]).map(e=>`<p>${esc(e.source)}: ${esc(e.error)}</p>`).join('');feedAppend(section);break;
    }
    case "free_checks": {
      const d=ev.data;const section=document.createElement("section");section.className="growth-report";
      section.innerHTML=`<h3>Free technical checks</h3><p>${d.pages.length} crawl URLs · ${d.links.length} internal links checked · ${d.browser.length} rendered/mobile lab audits</p><p>${esc(d.scope)}</p>`+d.browser.map(b=>`<details><summary>${esc(b.url)} · mobile Lighthouse ${b.lighthouse?.categories?.performance==null?"unavailable":Math.round(b.lighthouse.categories.performance*100)+"/100 performance"}</summary><pre>${esc(JSON.stringify({comparison:b.comparison,lighthouse:b.lighthouse},null,2))}</pre></details>`).join("")+`<details><summary>Crawl, links, sitemaps and structured-data evidence</summary><pre>${esc(JSON.stringify({pages:d.pages,links:d.links,sitemaps:d.sitemaps,structuredData:d.structuredData,internalLinking:d.internalLinking,errors:d.errors},null,2))}</pre></details>`;feedAppend(section);break;
    }
    case "external_data": {
      const section=document.createElement("section");section.className="growth-report";section.innerHTML=`<h3>DataForSEO evidence</h3><p>${esc(ev.data.country)} · ${esc(ev.data.language)} · ${esc(ev.data.retrievedAt)}</p><p>Verified cost: $${ev.data.actualCostUsd.toFixed(4)} · uncertain-cost reservation: $${ev.data.reservedCostUsd.toFixed(4)}</p><p>${esc(ev.data.scope)}</p>`+ev.data.results.map(r=>`<details><summary>${esc(r.target)} · ${esc(r.endpoint)}</summary><pre>${esc(JSON.stringify(r.result,null,2))}</pre></details>`).join("")+ev.data.errors.map(e=>`<p>${esc(e)}</p>`).join("");feedAppend(section);break;
    }
    case "growth_report_error": {
      state.growthErrors ||= {}; state.growthErrors[ev.seat]=ev;
      const section=document.createElement("section");section.className="growth-report";section.innerHTML=`<h3>${esc(ev.name)} · report unavailable</h3><p>${esc(ev.error)}</p>`;feedAppend(section);$(`#seat-${ev.seat}`)?.classList.remove("thinking");break;
    }
    case "growth_report": {
      state.growthReports ||= {}; state.growthReports[ev.seat] = ev;
      const section=document.createElement("section");section.className="growth-report";
      section.innerHTML=`<h3>${esc(ev.name)}</h3><p>${esc(ev.opinion)}</p><button class="ghost" data-growth-seat="${esc(ev.seat)}">Read full advisor report</button>`+growthReportHtml(ev);
      feedAppend(section);await speak(ev.seat,firstSentences(clean(ev.opinion),500),{tag:"Ranking & growth opinion"});setSpeaker(null);break;
    }
    case "growth_discussion": {
      setStep("round2");const section=document.createElement("section");section.className="growth-report";
      section.innerHTML=`<h3>${esc(ev.name)} · council discussion</h3><p>${esc(ev.response)}</p><p><b>Evidence (${esc(ev.page)}):</b> ${esc(ev.evidence)}</p>`;feedAppend(section);
      await speak(ev.seat,clean(ev.response),{tag:"Discussing the findings"});setSpeaker(null);break;
    }
    case "growth_discussion_error": feedPhase(`${ev.name}: discussion unavailable — ${ev.error}`);$(`#seat-${ev.seat}`)?.classList.remove("thinking");break;
    case "growth_plan": {
      state.growthPlan=ev;setStep("verdict");state.wait=null;hideWait();await speak(null,firstSentences(clean(ev.summary),650),{tag:"Chair · Growth roadmap"});
      const section=document.createElement("section");section.className="growth-report roadmap";
      section.innerHTML=`<h3>Combined growth roadmap</h3><p>${esc(ev.summary)}</p><a class="ghost" href="/api/growth/${encodeURIComponent(state.session)}" download>Download full report</a>`+ev.priorities.map(a=>`<article><h4>${esc(a.when)} · ${esc(a.action)}</h4><p>${esc(a.page)} · ${esc(a.owner)}</p><p>${esc(a.reason)}</p><p><b>Dependency:</b> ${esc(a.dependency)}</p><p><b>Success check:</b> ${esc(a.successCheck)}</p></article>`).join("")+`<h4>Measurement</h4>`+ev.measurements.map(m=>`<p><b>${esc(m.metric)}:</b> ${esc(m.how)}<br>Baseline needed: ${esc(m.baselineNeeded)}</p>`).join("")+`<h4>Differences of opinion</h4>`+ev.disagreements.map(d=>`<p><b>${esc(d.issue)}:</b> ${esc(d.views.join("; "))}<br>${esc(d.resolution)}</p>`).join("")+`<h4>Missing data</h4><ul>${ev.dataNeeded.map(d=>`<li>${esc(d)}</li>`).join("")}</ul><p>${esc(ev.limitations)}</p>`;
      feedAppend(section);break;
    }
    case "audit": {
      const section = document.createElement("section"); section.className = "guide-sec audit-findings";
      section.innerHTML = `<h4>Preflight findings · ${ev.audit.findings.length}</h4><p>Checks on sampled HTML. Priorities need verification; this is not a full audit.</p>` + ev.audit.findings.map(f=>`<details><summary>${esc(f.id)} · ${esc(f.priority)} · ${esc(f.observation)}</summary><p><a href="${esc(f.url)}" target="_blank" rel="noopener noreferrer">${esc(f.url)}</a></p><p><b>Proposed fix:</b> ${esc(f.fix)}</p><p><b>Verify:</b> ${esc(f.verify)}</p></details>`).join("") + `<p>${ev.knowledge.documents.length} installed skill/reference documents available to the specialists.</p>`;
      $("#feed").appendChild(section); break;
    }
    case "setup": state.setup = ev; onSetup(ev); await player.sleep(1800); break;
    case "round_start": onRoundStart(ev.round); break;
    case "seat_start": $(`#seat-${ev.seat}`)?.classList.add("thinking"); break;
    case "seat_done": await onSeatDone(ev); break;
    case "round_done": state.wait = null; updateOptions(ev.scores); break;
    case "cruxes": await onCruxes(ev); break;
    case "draft": await onDraft(ev.draft); break;
    case "verdict": state.wait = null; onVerdict(ev); break;
    case "error": state.wait = null; toast(`The council stopped: ${ev.error}`); chairSays(`The council stopped: ${ev.error}`); break;
  }
}

function onSetup(ev) {
  state.workflow = ev.workflow || "debate";
  const labels=ev.workflow === "growth" ? ["Pages","Opinions","Opportunities","Discussion","Measurement","Roadmap"] : ["Brief","Openings","Fault lines","Debate","Vote","Verdict"];
  $$(".stepper li").forEach((li,i)=>li.textContent=labels[i]);
  selectAdvisory(ev.advisory || "business", ev.roster);
  $("#panelHead").textContent = ev.workflow === "growth" ? "Advisor growth reports" : "Key points";
  state.evidence = ev.evidence || null;
  state.options = ev.options;
  state.weights = ev.weights;
  state.active = ev.seats;
  $("#topic").hidden = false;
  $("#topicTitle").textContent = ev.title;
  typeIn($("#topicTitle"));
  $("#options").innerHTML = ev.options.map((o) => `
    <div class="opt" data-opt="${o.id}"><span class="id">${o.id}</span><span class="label">${esc(o.label)}</span><span class="val">-</span><span class="bar"><i></i></span></div>`).join("");
  for (const s of state.seats) {
    const absent = !ev.seats.includes(s.key);
    $(`#seat-${s.key}`).classList.toggle("absent", absent);
    const pl = $(`#plate-${s.key}`);
    pl.classList.toggle("absent", absent);
    const w = ev.weights[s.key]?.weight || 1;
    pl.title = `Weight ${w} of 3: ${ev.weights[s.key]?.reason || ""}`;
  }
  chairSays(ev.title, { tag: ev.mode === "quick" ? "Quick council" : "Full council" });
}

function updateOptions(scores) {
  const best = Object.entries(scores).sort((a, b) => (b[1].score ?? 0) - (a[1].score ?? 0))[0]?.[0];
  for (const [id, v] of Object.entries(scores)) {
    const el = $(`.opt[data-opt="${id}"]`); if (!el) continue;
    $(".val", el).textContent = v.score ?? "-";
    $(".bar i", el).style.width = `${(v.score || 0) * 10}%`;
    el.classList.toggle("lead", id === best);
    el.title = v.math;
  }
}

function onRoundStart(round) {
  state.round = round;
  state.links = [];
  drawLinks();
  $("#cruxes").hidden = true;
  chairSays(`${["", "Round 1: opening positions", "Round 2: the debate", "Round 3: the vote"][round]}`, { dots: true, tag: "The floor is open" });
}

// ------------------------------------------------------------- talking
const clean = (t) => String(t || "").replace(/\s*\((?:S\d+|source[^)]*)[^)]*\)/gi, "").replace(/\*\*/g, "").replace(/\s+/g, " ").trim();

function firstSentences(t, max) {
  const parts = t.match(/[^.!?]+[.!?]+["”)]?\s*|[^.!?]+$/g) || [t];
  let out = "";
  for (const p of parts) { if (out && (out + p).length > max) break; out += p; }
  return shorten(out.trim(), max + 40);
}

/** The line a seat says out loud: the headline of its card, not the whole card. */
function lineFor(round, p, max = 170) {
  if (round === 1) return firstSentences(clean(p.call || p.stance), max);
  if (round === 2) {
    let t = clean(p.disagreeLine || p.stance);
    // "Graham. His argument..." reads as talking to him: "Graham, his argument..."
    t = t.replace(/^([A-Za-z][\w.' ]{0,24})[.:,]\s+(\S+)/, (m, name, next) => !seatKey(name) ? m : `${state.byKey[seatKey(name)].short}, ${/^I('|$)/.test(next) ? next : next[0].toLowerCase() + next.slice(1)}`);
    return firstSentences(t, max);
  }
  return firstSentences(clean(p.oneLine || p.amendment), max);
}

function shapesFor(word) {
  const out = [];
  for (const ch of word.toLowerCase()) {
    const s = "aei".includes(ch) ? "open" : "ouwy".includes(ch) ? "mid" : "mbpf".includes(ch) ? "base" : null;
    if (s && s !== out[out.length - 1]) out.push(s);
  }
  return out.length ? out : ["mid"];
}

function setShape(key, shape) { const b = $(`#seat-${key} .bust`); if (b) b.dataset.shape = shape; }

function setSpeaker(key, target) {
  state.speaking = key;
  $$(".seat").forEach((el) => { el.classList.toggle("speaking", el.dataset.seat === key); el.classList.toggle("addressed", el.dataset.seat === target); });
  $$(".nameplate").forEach((el) => el.classList.toggle("speaking", el.dataset.seat === key));
  const el = key && $(`#seat-${key}`);
  if (el) {
    el.classList.remove("thinking");
    // lean toward whoever they're answering
    const g = state.geo[key], tg = target && state.geo[target];
    el.style.transform = tg ? `translateX(${Math.sign(tg.x - g.x) * g.size * 0.04}px) rotate(${Math.sign(tg.x - g.x) * 2.5}deg) scale(1.05)` : "scale(1.05)";
    moveSpot(key);
  } else $("#spot").classList.remove("on");
  $$(".seat").forEach((s) => { if (s.dataset.seat !== key) s.style.transform = ""; });
}

function captionFor(who) {
  $("#cruxes").hidden = true;
  $("#plate").hidden = true;
  const c = $("#caption");
  c.hidden = false;
  c.style.animation = "none"; void c.offsetWidth; c.style.animation = "";
  const s = state.byKey[who];
  $("#capAv").className = `cap-av${s ? "" : " chair"}`;
  $("#capAv").innerHTML = s ? avatar(who) : '<img src="/brand/ais-symbol.png" alt="">';
  $("#capWho").textContent = s ? s.name : "The Chair";
}

function chairSays(text, { dots = false, tag = "" } = {}) {
  setSpeaker(null);
  captionFor(null);
  $("#capTag").textContent = tag;
  const p = $("#capText");
  p.className = "cap-text chair";
  p.innerHTML = esc(text) + (dots ? '<span class="dots"><i></i><i></i><i></i></span>' : "");
  $("#capSub").textContent = "";
}

async function speak(key, text, { tag = "", target = null, sub = "" } = {}) {
  setSpeaker(key, target);
  captionFor(key);
  $("#capTag").textContent = tag;
  $("#capSub").textContent = "";
  const p = $("#capText");
  p.className = "cap-text";
  const words = text.split(" ").filter(Boolean);
  p.innerHTML = words.map((w) => `<span class="w">${esc(w)}</span> `).join("");
  const spoken = player.fast ? Promise.resolve(false) : speech.say(text, { rate: player.speed, index: state.seats.findIndex(s => s.key === key), key, onError: toast });
  const spans = $$(".w", p);
  for (let i = 0; i < words.length; i++) {
    if (player.fast) break;
    const w = words[i];
    spans[i].classList.add("on");
    const shapes = shapesFor(w.replace(/[^a-z]/gi, ""));
    const dur = Math.max(170, w.length * 52);
    const per = dur / (shapes.length + 1);
    for (const sh of shapes) { setShape(key, sh); await player.sleep(per); }
    setShape(key, "base");
    await player.sleep(per + (/[.!?]["”)]?$/.test(w) ? 340 : /[,;:]$/.test(w) ? 170 : 25));
  }
  await spoken;
  spans.forEach((s) => s.classList.add("on"));
  setShape(key, "base");
  $("#capSub").innerHTML = sub;
  await player.sleep(1300);
}

// idle blinking for everyone, so the room feels alive between lines
const blinkingSeats = new Set();
function startBlinking() {
  const blink = (key) => {
    const b = $(`#seat-${key} .bust`);
    if (b && b.dataset.shape === "base") {
      b.dataset.shape = "blink";
      setTimeout(() => { if (b.dataset.shape === "blink") b.dataset.shape = "base"; }, 130);
    }
    setTimeout(() => blink(key), 2400 + Math.random() * 4200);
  };
  state.seats.forEach((s, i) => {
    if (blinkingSeats.has(s.key)) return;
    blinkingSeats.add(s.key);
    setTimeout(() => blink(s.key), 600 + i * 530);
  });
}

async function onSeatDone(ev) {
  const { round, seat, text, parsed, quotes } = ev;
  state.cards[round][seat] = { text, parsed, quotes };
  const s = state.byKey[seat];
  const top = topOption(parsed.optionScores);
  const line = lineFor(round, parsed);
  let tag = ROUND_NAME[round], sub = "", target = null;
  if (round === 1) {
    tag = `${stanceWord(parsed.stance)}${top ? ` · backs ${top.id} (${top.v}/10)` : ""}`;
  } else if (round === 2) {
    const tgt = parsed.disagreeWith ? state.byKey[parsed.disagreeWith] : null;
    if (tgt) {
      target = tgt.key;
      tag = `Pushes back on ${tgt.short}`;
      state.links = state.links.filter((l) => l.from !== seat);
      state.links.push({ from: seat, to: tgt.key });
      drawLinks();
    }
    sub = /^yes/i.test(parsed.moved) ? "Changed position" : "";
  } else {
    const v = parsed.vote || "endorse";
    tag = `Votes ${v}`;

  }
  feedCard(round, seat, parsed);
  await speak(seat, line || "I'll put it in my card.", { tag, target, sub });

  const pl = $(`#plate-${seat}`);
  const chip = $(".chip", pl);
  chip.hidden = round === 3; // the vote stamp says it
  chip.className = "chip";
  if (round === 3) {
    const v = parsed.vote || "endorse";
    chip.textContent = v;
    chip.classList.add(v);
    $(`#seat-${seat} .vote`)?.remove();
    const stamp = document.createElement("div");
    stamp.className = `vote ${v}`;
    stamp.textContent = v.toUpperCase();
    $(`#seat-${seat}`).appendChild(stamp);
  } else chip.textContent = stanceWord(parsed.stance);
  if (top) { const sc = $(".score", pl); sc.hidden = false; sc.textContent = `${top.id} ${top.v}`; sc.title = `Highest score: option ${top.id}`; }
  setSpeaker(null);
  void s;
}

function stanceWord(t = "") {
  const m = t.match(/strong yes|conditional yes|strong no|yes|no/i);
  if (!m) return "Spoke";
  const w = m[0].toLowerCase();
  return w === "conditional yes" ? "Yes, if" : w[0].toUpperCase() + w.slice(1);
}

function topOption(scores = {}) {
  const e = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return e ? { id: e[0], v: e[1] } : null;
}
const shorten = (t, n) => (t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : t);
const face = (k) => avatar(k);

async function onCruxes(ev) {
  setSpeaker(null);
  $("#caption").hidden = true;
  const c = $("#cruxes");
  c.hidden = false;
  c.innerHTML = `<div class="head">${ev.unanimous ? "Too much agreement. The Chair pushes back." : "What they're fighting about"}</div>` +
    ev.cruxes.map((x, i) => `<div class="crux" style="animation-delay:${i * 0.18}s"><b>${esc(x.question)}</b><div class="sides">${x.sides.map((sd) => `<span class="side"><span class="faces">${sd.seats.filter((k) => state.byKey[k]).map(face).join("")}</span>${esc(shorten(sd.position, 48))}</span>`).join("")}</div></div>`).join("");
  const f = document.createElement("div");
  f.className = "feed-note";
  f.innerHTML = `<b>The fight:</b> ${ev.cruxes.map((x) => esc(x.question)).join(" ")}`;
  feedAppend(f);
  await player.sleep(3500 + 1800 * ev.cruxes.length);
}

async function onDraft(d) {
  chairSays(`Proposal: ${d.label} on option ${d.option}. ${firstSentences(clean(d.recommendation), 140)}`, { tag: "Up for a vote" });
  const f = document.createElement("div");
  f.className = "feed-note";
  f.innerHTML = `<b>Up for a vote:</b> ${esc(d.label)} on option ${esc(d.option)}.`;
  feedAppend(f);
  await player.sleep(4200);
}

// ------------------------------------------------------------- rebuttal arcs
function drawLinks() {
  const svg = $("#links");
  const stage = $("#stage");
  const w = stage.clientWidth, h = stage.clientHeight;
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  const links = state.links || [];
  const col = "#38bdf8";
  svg.innerHTML = `<defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${col}"/></marker></defs>` +
    links.map(({ from, to }, i) => {
      const a = state.geo[from], b = state.geo[to];
      if (!a || !b) return "";
      const y1 = a.top - 6, y2 = b.top - 6;
      const mx = (a.x + b.x) / 2, my = Math.min(y1, y2) - Math.min(90, Math.abs(a.x - b.x) * 0.22) - 10;
      return `<path class="${i < links.length - 1 ? "old" : ""}" d="M${a.x},${y1} Q${mx},${my} ${b.x},${y2}" stroke="${col}" marker-end="url(#arrow)"/>`;
    }).join("");
}

// ------------------------------------------------------------- feed + cards
function feedAppend(node) {
  const feed = $("#feed");
  $(".empty", feed)?.remove();
  feed.appendChild(node);
  feed.scrollTop = feed.scrollHeight;
}
function feedPhase(label) {
  const d = document.createElement("div");
  d.className = "feed-phase";
  d.textContent = label.replace(/^The Chair is /, "Chair: ");
  feedAppend(d);
}
function feedCard(round, seat, parsed) {
  const s = state.byKey[seat];
  const d = document.createElement("div");
  d.className = "feed-card";
  d.dataset.seat = seat;
  d.dataset.round = round;
  const top = topOption(parsed.optionScores);
  const tgt = parsed.disagreeWith ? state.byKey[parsed.disagreeWith]?.short : "";
  const what = round === 1 ? `${stanceWord(parsed.stance)}${top ? `, backs ${top.id}` : ""}` : round === 2 ? (tgt ? `vs ${tgt}` : "Debate") : `Votes ${parsed.vote || "endorse"}`;
  const raw = state.cards[round]?.[seat]?.text || "";
  const auditText = state.advisory === "seo" ? raw.match(/(?:AUDIT FINDINGS|ACTION DETAIL):\s*([\s\S]*)/i)?.[1] : "";
  d.innerHTML = `${avatar(seat, "av")}` + `<div><div class="h">${esc(s.short)}<span class="r">${esc(what)}</span></div><p>${esc(lineFor(round, parsed, 105))}</p>${auditText ? `<details class="seat-findings"><summary>Specific findings &amp; fixes</summary><pre>${esc(auditText)}</pre></details>` : ""}<small>Click the card for the full analysis.</small></div>`;
  feedAppend(d);
}

function growthReportHtml(r) {
  return `<h4>Observed strengths</h4>`+r.strengths.map(s=>`<p><b>${esc(s.page)}</b><br>${esc(s.evidence)}<br>${esc(s.meaning)}</p>`).join("")+`<h4>Ranking &amp; growth opportunities</h4>`+r.opportunities.map(o=>`<details open><summary>${esc(o.priority)} · ${esc(o.opportunity)}</summary><p><b>Page:</b> ${esc(o.page)}</p><p><b>Evidence:</b> ${esc(o.evidence)}</p><p><b>Change:</b> ${esc(o.change)}</p><p><b>Example:</b> ${esc(o.example)}</p><p><b>Dependency:</b> ${esc(o.dependency)}</p><p><b>Verify:</b> ${esc(o.verification)}</p></details>`).join("")+`<h4>Content &amp; distribution ideas</h4>`+r.contentIdeas.map(i=>`<p><b>${esc(i.idea)}</b> (${esc(i.page)})<br>${esc(i.readerNeed)}<br>Original evidence needed: ${esc(i.originalEvidenceNeeded)}</p>`).join("")+`<h4>Data needed</h4><ul>${r.dataNeeded.map(d=>`<li>${esc(d)}</li>`).join("")}</ul>`;
}
function openCard(seat, round) {
  const s = state.byKey[seat];
  const growth=state.growthReports?.[seat];
  if(growth){$("#cardBody").innerHTML=`<div class="card-head">${avatar(seat)}<h3>${esc(s.name)}</h3></div><p>${esc(growth.opinion)}</p>`+growthReportHtml(growth);$("#cardDialog").showModal();return;}
  const rounds = [3, 2, 1].filter((r) => state.cards[r][seat]);
  const r = round || rounds[0];
  const c = state.cards[r]?.[seat];
  $("#cardBody").innerHTML = `
    <div class="card-head">${avatar(seat)}<div><div class="label">${esc(s.pillar)}</div><h3>${esc(s.name)}</h3><p class="muted" style="margin:0">Owns the question: ${esc(s.question)}</p></div></div>
    ${rounds.length > 1 ? `<p style="margin:0 0 6px">${rounds.slice().reverse().map((x) => `<button class="ghost" data-r="${x}" style="margin-right:6px">${ROUND_NAME[x]}</button>`).join("")}</p>` : ""}
    ${s.summary ? `<p>${esc(s.summary)}</p>` : ""}
    ${c ? `<pre>${esc(c.text)}</pre>${c.quotes.length ? `<ul class="qcheck">${c.quotes.map((q) => `<li class="${q.verified ? "" : "bad"}">"${esc(shorten(q.quote, 110))}" (${q.source}) ${q.verified ? "verified in the brain" : "not found in the brain"}</li>`).join("")}</ul>` : ""}` : `<p class="muted">This seat has not spoken yet.</p>`}
    ${s.skills?.length ? `<h4>Installed SEO skills</h4><ul>${s.skills.map(skill=>`<li>${esc(skill.id)}</li>`).join("")}</ul><p>Guidance applied to supplied evidence. External data tools are not connected.</p>` : ""}
    ${s.sources?.length ? `<h4>Public sources behind this personality</h4><ul>${s.sources.map(source => `<li><a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.id)}: ${esc(source.title)}</a></li>`).join("")}</ul><p class="muted">Curated paraphrases; voice and debate tensions are editorial interpretations.</p>` : ""}
    <p class="muted" style="font-size:12px">A simulated advisor inspired by ${esc(s.name)}'s public work. Not the person; no affiliation or endorsement.</p>`;
  $$("#cardBody [data-r]").forEach((b) => b.addEventListener("click", () => openCard(seat, Number(b.dataset.r))));
  const dlg = $("#cardDialog");
  if (!dlg.open) dlg.showModal();
}

// ------------------------------------------------------------- verdict
// the Chair should write display names; map any raw seat key just in case
const seatKey = (x) => { const k = String(x).toLowerCase().replace(/\s+/g, ""); return state.byKey[k] ? k : state.seats.find((s) => s.short.toLowerCase() === String(x).toLowerCase() || s.name.toLowerCase() === String(x).toLowerCase())?.key; };
const seatName = (x) => state.byKey[seatKey(x)]?.short || x;

function labelClass(l) { return /DON'T/.test(l) ? "dont" : /RESHAPE/.test(l) ? "reshape" : /WAIT/.test(l) ? "wait" : "go"; }

function onVerdict(ev) {
  const v = ev.verdict;
  state.verdict = ev;
  setStep("verdict");
  setSpeaker(null);
  $("#caption").hidden = true;
  $("#cruxes").hidden = true;
  state.links = [];
  drawLinks();
  $("#stage").classList.remove("live");
  updateOptions(v.scores);
  const opt = (id) => state.options.find((o) => o.id === id)?.label || id;
  const seats = ev.seats;
  const mk = seatKey(v.minority.seat);
  const short = (t, n) => esc(shorten(clean(t || ""), n));
  const html = `
    <div class="v-top">
      <div><div class="label">The council's verdict</div><span class="v-label ${labelClass(v.label)}">${esc(v.label)}</span></div>
      <div class="actions"><button class="pill" type="button" data-pdf>Download PDF</button><button class="ghost" data-close>Back to the table</button></div>
    </div>
    <p class="v-call">${esc(v.call)}</p>
    <div class="v-grid">
      <div class="v-sec"><h3>Scores</h3><div class="v-opts">${state.options.map((o) => `
        <div class="opt ${o.id === v.recommended ? "lead" : ""}"><span class="id">${o.id}</span><span class="label">${esc(o.label)}</span><span class="val">${v.scores[o.id]?.score ?? "-"}</span><span class="bar"><i style="width:${(v.scores[o.id]?.score || 0) * 10}%"></i></span></div>`).join("")}</div>
        <p class="v-meta">Confidence ${v.confidence ?? "-"}/10${v.votes ? ` · ${v.votes.endorse || 0} endorse, ${v.votes.amend || 0} amend, ${v.votes.dissent || 0} dissent` : ""}</p>
      </div>
      <div class="v-sec"><h3>Why</h3><ul class="v-why">${v.why.slice(0, 3).map((w) => { const k = seatKey(w.seat); return `<li>${k ? avatar(k, "av") : ""}<span>${short(w.point, 150)}</span></li>`; }).join("")}</ul></div>
      <div class="v-sec"><h3>Watch out</h3><div class="minority"><div class="who">${mk ? avatar(mk, "av") : ""}${esc(seatName(v.minority.seat))}</div><q>${short(v.minority.quote, 170)}</q></div></div>
      <div class="v-sec"><h3>Next steps</h3><ul class="v-steps">${v.next_steps.slice(0, 3).map((n) => `<li><b>${esc(n.when)}</b> ${short(n.action, 120)}</li>`).join("")}</ul>
        <p class="v-meta"><b>Kill it if:</b> ${short(v.kill_criteria, 140)}</p></div>
    </div>
    <details class="v-more"><summary>Full detail</summary>
      <div class="v-grid">
        <div class="v-sec"><h3>Where they fought</h3><ul>${v.fights.map((f) => `<li><b>${esc(f.crux)}</b> ${esc(f.story)}</li>`).join("")}</ul></div>
        <div class="v-sec"><h3>Conditions</h3><ol>${v.conditions.map((c) => `<li>${esc(c)}</li>`).join("")}</ol></div>
        <div class="v-sec v-wide"><h3>Scorecard</h3>
          <table class="scorecard"><thead><tr><th>Seat</th><th>Weight</th>${state.options.map((o) => `<th>${o.id}</th>`).join("")}<th>Their line</th></tr></thead><tbody>
          ${seats.map((x) => { const s = state.byKey[x.key]; return `<tr><td><span class="who">${avatar(x.key, "av")}${esc(s.short)}</span></td><td class="n">${x.weight}</td>${state.options.map((o) => `<td class="n">${x.optionScores?.[o.id] ?? "-"}</td>`).join("")}<td class="line">${short(x.oneLine, 150)}</td></tr>`; }).join("")}
          </tbody></table>
          <p class="muted" style="font-size:11.5px;margin-top:8px">Weighted by how much each pillar matters here. ${state.options.map((o) => `${o.id}: ${esc(v.scores[o.id]?.math || "")}`).join(" · ")}</p></div>
        <div class="v-sec"><h3>Cheapest test</h3><p>${esc(v.cheapest_test)}</p><h3>Revisit</h3><p>${esc(v.revisit)}</p></div>
        <div class="v-sec"><h3>The strongest objection in full</h3><p>${esc(v.minority.quote)}</p><p class="muted">For this to be right: ${esc(v.minority.would_have_to_be_true)}</p></div>
        ${v.amendments?.length ? `<div class="v-sec v-wide"><h3>Amendments</h3><ul>${v.amendments.map((a) => `<li><b>${esc(seatName(a.seat))}:</b> ${esc(a.amendment)} <span class="tag">${a.adopted ? "Adopted" : "Not adopted"}: ${esc(a.reason)}</span></li>`).join("")}</ul></div>` : ""}
      </div>
    </details>
    <div class="v-foot"><span class="muted">${esc(v.disclaimer)}</span><button class="ghost" data-close>Back to the table</button></div>`;
  $("#verdictBody").innerHTML = html;
  const plate = $("#plate");
  plate.hidden = false;
  plate.innerHTML = `<div class="label">The council's verdict</div><span class="v-label ${labelClass(v.label)}">${esc(v.label)}</span><p>${esc(firstSentences(clean(v.call), 150))}</p><div class="row"><button type="button" id="plateOpen">Read the verdict</button><button type="button" data-pdf>Download PDF</button><button type="button" class="alt" id="plateReplay">Replay this council</button></div>`;
  $("#plateOpen").addEventListener("click", () => ($("#verdictSheet").hidden = false));
  $("#plateReplay").addEventListener("click", () => replay(state.session));
  $("#playbar").hidden = true;
  const f = document.createElement("div");
  f.className = "feed-note";
  f.innerHTML = `<b>Verdict: ${esc(v.label)}.</b> ${esc(firstSentences(clean(v.call), 160))}`;
  feedAppend(f);
  setTimeout(() => { if (state.verdict === ev) $("#verdictSheet").hidden = false; }, 1600);
}

// ------------------------------------------------------------- history + replay
async function openHistory() {
  const { sessions } = await fetch("/api/sessions").then((x) => x.json());
  $("#historyList").innerHTML = sessions.length
    ? sessions.map((s) => `<li><button data-id="${esc(s.id)}"><b>${esc(s.title)}</b><small>${esc(s.id.slice(0, 10))} · ${s.advisory === "seo" ? "SEO" : "Business"} · ${esc(s.mode)} · ${esc(s.status)}</small></button>${s.workflow === "growth" ? `<a class="ghost" href="/api/growth/${encodeURIComponent(s.id)}" download>Report</a>` : s.status === "done" ? `<button class="pdf" type="button" data-pdf="${esc(s.id)}" title="Download the verdict as a PDF">PDF</button>` : ""}</li>`).join("")
    : '<li class="muted">No sessions yet. Convene the council once and it shows up here.</li>';
  $$("#historyList button[data-id]").forEach((b) => b.addEventListener("click", () => { $("#historyDialog").close(); replay(b.dataset.id); }));
  $("#historyDialog").showModal();
}

async function replay(id) {
  const j = await fetch(`/api/sessions/${encodeURIComponent(id)}`).then((x) => x.json());
  begin(id);
  state.replaying = true;
  for (const ev of j.events) {
    if (["delta", "usage", "seat_error", "end"].includes(ev.type)) continue;
    player.push(ev);
  }
}

// ------------------------------------------------------------- waiting on Claude Code
// A live council goes quiet for minutes while the seats write in parallel. Instead of a
// frozen table, say what is happening, how long it has been, and what each seat is weighing.
const sameTime = () => state.provider === "codex" ? "The advisors use gpt-6.1-sol in a subscription queue. Each response plays when ready." : state.runner === "api" ? "The advisors write in parallel. Their answers stream into the room." : "The advisors all write at the same time in Claude Code. Their lines play here as soon as the round is in.";
function waitCopy(phase) {
  const n = state.setup?.mode === "quick" ? 2 : 3;
  return {
    inspect: ["Reading website", "Inspecting public pages, robots.txt and sitemap.xml.", "The debate starts after the page evidence is collected."],
    setup: ["Setting the table", "The Chair is seating the council.", ""],
    round1: ["Round 1 of " + n, "The advisors are writing their opening positions.", sameTime()],
    round2: ["Round 2 of " + n, "The advisors are reading each other's openings and firing back.", sameTime()],
    round3: ["Round 3 of " + n, "The advisors are voting on the Chair's proposal.", sameTime()],
    cruxes: ["Between rounds", "The Chair is reading the openings and finding where they disagree.", "The fight shows up here next, then the debate starts."],
    draft: ["Between rounds", "The Chair is turning the debate into a proposal for the vote.", "Next, every advisor votes on it."],
    skip3: ["Last step", "The Chair is scoring the room and writing the verdict.", "When it lands, you can download it as a PDF."],
    verdict: ["Last step", "The Chair is scoring the room and writing the verdict.", "When it lands, you can download it as a PDF."],
  }[phase] || ["Working", "The council is working.", ""];
}
const clock = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };

function hideWait() {
  const w = $("#waitcard");
  if (w.hidden) return;
  w.hidden = true;
  $$(".seat.musing").forEach((e) => e.classList.remove("musing"));
  if (state.capWasShown) $("#caption").hidden = false;
  if (state.playbarWasShown) $("#playbar").hidden = false;
}

function tickWait() {
  const w = state.wait;
  const idle = !player.busy && !player.q.length;
  if (!w || !idle || state.replaying || !state.session || state.verdict) return hideWait();
  const card = $("#waitcard");
  if (card.hidden) {
    state.capWasShown = !$("#caption").hidden;
    $("#caption").hidden = true;
    $("#cruxes").hidden = true;
    // speed controls do nothing while the room waits, and they would cover the card
    state.playbarWasShown = !$("#playbar").hidden;
    $("#playbar").hidden = true;
    card.hidden = false;
    state.museAt = 0;
  }
  const [step, head, sub] = state.workflow === "growth" ? [w.phase === "verdict" ? "Growth roadmap" : "Advisor reports",w.label || "The specialists are reviewing your pages.",`${Object.keys(state.growthReports || {}).length} of ${state.active.length} reports ready. Independent reviews run in a paced queue.`] : waitCopy(w.phase);
  const elapsed = Date.now() - w.at;
  $("#wcStep").textContent = step;
  $("#wcTime").textContent = clock(elapsed);
  $("#wcHead").textContent = head;
  $("#wcSub").textContent = sub;
  $("#wcNudge").hidden = elapsed < 4 * 60 * 1000;
  $("#wcNudge").textContent = state.runner === "api" ? "Taking longer than expected? Check the server logs and your provider's quota." : "Nothing new for a while? Check Claude Code. It may be waiting for you to answer or approve something.";
  const round = Number((w.phase.match(/^round(\d)$/) || [])[1]) || 0;
  const bar = $("#wcBar").parentElement;
  const muse = $("#wcMuse");
  if (round) {
    const seats = state.active.length ? state.active : state.seats.map((s) => s.key);
    const done = seats.filter((k) => state.workflow === "growth" ? state.growthReports?.[k] || state.growthErrors?.[k] : state.cards[round][k]).length;
    bar.classList.toggle("indeterminate", done === 0);
    $("#wcBar").style.width = done ? Math.round((done / seats.length) * 100) + "%" : "";
    // every few seconds, show what one of the still-thinking seats is weighing
    const pending = seats.filter((k) => state.workflow === "growth" ? !state.growthReports?.[k] && !state.growthErrors?.[k] : !state.cards[round][k]);
    if (pending.length && Date.now() - (state.museAt || 0) > 5200) {
      state.museAt = Date.now();
      state.museIdx = ((state.museIdx ?? -1) + 1) % pending.length;
      const s = state.byKey[pending[state.museIdx]];
      muse.classList.add("fade");
      setTimeout(() => {
        muse.innerHTML = "<b>" + esc(s.short) + "</b> is weighing: " + esc(s.question.replace(/^./, (c) => c.toLowerCase())) + (done ? " · " + done + " of " + seats.length + " in" : "");
        muse.classList.remove("fade");
        $$(".seat").forEach((el) => el.classList.toggle("musing", el.dataset.seat === s.key));
      }, 300);
    }
  } else {
    bar.classList.add("indeterminate");
    $("#wcBar").style.width = "";
    muse.textContent = "";
    $$(".seat.musing").forEach((e) => e.classList.remove("musing"));
  }
}

function openGuide() {
  $("#guideBody").innerHTML = guide();
  const d = $("#guideDialog");
  if (!d.open) d.showModal();
}

// ------------------------------------------------------------- PDF
async function savePdf(btn) {
  const id = btn.dataset.pdf;
  btn.disabled = true;
  const old = btn.textContent;
  btn.textContent = "Making PDF...";
  try {
    let setup = state.setup, verdict = state.verdict;
    if (id) { // a past session from the history list
      const j = await fetch("/api/sessions/" + encodeURIComponent(id)).then((x) => x.json());
      setup = j.events.find((e) => e.type === "setup");
      verdict = [...j.events].reverse().find((e) => e.type === "verdict");
    }
    if (!setup || !verdict) throw new Error("This council has no verdict yet.");
    const pdfRoster = setup.roster || state.rosters[setup.advisory || "business"];
    await downloadVerdictPdf({ setup, verdict, byKey: Object.fromEntries(pdfRoster.map(s => [s.key, s])), id: id || state.session });
  } catch (e) {
    console.error(e);
    toast("Couldn't make the PDF: " + (e.message || e));
  } finally {
    btn.disabled = false;
    btn.textContent = old;
  }
}

// ------------------------------------------------------------- misc
let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 6000);
}
async function refreshUsage() {
  const u = await fetch("/api/usage").then((x) => x.json()).catch(() => null);
  if (!u || !u.calls) { $("#usage").textContent = ""; return; }
  const k = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : `${Math.round(n / 1000)}k`);
  $("#usage").textContent = `${u.calls} calls · ${k(u.input + u.cacheRead + u.cacheWrite)} in · ${k(u.output)} out`;
}

boot();

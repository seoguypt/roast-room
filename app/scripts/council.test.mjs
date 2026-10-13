import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
process.env.AI_PROVIDER = "omniroute";
process.env.OMNIROUTE_API_KEY = "fixture-key";
const { startCouncil, validateSelectedSeats, normalizeChairSeats, listSaved, loadSaved } = await import("../lib/council.mjs");
const { SESSIONS_DIR } = await import("../lib/env.mjs");
const { SEO_SEATS } = await import("../lib/seo-seats.mjs");
const keys = ["bezos", "graham", "hormozi", "garyvee", "martell", "wickman", "buffett"];
const evidence = { submittedUrl: "https://example.com/", pages: [{ url: "https://example.com/", status: 200, title: "Fixture page", h1Count: 1, wordCount: 30 }], limitations: "Sampled fixture HTML, not a full crawl" };

function fill(schema) {
  if (schema.enum) return schema.enum[0];
  if (schema.type === "object") return Object.fromEntries(Object.entries(schema.properties).map(([k, s]) => [k, fill(s)]));
  if (schema.type === "array") return [];
  if (schema.type === "boolean") return false;
  if (["number", "integer"].includes(schema.type)) return 1;
  return "Fixture";
}

test("SEO and Business councils complete, save, and replay with their own rosters", async () => {
  const original = globalThis.fetch;
  let currentAdvisory, title, requests, selected;
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    requests.push(body);
    if (currentAdvisory === "seo") {
      assert.match(body.messages[0].content, /SEO advisory/);
      assert.match(body.messages.at(-1).content, /Fixture page/);
    }
    if (body.stream) {
      const card = "SEAT: Fixture\nSTANCE: Yes\nOPTION SCORES: A 8/10 · B 5/10\nPILLAR SCORE: 8/10\nCONFIDENCE: 4/5\nRUIN RISK: none\nDOOR: two-way\nVOTE: Endorse\nFINAL SCORE: 8/10\nFINAL PILLAR SCORE: 8/10\nTHE CALL: Prioritize plan A.\nONE LINE FOR THE FOUNDER: Validate the fix.\n";
      return new Response(`data: ${JSON.stringify({ choices: [{ delta: { content: card }, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`);
    }
    const schema = JSON.parse(body.messages[0].content.split("No markdown or commentary.\n")[1]);
    const result = fill(schema);
    const activeKeys = selected || (currentAdvisory === "seo" ? SEO_SEATS.map(s => s.key) : keys);
    if (schema.properties.title) {
      assert.deepEqual(schema.properties.quick_seats.items.enum, activeKeys);
      Object.assign(result, { title, decision: "Prioritize the first plan", brief: "Fixture brief", options: [{ id: "A", label: "Fix first" }, { id: "B", label: "Verify first" }], weights: activeKeys.map(seat => ({ seat, weight: 1, reason: "Fixture" })), quick_seats: activeKeys.slice(0, 4) });
    }
    if (schema.properties.option) result.option = "A";
    if (schema.properties.why) { result.why = [{ point: "Evidence-led fix", seat: currentAdvisory === "seo" ? "Aleyda" : "Bezos", framework: "Verify" }]; result.next_steps = [{ when: "This week", action: "Validate" }]; }
    return Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(result) } }] });
  };
  try {
    for (const advisory of ["seo", "business", "seo"]) {
      selected = currentAdvisory === "business" ? ["aleyda", "charles"] : undefined;
      currentAdvisory = advisory;
      title = `test-${advisory}-${Date.now()}`;
      requests = [];
      const session = startCouncil("Which action should be prioritized?", advisory === "seo" ? "full" : "quick", advisory, "https://example.com/", { inspect: async () => evidence, selectedSeats: selected });
      const deadline = Date.now() + 15000;
      while (session.status === "running" && Date.now() < deadline) await new Promise(r => setTimeout(r, 20));
      try {
        assert.equal(session.status, "done", JSON.stringify(session.events.find(e => e.type === "error")));
        const setup = session.events.find(e => e.type === "setup");
        assert.equal(setup.advisory, advisory);
        if (selected) { assert.deepEqual(setup.seats, selected); assert.deepEqual(setup.roster.map(s => s.key), selected); }
        assert.equal(setup.roster[0].name, advisory === "seo" ? "Aleyda Solis" : "Jeff Bezos");
        assert.equal(listSaved().find(s => s.id === session.id).advisory, advisory);
        assert.equal(loadSaved(session.id).events.find(e => e.type === "setup").roster[0].name, setup.roster[0].name);
        assert.equal(session.state.verdict.recommended, "A");
        if (advisory === "seo") {
          assert.equal(requests.filter(r => r.stream).length, 3 * (selected?.length || SEO_SEATS.length));
          assert.ok(fs.existsSync(path.join(session.dir, "evidence.json")));
          assert.match(fs.readFileSync(path.join(session.dir, "verdict.md"), "utf8"), /Website evidence/);
          assert.match(fs.readFileSync(path.join(session.dir, "round-1.md"), "utf8"), /Aleyda Solis/);
          for (const seat of SEO_SEATS.filter(s => !selected || selected.includes(s.key))) assert.ok(requests.some(r => r.stream && r.messages[0].content.includes(`simulated ${seat.name} seat`)));
        } else assert.equal(requests.filter(r => r.stream).length, 8);
      } finally {
        // Delete only this uniquely named fixture directory's known output files.
        if (session.dir && path.dirname(session.dir) === SESSIONS_DIR && path.basename(session.dir).endsWith(title)) {
          for (const file of ["events.json", "evidence.json", "brief.md", "round-1.md", "round-2.md", "round-3.md", "verdict.md"]) fs.rmSync(path.join(session.dir, file), { force: true });
          fs.rmdirSync(session.dir);
        }
      }
    }
  } finally { globalThis.fetch = original; }
});

test("Advisor selection rejects empty, duplicate, foreign and unknown seats", () => {
  for (const seats of [[], ["aleyda"], ["aleyda", "aleyda"], ["aleyda", "bezos"], "all", ["aleyda", "unknown"]]) assert.throws(() => validateSelectedSeats("seo", seats));
  assert.doesNotThrow(() => validateSelectedSeats("seo", ["julian", "charles"]));
  assert.doesNotThrow(() => validateSelectedSeats("business", undefined));
});

test("Chair seat references normalize known names without admitting excluded advisors", () => {
  const schema={type:"object",properties:{seats:{type:"array",items:{enum:["julian","charles"]}}}};
  assert.deepEqual(normalizeChairSeats({seats:["Julian Goldie","Floate","aleyda"]},schema,SEO_SEATS.filter(s=>["julian","charles"].includes(s.key))),{seats:["julian","charles","aleyda"]});
});

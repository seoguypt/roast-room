import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT, env } from "./env.mjs";
let child, starting;
async function worker() {
  if (starting) return starting;
  starting = (async () => {
    const python = path.join(REPO_ROOT, ".venv-tts", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
    if (!fs.existsSync(python)) throw new Error("Install Pocket TTS with npm run tts:setup first.");
    child = spawn(python, [path.join(REPO_ROOT, "app/tts/worker.py")], { cwd: REPO_ROOT, windowsHide: true, env: { ...process.env, HF_TOKEN: env("HF_TOKEN"), HF_HUB_DISABLE_PROGRESS_BARS: "1" }, stdio: ["ignore", "pipe", "ignore"] });
    child.stdout.on("data", data => { for (const line of String(data).trim().split("\n")) { try { const j = JSON.parse(line); if (j.engine === "pocket-tts") console.log("[tts]", JSON.stringify(j)); } catch {} } });
    child.on("error", () => { starting = null; });
    child.on("exit", () => { starting = null; child = null; });
    for (let i = 0; i < 120; i++) { try { await fetch("http://127.0.0.1:4731/status", { signal: AbortSignal.timeout(1000) }); return; } catch { await new Promise(r => setTimeout(r, 500)); } }
    throw new Error("Pocket TTS worker could not start. Check its Python installation.");
  })();
  try { await starting; } catch(e) { starting = null; throw e; }
}
process.on("exit", () => child?.kill());
export async function ttsRequest(route, body) {
  await worker();
  return fetch(`http://127.0.0.1:4731/${route}`, { method: body ? "POST" : "GET", headers: body ? { "content-type": route === "clone" ? "audio/wav" : "application/json" } : {}, body, signal: AbortSignal.timeout(180000) });
}

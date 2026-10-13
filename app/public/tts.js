// Local Pocket TTS: the browser sends text to this app's CPU worker only.
export class LocalSpeech {
  constructor() { this.enabled = false; this.voiceURI = ""; this.catalog = []; this.pending = null; this.assignments = {}; this.context = null; }
  voices() { return this.catalog; }
  async refresh() {
    const response = await fetch("/api/tts/status"); const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Pocket TTS is unavailable.");
    this.catalog = data.voices || []; return data;
  }
  cancel() {
    const pending = this.pending; this.pending = null;
    if (!pending) return;
    pending.controller.abort(); for (const source of pending.sources || []) { try { source.stop(); } catch {} } pending.finish(false);
  }
  say(text, { rate = 1, index = 0, key = "", onError = () => {} } = {}) {
    this.cancel();
    if (!this.enabled || !this.catalog.length || !text.trim()) return Promise.resolve(false);
    const assigned = this.assignments[key];
    const voice = this.catalog.some(v=>v.voiceURI===assigned) ? assigned : this.catalog.some(v=>v.voiceURI===this.voiceURI) ? this.voiceURI : this.catalog[Math.max(0, index) % this.catalog.length].voiceURI;
    const controller = new AbortController();
    return new Promise(resolve => {
      let settled = false;
      const finish = success => { if (settled) return; settled = true; clearTimeout(timer);  if (this.pending?.controller === controller) this.pending = null; resolve(success); };
      const timer = setTimeout(() => { if (this.pending?.controller === controller) this.cancel(); onError("Voice generation timed out; captions continue."); }, 180000);
      const pending = this.pending = { controller, finish, sources: [] };
      this.context ||= new AudioContext();
      const context = this.context;
      const resume = context.resume();
      (async () => {
        try {
          const response = await fetch("/api/tts/speech", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, voice, stream: true }), signal: controller.signal });
          if (!response.ok) { const data = await response.json(); throw new Error(data.error || "Pocket TTS unavailable."); }
          await resume;
          const sampleRate = Number(response.headers.get("X-Sample-Rate"));
          if (!sampleRate) throw new Error("Invalid Pocket TTS audio stream.");
          const reader = response.body.getReader();
          let tail = new Uint8Array(0), next = context.currentTime + .04, samples = 0;
          while (!settled) {
            const { value, done } = await reader.read(); if (done) break;
            const data = new Uint8Array(tail.length + value.length); data.set(tail); data.set(value, tail.length);
            const bytes = data.length - data.length % 4; tail = data.slice(bytes);
            if (!bytes) continue;
            const floats = new Float32Array(data.buffer.slice(0, bytes));
            const buffer = context.createBuffer(1, floats.length, sampleRate); buffer.copyToChannel(floats, 0);
            const source = context.createBufferSource(); source.buffer = buffer; source.playbackRate.value = Math.max(.5, Math.min(2.5, rate)); source.connect(context.destination);
            next = Math.max(next, context.currentTime + .025); source.start(next); next += buffer.duration / source.playbackRate.value;
            pending.sources.push(source); source.onended = () => { const i = pending.sources.indexOf(source); if(i >= 0) pending.sources.splice(i, 1); };
            samples += floats.length;
          }
          if (settled) return;
          if (!samples || tail.length) throw new Error("Pocket TTS returned incomplete audio.");
          setTimeout(() => finish(true), Math.max(0, (next - context.currentTime) * 1000));
        } catch (e) { finish(false); if (e.name !== "AbortError") onError(e.message || "Voice playback unavailable."); }
      })();
    });
  }
}

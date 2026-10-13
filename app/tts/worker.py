import io, json, threading, time, uuid, wave, os, base64
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import numpy as np
import torch
from pocket_tts import TTSModel, export_model_state

ROOT = Path(os.environ.get("TTS_DATA_DIR", str(Path(__file__).resolve().parents[2] / "tts-data")))
ROOT.mkdir(exist_ok=True, parents=True)
torch.set_num_threads(2)
model = None
states = {}
ASSIGNMENTS_FILE = ROOT / "assignments.json"
SEAT_KEYS = {"bezos","graham","hormozi","garyvee","martell","wickman","buffett","aleyda","patrick","lily","cyrus","brodie","rand","brian","julian","charles"}
try: assignments = json.loads(ASSIGNMENTS_FILE.read_text()) if ASSIGNMENTS_FILE.exists() else {}
except (ValueError, OSError): assignments = {}

lock = threading.Lock()
status = "loading"
error = ""
PRESETS = ["alba", "marius", "javert", "jean", "fantine", "cosette", "eponine", "azelma"]

def load():
    global model, status, error
    try:
        model = TTSModel.load_model()
        states["alba"] = model.get_state_for_audio_prompt("alba")
        status = "ready"
        if not model.has_voice_cloning: error = "Stock voices ready. Voice cloning requires accepting Pocket TTS access on Hugging Face."
    except Exception as exc:
        status = "unavailable"
        error = "Pocket TTS model could not load. Accept access at huggingface.co/kyutai/pocket-tts, save HF_TOKEN in .env, then restart the app. (" + type(exc).__name__ + ")"
threading.Thread(target=load, daemon=True).start()

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args): pass
    def reply(self, code, body, mime="application/json"):
        data = json.dumps(body).encode() if isinstance(body, dict) else body
        self.send_response(code); self.send_header("Content-Type", mime); self.send_header("Content-Length", str(len(data))); self.end_headers(); self.wfile.write(data)
    def do_GET(self):
        if self.path != "/status": return self.reply(404, {"error":"Not found"})
        voices = [{"voiceURI":v, "name":v.title()} for v in PRESETS]
        voices += [{"voiceURI":p.stem, "name":"Cloned voice " + p.stem[-6:]} for p in ROOT.glob("clone-*.safetensors")]
        message = error
        if status == "ready" and model and not model.has_voice_cloning and any(v["voiceURI"].startswith("clone-") for v in voices):
            message = "Saved cloned voices and stock voices ready. Creating new clones requires Pocket TTS access on Hugging Face."
        self.reply(200, {"status":status, "error":message, "engine":"Pocket TTS", "voiceCloning":bool(model and model.has_voice_cloning), "assignments":assignments, "voices":voices})
    def do_POST(self):
        if status != "ready": return self.reply(503, {"error":error or "Pocket TTS is loading its model. Try again shortly."})
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0 or length > (25_000_000 if self.path == "/import" else 10_000_000): return self.reply(400, {"error":"Upload exceeds the allowed size."})
        body = self.rfile.read(length)
        try:
            with lock:
                if self.path == "/import":
                    args = json.loads(body)
                    advisor = args.get("advisor")
                    if advisor not in SEAT_KEYS: return self.reply(400, {"error":"Unknown advisor."})
                    data = base64.b64decode(args.get("data", ""), validate=True)
                    if not 1 <= len(data) <= 18_000_000: return self.reply(400, {"error":"Invalid voice profile size."})
                    key = "clone-" + uuid.uuid4().hex
                    profile = ROOT / (key + ".safetensors")
                    profile.write_bytes(data)
                    try:
                        state = model.get_state_for_audio_prompt(str(profile))
                    except Exception:
                        profile.unlink(missing_ok=True)
                        return self.reply(400, {"error":"Invalid or incompatible Pocket TTS voice profile."})
                    states[key] = state
                    assignments[advisor] = key
                    temporary = ROOT / "assignments.tmp"
                    temporary.write_text(json.dumps(assignments)); temporary.replace(ASSIGNMENTS_FILE)
                    return self.reply(200, {"voiceURI":key, "advisor":advisor})
                if self.path == "/clone":
                    with wave.open(io.BytesIO(body), "rb") as wav:
                        duration = wav.getnframes() / wav.getframerate()
                        if not 3 <= duration <= 30 or wav.getsampwidth() != 2: return self.reply(400, {"error":"Use a clean 3–30 second, 16-bit PCM WAV sample."})
                    key = "clone-" + uuid.uuid4().hex
                    sample = ROOT / (key + ".wav")
                    sample.write_bytes(body)
                    try:
                        state = model.get_state_for_audio_prompt(str(sample))
                        export_model_state(state, str(ROOT / (key + ".safetensors")))
                        states[key] = state
                    finally: sample.unlink(missing_ok=True)
                    return self.reply(200, {"voiceURI":key, "name":"Cloned voice " + key[-6:]})
                if self.path == "/assign":
                    args = json.loads(body); advisor, voice = args.get("advisor"), args.get("voice")
                    if advisor not in SEAT_KEYS or not isinstance(voice,str) or not (voice in PRESETS or (voice.startswith("clone-") and len(voice)==38 and all(c in "0123456789abcdef" for c in voice[6:]) and (ROOT / (voice + ".safetensors")).is_file())): return self.reply(400, {"error":"Unknown advisor or voice."})
                    assignments[advisor] = voice
                    temporary = ROOT / "assignments.tmp"
                    temporary.write_text(json.dumps(assignments)); temporary.replace(ASSIGNMENTS_FILE)
                    return self.reply(200, {"assignments":assignments})
                if self.path != "/speech": return self.reply(404, {"error":"Not found"})
                args = json.loads(body)
                text, voice = args.get("text", ""), args.get("voice", "alba")
                if not isinstance(text, str) or not 1 <= len(text) <= 2000: return self.reply(400, {"error":"Text must be 1–2000 characters."})
                if voice not in PRESETS and not (isinstance(voice, str) and voice.startswith("clone-") and len(voice)==38 and all(c in "0123456789abcdef" for c in voice[6:]) and (ROOT / (voice + ".safetensors")).is_file()): return self.reply(400, {"error":"Unknown voice."})
                if voice not in states: states[voice] = model.get_state_for_audio_prompt(str(ROOT / (voice + ".safetensors")) if voice.startswith("clone-") else voice)
                if args.get("stream"):
                    self.send_response(200); self.send_header("Content-Type", "application/octet-stream"); self.send_header("X-Sample-Rate", str(model.sample_rate)); self.end_headers()
                    started = time.perf_counter(); first = None; samples = 0
                    try:
                        for chunk in model.generate_audio_stream(states[voice], text):
                            if first is None: first = time.perf_counter() - started
                            audio = chunk.detach().cpu().numpy().reshape(-1)
                            self.wfile.write(audio.astype("<f4").tobytes()); self.wfile.flush(); samples += len(audio)
                    except (BrokenPipeError, ConnectionResetError): return
                    print(json.dumps({"engine":"pocket-tts", "firstChunkSeconds":round(first or 0, 3), "generationSeconds":round(time.perf_counter()-started, 3), "audioSeconds":round(samples/model.sample_rate, 3)}), flush=True)
                    return
                started = time.perf_counter()
                audio = model.generate_audio(states[voice], text).detach().cpu().numpy()
                output = io.BytesIO()
                with wave.open(output, "wb") as wav:
                    wav.setnchannels(1); wav.setsampwidth(2); wav.setframerate(model.sample_rate)
                    wav.writeframes((np.clip(audio, -1, 1) * 32767).astype("<i2").tobytes())
                print(json.dumps({"engine":"pocket-tts", "generationSeconds":round(time.perf_counter()-started, 3), "audioSeconds":round(len(audio)/model.sample_rate, 3)}), flush=True)
                self.reply(200, output.getvalue(), "audio/wav")
        except (ValueError, wave.Error): self.reply(400, {"error":"Invalid WAV sample or speech request."})
        except Exception as exc: self.reply(503, {"error":"Pocket TTS failed (" + type(exc).__name__ + "). Check local model access."})

ThreadingHTTPServer(("127.0.0.1", 4731), Handler).serve_forever()

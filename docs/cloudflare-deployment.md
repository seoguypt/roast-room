# Cloudflare deployment with Wrangler

Run `npx wrangler deploy` from the repository root with Docker running. The Wrangler configuration publishes `advisory-roast-room` on the exact custom domain `advisory.viralseo.net`. This is a Cloudflare Containers application, not a static-only Worker: Node, the Codex CLI, Chromium and the Python Pocket TTS worker run in its Linux container.

The router uses one fixed Durable Object name (`workspace`), so reviews, voice generation and login sessions reach the same application process. The container uses `standard-2` and sleeps after five minutes of inactivity. Cloudflare Containers requires Workers Paid and has usage charges; it is not a free inference service. A cold start restores private files before the app serves requests. Browser login sessions are in memory and require signing in again after the container restarts. An in-progress council is not resumed after a process restart.

## Private configuration

Set secrets using `npx wrangler secret bulk <private JSON file>` or `npx wrangler secret put NAME`. Never commit the file or bake secrets into the image. Required: `APP_ACCESS_USER`, `APP_ACCESS_PASSWORD`, and a random `STATE_TOKEN` of at least 32 characters. Optional provider credentials: `NARA_API_KEY`, `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `HF_TOKEN`. The container uses Codex subscription authentication by default; connect through the private application after deployment. Do not copy a personal global Codex configuration into the image.

Google's OAuth callback remains `https://advisory.viralseo.net/api/google/callback`. The OAuth client ID and secret must be configured before Google sign-in is available. A previous server's Google/Codex login is not automatically recovered by deploying the code.

## Persistence

R2 bucket `advisory-roast-room-private` is private. There is no public asset URL for voice profiles, account tokens or reports. The Worker provides an internal state gateway protected by `STATE_TOKEN`, independent of the workspace password. Only explicit app-state paths are accepted; arbitrary files and Codex configuration cannot be uploaded through it. The token is excluded from Codex child environments by the existing environment allowlist.

`app/cloudflare-state.mjs` restores saved files at startup and replicates changes/deletions every five seconds. It does not sync the temporary working directories or Hugging Face model cache. This is asynchronous persistence: a sudden crash can lose changes made within the last sync interval; failures retry and produce a storage log message. Import complete voice profiles with their assignment JSON before startup. Local reports are not automatically uploaded by `wrangler deploy`.

`/health` checks the Node server. `/api/seats`, `/api/codex/status`, `/api/google/status`, and `/api/tts/status` require the workspace login. Model loading may need additional time after the container is ready. Actual council execution requires a connected model provider.

## Checks

Run `npm test` and `node --test app/scripts/cloudflare.test.mjs`. After deploying, verify the sign-in screen, authenticated API access, denied anonymous state access, restored voice assignments and persistence across a container restart. Keep `.env.cloudflare.local`, `.wrangler/` and local state out of Git and Docker contexts.

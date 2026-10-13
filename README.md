# Roast Room

![The Roast Room](docs/room.jpg)

Bring a hard business decision and seven AI advisors argue it out, then hand you a scored verdict and a one-click PDF. The seats are Jeff Bezos, Paul Graham, Alex Hormozi, Gary Vaynerchuk, Dan Martell, Gino Wickman, and Warren Buffett, each built from that person's public work: their letters, essays, talks, and videos. The council runs in Claude Code, and a small local web app shows them around a table talking it through.

| Seat | Pillar | The question they own |
|---|---|---|
| Jeff Bezos | Strategy and decisions | Is this the right bet, and how reversible is it? |
| Paul Graham | Product and startups | Do people actually want this, and is it growing? |
| Alex Hormozi | Offers, pricing, and sales | Will people pay, how much, and how do we close? |
| Gary Vaynerchuk | Marketing and attention | Where does the attention come from? |
| Dan Martell | People, hiring, and founder time | Who does this, and what does it cost your calendar? |
| Gino Wickman | Operations and scaling | Can the business run this without you holding it together? |
| Warren Buffett | Money and capital | What does it do to cash, risk, and long-term value? |

## What you need

- [Claude Code](https://claude.com/claude-code). Your Claude plan covers it; no API key needed.
- [Node.js](https://nodejs.org) 20 or newer, for the room. Run `npm install` to install the HTML parser used by SEO Advisory.

## Setup

```bash
git clone https://github.com/nateherkai/roast-room.git
cd roast-room
npm install
```

Or open Claude Code anywhere and say: "Clone github.com/nateherkai/roast-room and start the room for me."

## Run a roast

1. Start the room: `npm start`, then open http://localhost:4730. Leave it open.
2. Open Claude Code in the same folder: `claude`
3. Type `/roast-room` and your decision.
4. Answer the Chair's questions, then watch the council argue it out in the room.
5. When the verdict lands, click **Download PDF**.

You also get a short verdict in Claude Code, and the full report lands in `sessions/<date>-<decision>/verdict.md`.

## What to put in your question

The council is only as good as what you give it. Include:

- **The decision** in one line.
- **Your options.** Two or three. "Keep doing what I do now" counts.
- **Your numbers.** Revenue, cash, and team size.
- **Your limits.** Deadline, hours, and budget.
- **What success looks like**, and by when.
- **Which way you're leaning**, and why. The council tests your lean instead of agreeing with it.

Left something out? The Chair asks before the council starts. Example:

```
/roast-room I run a coaching business at $30k a month with 15 clients at $2,000 each.
Should I raise to $3,500 for everyone, raise for new clients only, or keep $2,000?
Close rate is about 50% and I have $40k in the bank. Success is $45k a month by March.
I'm leaning toward raising for everyone because I'm underpaid.
```

More ways to run it:

- `/roast-room --quick ...` seats four advisors for two rounds. Use it for smaller, reversible calls. It uses far less of your plan.
- `/roast-room --seats hormozi,buffett ...` seats only the advisors you name.
- `/roast-room ask hormozi ...` gets one answer from one seat.

The room is optional. The council runs the same in Claude Code without it.

## Watch an example first

Run `npm start`, open http://localhost:4730, and click **Past sessions**. Three finished councils ship with the repo, so you can see how it works (and download their PDFs) before you run your own.

## How it works

- **The council runs in Claude Code.** Each seat is a sub-agent (`.claude/agents/council-*.md`) that reads its own brain (`.claude/skills/roast-room/brains/<name>/`): frameworks, principles, positions, stories, and voice notes compiled from public sources, with every quote tied to a source. Claude Code acts as the Chair. It runs the rounds, keeps score, and writes the verdict (`.claude/skills/roast-room/SKILL.md`).
- **Each seat scores every option**, weighted by how much that seat's pillar matters to your decision. The Chair caps the verdict when a seat flags ruin risk, and it forces a real argument when everyone agrees too fast.
- **The room only watches.** As the Chair works, it writes each step to `sessions/`, and the app plays those files back. Between rounds it shows which round is running, how long it has been, and what each advisor is weighing. The room makes no AI calls of its own.
- **Every council is saved** in `sessions/`. Past sessions replays any of them and downloads its PDF.
- **Usage:** a full council is 21 sub-agent runs, so it takes a real bite out of your plan's usage. Use `--quick` for small calls.

## Optional: let the room run councils itself

If you'd rather type a decision straight into the room, copy `.env.example` to `.env`, add an `ANTHROPIC_API_KEY`, set `COUNCIL_RUNNER=api`, and restart `npm start`. That mode bills your Anthropic API account (about 25 calls per full council).

## What's inside

### Run directly in the browser with NaraRouter's Free plan

Create an account at [NaraRouter](https://router.bynara.id/register), stay on the **Free** plan, and generate an API key in the dashboard. Add it to `.env`:

```env
COUNCIL_RUNNER=api
AI_PROVIDER=nara
NARA_API_KEY=your-key
SEAT_MODEL=nemotron-3.5-lightning-free
CHAIR_MODEL=nemotron-3.5-lightning-free
```

Restart `npm start`. Only `nemotron-3.5-lightning-free` and `nemotron-3-ultra-free` are allowlisted in this mode. Every inference checks the provider's live `/api/plans` catalog to confirm the chosen alias remains in the active zero-price Free plan. Auto routing, paid aliases, custom endpoints, and cross-provider fallback are blocked. If verification fails or free quota is unavailable, the council stops rather than upgrading or switching. Request starts are paced below 15/minute. Keep the provider account on Free without paid credits; billing and provider-side routing ultimately remain controlled by NaraRouter. Models and quotas can change. A live council needs your key; the automated checks use mock responses.

### Business Advisory and SEO Advisory

The browser's **Choose your advisory** menu selects Business Advisory or SEO Advisory. In SEO mode, enter a website/domain or page URL and an optional focus question. Nine simulated personalities use separate curated profiles grounded in public work. Full mode uses all nine for three rounds; Quick uses four relevant seats, including Julian for automation or Charles for iGaming/aggressive-strategy questions when relevant. Both modes use the same debate, voting, replay and PDF workflow.

| SEO personality | Primary lens |
|---|---|
| Aleyda Solis | Strategy, international growth and implementation priorities |
| Patrick Stox | Technical SEO, rendering and indexing |
| Lily Ray | Content quality, trust and E-E-A-T |
| Cyrus Shepard | On-page testing and internal linking |
| Brodie Clark | SERP features, structured data and ecommerce |
| Rand Fishkin | Audience research, brand and distribution |
| Brian Dean | Content differentiation and earned links |
| Julian Goldie | AI SEO automation, repeatable workflows and scaling |
| Charles Floate | Black/grey-hat tradeoffs, iGaming and competitive affiliate SEO |

Each profile has a `brain.md` with principles, voice, debate tensions and mind-change tests, plus `sources.md` under `.claude/skills/seo-advisory/brains/<person>/`. The API loads these into that seat's prompt; it never borrows a business advisor's brain. Click a person in the room to see their focus and source links before or during a council. These are simulations, not the real people; no affiliation or endorsement. The starter profiles paraphrase selected public sources, with no verbatim quotations or invented personal experiences. Voice and suggested tensions are editorial interpretations, not claims of personal disagreements. Sources were reviewed October 13, 2026; dated research remains historical context, not a guarantee or current feature rule.

SEO faces use generated transparent 2x2 sprite sheets in `app/public/portraits/seo/`. Frame order is base (top-left), open mouth (top-right), intermediate mouth (bottom-left), blink (bottom-right). CSS selects frames without altering the source artwork. The existing speech player drives mouth states, and idle blink timers cover both advisory rosters without duplication. Profile/feed avatars use the base frame. These are illustrative likenesses, not photographs. The built-in image-generation prompt set is recorded in `docs/seo-portrait-prompts.json`; downloaded identity references are ignored by Git.

Before the first AI request, the server reads the submitted public HTML page, robots.txt, sitemap.xml, and up to three linked same-origin pages. Sampling conservatively respects robots exclusions. Extracted titles, descriptions, headings, canonical/robots tags, links, image alt attributes, JSON-LD types and text excerpts become shared evidence. The evidence is saved as `evidence.json` and included in session replay. Failed inspection stops the council instead of inventing page facts. Local/private addresses and redirect targets are blocked; reads have time and size limits.

This is a sampled HTML advisory, not a complete audit or rendered browser crawl. Traffic, rankings, backlinks, keyword volumes and measured Core Web Vitals are unavailable. Scores compare proposed action plans, not measured SEO health. The selected AI provider and NaraRouter's free-only restrictions apply to both advisories.

### Run directly in the browser with OmniRoute

Start your [OmniRoute](https://github.com/diegosouzapw/OmniRoute) gateway, connect eligible free providers in its dashboard, and copy its API key from **Endpoints**. Add these settings to `.env`:

```env
COUNCIL_RUNNER=api
AI_PROVIDER=omniroute
OMNIROUTE_BASE_URL=http://127.0.0.1:20128/v1
OMNIROUTE_API_KEY=your-local-gateway-key
SEAT_MODEL=auto
CHAIR_MODEL=auto
```

Restart `npm start`. Enter your decision directly in the room. No Claude Code or Anthropic key is needed in this mode. To prevent paid routing, connect only free providers or set both model fields to a free-only combo/model from your gateway. `auto` can select paid connections too. Provider quotas still apply; the advertised aggregate token budget is not a personal token grant. Start with Quick mode, and choose models with enough context for the advisor brains and reliable JSON output. The adapter validates the Chair's JSON locally; incompatible or malformed responses stop the council with an error.

| Path | What |
|---|---|
| `.claude/skills/roast-room/` | The skill: protocol, prompts, scoring, report template, and the seven brains |
| `.claude/agents/` | The seven seat agents |
| `app/` | The Node server, advisory workflows, website HTML reader, web page, and PDF builder |
| `sessions/` | Your councils (kept out of git) and the three examples |

## About the advisors

These are simulations built from each person's public work. They are not the people, they don't speak for them, and none of them is affiliated with or endorses this project. A seat only quotes a person verbatim when the line is in its brain with a source, and `python .claude/skills/roast-room/scripts/check_quotes.py sessions/<session>` checks every quote in a council against the brains. Each brain's `sources.md` lists what it was built from.

Built by AI Automation Society. The code is MIT licensed; see `LICENSE`. The PDF builder bundles [jsPDF](https://github.com/parallax/jsPDF) (MIT) and [Montserrat](https://github.com/JulietaUla/Montserrat) (SIL Open Font License); their licenses sit next to them in `app/public/`.

Before convening, use **Choose your advisors** to select at least two people. A custom selection is honored in Full and Quick councils and saved with the replay. Full uses three rounds; Quick uses the shorter debate. With the default selection, Quick lets the Chair choose four advisors. **Select all** restores that default.

Neural speech uses **Pocket TTS** locally on CPU. Install with `npm run tts:setup`, accept model access at https://huggingface.co/kyutai/pocket-tts, and add a read token as `HF_TOKEN` in the ignored `.env`. Restart the app; the worker downloads the model once and keeps it in memory. Click **Voice on** or **Test voice**. Auto rotates stock voices; the voice selector overrides that.

**Clone & assign a voice** accepts a clean 3–30 second, 16-bit PCM WAV under 10 MB that you have permission to use. Choose the advisor, upload, and clone. The original sample is deleted after processing; the local embedding is stored in ignored `tts-data/`. Assignments persist locally in `tts-data/assignments.json` and load in each browser. No paid TTS service is called; only model files are downloaded from Hugging Face. These are synthetic voices, not authentic recordings of advisors. Muting, skipping or resetting stops playback. Float32 audio chunks stream into Web Audio as they are generated; the model and voice embeddings stay warm in memory.

Measured on this workspace’s Ryzen 9 5900X: warm Pocket TTS began streaming through the app in 156 ms and generated 4.16 seconds of audio in 1.40 seconds. First model/voice load is slower. Voice cloning was verified using an app-generated synthetic test sample; no real advisor voice was cloned.

SEO skill integration: 19 installed skill/reference documents are bundled under `app/knowledge/seo/`, with original snapshots, source hashes and a role-specific guidance index. Update from this machine's installed skills using `npm run skills:sync` (override the source directory with `SEO_SKILLS_DIR`), then restart. The runtime works from bundled snapshots; it does not require access to the user's Codex folder.

Each SEO personality receives three specialist guides in addition to its sourced personality. The Chair uses the audit synthesis method. Page reading prioritizes main/article content, and deterministic preflight findings show observed URLs, provisional priorities, proposed fixes and verification steps. SEO opening cards now require specific findings and implementation examples; generic best-practice statements are insufficient. Skill documents provide methods, not access to Ahrefs, Firecrawl, DataForSEO, Search Console, rendering or field-performance data. Findings and loaded skill metadata are saved in each council's evidence file.

The seoskill snapshots identify AgriciDaniel as their author and use the MIT license where declared; other bundled skill metadata retains its original attribution. Local editorial `content-effort.md` guidance is preserved with its provenance. Full snapshots remain available for reviewing the imported guidance; prompts use bounded excerpts and override unsupported ranking formulas and tool claims.

## SEO growth reviews

SEO Advisory now defaults to a URL-led growth review. Enter 1–10 public URLs and optional audience, country, business context and goals. Every selected advisor produces an independent report using their installed skills: opinion, observed strengths, ranking/growth opportunities, concrete edits and examples, dependencies, verification, content/distribution ideas and missing data. The Chair then combines the opinions into a 7/30/90-day roadmap with meaningful disagreements and measurements. This workflow does not require a decision question, option scores or voting.

Multiple URLs inspect each submitted page; one URL also samples up to three linked pages. Unavailable pages are reported while accessible pages continue. The site shows the full specialist reports, supports cloned-voice opinion playback, saves and replays results, and exports a full Markdown report. Guidance is evidence-led; live search demand, ranking, backlink, Search Console and performance data still need real integrations. Topic ideas and proposed growth effects remain hypotheses until validated. The older decision council continues for Business and old SEO replays.

Growth reports use a paced queue of up to three independent requests. For Nara upstream failures, a report may try the other explicitly allowlisted free alias once; it is reverified against the live zero-price Free plan before use. Quota/access/pricing verification errors stop new work and never switch to a paid model. Optional missing draft-example/dependency/verification fields are labelled as incomplete rather than invented; proposed new content locations are clearly marked as proposals. Other failures remain visible while successful advisor reports are preserved.

### Optional DataForSEO checks
Save `DATAFORSEO_LOGIN` and `DATAFORSEO_PASSWORD` from https://app.dataforseo.com/api-access in the server `.env`, then restart. Credentials stay on the server.

Each SEO review asks for a country and language after the URLs. Paid DataForSEO checks are optional and disabled by default. Preview current account pricing, review the bounded request list, and explicitly approve it before starting. The maximum approved estimate is $5 per review. Pricing changes block further requests; ambiguous failures retain their cost reservation and are never automatically retried. Actual provider costs and partial results are recorded locally in ignored `dataforseo-data/` files.

Checks currently retrieve up to 20 indexed ranking keywords and 10 competing domains per submitted domain. Backlink summaries are optional and require an active subscription. These are DataForSEO indexed/provider estimates, not Search Console measurements or a complete real-time SERP audit. The advisors receive the collected evidence with its market, timestamp and limitations. Cost previews use the uncharged account-information endpoint and do not fetch paid SEO data.

### Free technical checks
SEO growth reviews automatically run a bounded public-site crawl (up to 20 URLs), internal-link and canonical-target checks (up to 50 destinations), XML sitemap parsing and URL-status samples (up to 20 per reviewed sitemap), JSON-LD syntax/value-shape checks, and mobile Chrome rendering plus Lighthouse on up to 3 pages. Check progress and the expandable **Free technical checks** evidence in the report. Results and failures are saved with the review evidence and sent to every selected advisor before their recommendations.

The crawler respects conservative robots exclusions and uses DNS-pinned public-only requests. Chrome uses a public-only proxy in an isolated temporary profile. GET/HEAD traffic is supported; non-read requests are blocked. A consent screen or bot barrier can limit browser evidence. Lighthouse runs locally using installed Chrome/Edge (or CHROME_PATH), with no paid API or key. Its scores and LCP/CLS/TBT are simulated mobile lab results, not real-user CrUX/INP. JSON-LD validation covers syntax, type shapes and URL references; it does not certify full Schema.org semantics or Google rich-result eligibility. Samples cannot prove full-site health or orphan pages.

### Connect Google: Search Console and GA4
Click **Connect Google** to sign in to your own Google account and grant only `webmasters.readonly` and `analytics.readonly`. No Google password or service-account key goes into the app. The local Windows app encrypts access/refresh tokens with Windows DPAPI for the current user, outside the repository in `%LOCALAPPDATA%/RoastRoom/google/tokens.enc`. Tokens and the OAuth client secret never go to the browser or AI models. Disconnect clears saved tokens and attempts to revoke the grant.

One-time setup:
1. Create/select a project at https://console.cloud.google.com/ and enable **Google Search Console API**, **Google Analytics Data API**, and **Google Analytics Admin API**.
2. Configure Google Auth Platform branding/audience. For a personal app in Testing, add your Google account as a test user. Add read-only Search Console and Analytics scopes under Data Access.
3. Create an OAuth client with type **Web application**. Set its authorized redirect URI to exactly `http://localhost:4730/api/google/callback` (adjust port if the server port is changed).
4. Save its client ID and secret as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in the server `.env`, then restart. Never paste the secret into chat.
5. Click **Connect Google**, grant both permissions, then **Refresh Google properties**. Choose a Search Console property and/or numeric GA4 property ID, date range, and enable **Include Google reports** for the review. The signed-in account needs access to those properties.

Reports use up to 10 exact submitted URLs and up to 90 days, compared with an equal preceding period. Default is 28 days ending 3 days ago. Search Console returns bounded top queries and page clicks/impressions/CTR/average position, with Google stored indexing/canonical/crawl information for each submitted URL. This does not run a live Google crawl or request indexing. GA4 reports Organic Search landing sessions, engagement, tracked key events, ecommerce purchases and purchase revenue; event names identify existing tracked key events. Leads require actual configured tracking. GA4 merges URL query strings and uses property currency/time zone. Both sources currently include all countries, independently of the advisory country input. Google privacy thresholds, modeled data, tracking gaps and anonymized queries may limit results. Empty results are not proof of zero demand/conversions. The selected aggregate evidence is saved locally with the report and shared with the selected AI advisors.

An OAuth app in Testing can require reconnection when its refresh token expires. Public distribution may require Google verification. See https://developers.google.com/identity/protocols/oauth2/web-server for Google's OAuth setup and token guidance.

### Coolify deployment
Build the committed Dockerfile, expose port 4730, use health path /health, and mount a persistent volume at /data. The image includes CPU Pocket TTS, Chromium, and Lighthouse. Set PUBLIC_URL=https://advisory.viralseo.net, NARA_API_KEY, optional DataForSEO/HF credentials, and APP_ACCESS_PASSWORD in Coolify runtime environment variables. The app is a private shared workspace: session sign-in protects paid API access, saved reports, and the single connected Google account. Without an access password, a public deployment fails closed. APP_ACCESS_USER defaults to admin. Do not store runtime secrets in Dockerfiles or GitHub.

Google's production authorized redirect URI is https://advisory.viralseo.net/api/google/callback. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Coolify, then use Connect Google. /data preserves encrypted Google tokens and their encryption key, reports, TTS voice assignments/embeddings, and downloaded model cache. Existing local cloned voices must be imported into /data/tts separately; they are intentionally excluded from GitHub. Google passwords and refresh tokens must never be committed.

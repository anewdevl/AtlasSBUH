# Testing ATLAS and its research agents

## Start the app

Use Node.js 24. Keep complete credentials in the ignored `.env.local` or `.env`; `.env.local` takes precedence. After changing credentials, restart the server. For a presentation, use a production build:

```powershell
npm run build
npm run start -- --hostname 127.0.0.1 --port 3200
```

Open http://127.0.0.1:3200. Stop the server with Ctrl+C. Rebuild after source changes. Do not run a build while using that production server.

## Current local shortlist workflow

1. In Search, choose the city and confirmed category. Use Find a location to search an address or landmark, select its result, and choose a radius.
2. Pan the map, then click Recenter. The selected-center marker should return to the middle of the map and the caption coordinates must stay unchanged.
3. In Research, describe the business. The server obtains compatible mapped candidates automatically. The report lists all named candidates within the radius, ranked with 80% relevance and 20% proximity.
4. Inspect the top cards: each shows distance, relevance evidence and its OSM source. Web enrichment covers the top three distinct names. Official menus and dedicated business listings/reviews are eligible; news and general roundups are rejected.
5. Change the category or scope. Previous research must clear. Web failure may leave a partial report with the ranked map shortlist; it must not substitute out-of-radius businesses.

The live checker defaults to this workflow. Use `--broad` only to test the optional nonlocal API mode. The older manual walkthrough below describes the broad-mode provider behavior, not the new default shortlist.

## Broad-mode provider walkthrough

1. Choose New York and a 1 km radius. Use **Analyze this area** to test OSM independently. Inspect source tags, retrieval date and cache state. Counts describe mapped features; coverage is unknown.
2. Open the **Research** sidebar tab. Enter `A specialty coffee shop with fast morning pickup`. Optional goal: `Compare supported offerings and prices, inspect accessible customer feedback, and suggest experiments.` Google Maps is off by default and not required. Click **Research this business**. Watch for per-business follow-up messages; each run uses at most four basic Tavily searches and one page extraction batch.
3. Watch the stage messages. The NVIDIA search researcher plans the initial query and selects one business for separate website/menu and review searches. The website extractor reads discovered pages and selects source observations; the analyst develops hypotheses, the verifier checks support, and the writer orders verified records. Expand Agent activity to inspect each model call. Quotes are copied from existing numbered excerpts by code. Stages may be partial when unsupported findings are rejected. No new key is needed for Lightning; it uses your existing NVIDIA key.
4. Expand **Inspectable sources**. Compare each displayed quote and claim with the linked source, check retrieval dates and geographic caveats, and inspect whether a review is an individual opinion or a supported sample. Unavailable prices, sample sizes and dates must remain unknown.
5. Inspect insights: each should name supporting sources, explain its reasoning, state uncertainty and suggest a validation step. It must not promise demand, revenue or profitability.
6. Optional only: after the run finishes and at least 30 seconds have passed since its start, open **Optional Google Maps context**, check its checkbox and run again. A working Maps section must show attributed Google Maps links. Quota/credential failures must show unavailable context while preserving usable web findings. The default path makes no Google request even if keys are configured.
7. Change the city or radius. The old research report must disappear. Enter `A software analytics company` and run research without using OSM category suggestions. Unsupported OSM categories must not block research.

## Real provider checks from the terminal

These commands contact live services and consume their normal quota. They read local configuration and print only credential-presence flags and sanitized provider/stage diagnostics.

```powershell
# NVIDIA planning, extraction, insights, verification + real Tavily retrieval
npx tsx scripts/check-research.ts

# Also request real Gemini Google Maps context
npx tsx scripts/check-research.ts --maps

# Check the running app and its real OSM analysis endpoint
npx tsx scripts/check-local.ts http://127.0.0.1:3200
```

The research check writes its dated report to ignored `.atlas-local/live-research.json`. Sanitized NVIDIA output diagnostics are saved as `.atlas-local/live-nvidia-*.json`. This directory is separate from Playwright output so browser runs cannot delete live-check evidence. A partial/unavailable report exits with code 1 so it cannot be mistaken for a fully successful run. HTTP 200 from an LLM alone does not establish a valid or evidence-supported report: inspect the stage outcomes and final findings too.

## Test Gemini fallback

Configure both plain keys, then restart the app:

```dotenv
GEMINI_MAPS_API_KEY=your_primary_key
GEMINI_MAPS_API_KEY_FALLBACK=your_teammates_key
```

To exercise fallback without deliberately exhausting the primary key:

```powershell
npx tsx scripts/check-research.ts --maps --simulate-primary-quota
```

This command simulates only the primary Google HTTP 429 response; NVIDIA, Tavily and the fallback Gemini request remain live. It does not change your environment files. The diagnostic explicitly labels the simulated error. If the fallback is also quota-limited, expect Maps unavailable and available web results retained. Automated tests separately verify both-keys-exhausted behavior and skipping a key during Retry-After. Tracked keys in one Cloud project share the cooldown.

## Automated checks

```powershell
npm run typecheck
npm test
npm run build
$env:ATLAS_E2E_PRODUCTION='1'
$env:ATLAS_E2E_PORT='3100'
npm run test:e2e
```

The browser suite starts an isolated production server on port 3100 and uses installed Edge. Unit/API tests mock external transport; browser tests mock research/analysis responses and tile requests. They do not consume provider credits or prove live provider availability. Fixtures remain under `tests/`.

Focused checks:

```powershell
npm test -- tests/unit/research.test.ts
npm test -- tests/unit/research-route.test.ts
```

Covered cases include valid source references, missing/invented quotes, unsupported claims, verification failure, truncated model output, tool-call parsing, feedback sample caveats, unsupported OSM businesses, provider failure, secret redaction, request budgets, primary-key quota fallback and exhaustion of all keys. The existing map/list/comparison suite remains required.

## Presentation readiness

Run the real web and Maps checks before the presentation, inspect the actual dated report, and verify the configured fallback key. Current code has no automatic saved-research-report fallback. Sources-only or partial results are useful evidence of graceful degradation, but they are not a substitute for a verified successful report. A successful mock test cannot establish that a live key has billing, quota or model access.

The five-agent runtime is documented in [AGENTS_RESEARCH.md](AGENTS_RESEARCH.md). Use `ATLAS_RESEARCH_REQUESTS=12` for the default shared budget; a previous value of 9 can skip final report editing.

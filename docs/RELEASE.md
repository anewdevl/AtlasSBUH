# Release status

Implementation date: October 24, 2026 (America/New_York).

## Automated verification

- TypeScript: passed.
- Vitest: 32 unit/integration tests passed with mocked transport.
- Next.js production build: passed.
- Playwright: 4 browser tests passed using installed Edge, with mocked competitor transport and blocked tiles. Coverage includes four-city flow, source links, comparison, save/restore, unsupported input, failure versus empty, partial aggregates, desktop keyboard entry, and mobile overflow.
- Desktop and mobile screenshots inspected. List/results remain usable with tile failures.
- `npm audit --omit=dev`: no known production dependency vulnerabilities reported.

## Live source checks

Overpass.ch health check returned HTTP 200. A live 500 m NYC analysis returned 39 cafes, and a live 1,000 m NYC analysis returned 182. The snapshot script now loads `.env` before initializing its provider, then successfully captured and validated exact 1,000 m café snapshots for all four presets: NYC 182, London 353, Dubai 25, Singapore 176. Retrieval times are preserved per city; each record includes its OSM source URL and matching tags. The free provider key is read only on the server and is not stored in Git.

## Implemented

Four-city UI; café/bakery/bubble-tea registry; category suggestions; strict semantic API contracts; inspectable evidence; mapped-feature density; exact fresh/stale cache logic; partial handling; compatibility-gated comparison; local browser save; bounded upstream retrieval; separate tile/list behavior; responsive controls; visible attribution and dates. Upstream failures report timeout, HTTP status, or connection guidance; `ATLAS_OVERPASS_ENDPOINT` explicitly selects among four allowlisted global endpoints, including optional Overpass.ch API-key support.

## Remaining release gates

- Rehearse exact snapshot fallback with the network disconnected before the demo.
- Deploy to the intended Vercel account/project and verify snapshot tracing and runtime duration.
- Add deployed contact information to the upstream User-Agent.

The source was pushed to https://github.com/anewdevl/AtlasSBUH on `main`. The newest code and captured snapshots still need to be committed and pushed. No hosted Vercel deployment was created. Pharmacy, supermarket, halal food, heatmaps, and AI research remain outside this initial implementation.

# Release status

Implementation date: October 24, 2026 (America/New_York).

## Automated verification

- TypeScript: passed.
- Vitest: 41 unit/integration tests passed with mocked transport. The release check loads all 20 genuine bundled city/category snapshots, simulates an offline provider, and confirms no upstream request is made. Tests cover stale category recovery, stale registry state, and the NVIDIA NIM suggestion contract.
- Next.js production build: passed.
- Playwright: 7 browser tests passed using installed Edge against the running local app, with mocked competitor transport and blocked tiles. Coverage includes all five categories, comparison/save flows, mobile empty/error states, and supported/unsupported NVIDIA suggestions.
- Desktop and mobile screenshots inspected. List/results remain usable with tile failures.
- `npm audit --omit=dev`: no known production dependency vulnerabilities reported.
- In-app browser smoke with genuine exact 1 km snapshots: the four-city café flow and NYC-to-London comparison passed; NYC pharmacy returned 21 features and supermarket returned 23. All showed complete `snapshot-fresh` results.

## Live source checks

Overpass.ch health check returned HTTP 200. A live 500 m NYC analysis returned 39 cafés, and a live 1,000 m NYC analysis returned 182. Genuine café, bakery, bubble-tea, pharmacy, and supermarket snapshots are captured at 1,000 m for NYC, London, Dubai, and Singapore. Bakery counts are 34/35/1/30 and bubble-tea counts are 14/24/0/21 for NYC/London/Dubai/Singapore; Dubai bubble tea is a valid complete empty result. The source records and exact tags are preserved with original retrieval metadata and integrity hashes. The free provider key is read only on the server and is not stored in Git.

## Implemented

Four-city UI; café/bakery/bubble-tea/pharmacy/supermarket registry; genuine exact 1 km snapshots for all 20 city/category scopes; local and optional NVIDIA NIM category suggestions; strict semantic API contracts; inspectable evidence; mapped-feature density; exact fresh/stale cache logic; partial handling; compatibility-gated comparison; local browser save; bounded upstream retrieval; separate tile/list behavior; responsive controls; visible attribution and dates. Every category uses reviewed exact OSM tags. Upstream failures report timeout, HTTP status, or connection guidance; `ATLAS_OVERPASS_ENDPOINT` explicitly selects among four allowlisted global endpoints, including optional Overpass.ch API-key support.

## Local release status

The app is being run locally; hosted deployment and deployment-specific checks are deferred. All 20 current snapshots are included in the local repository and exact-scope offline fallback is covered by integration tests.

The source and captured snapshots are on https://github.com/anewdevl/AtlasSBUH, branch `main`. No hosted Vercel deployment was created. Halal qualification, independently sourced demographic/transit/footfall metrics, heatmaps, and AI research remain outside the current implementation.

# Release status

Implementation date: October 24, 2026 (America/New_York).

## Automated verification

- TypeScript: passed.
- Vitest: 35 unit/integration tests passed with mocked transport. The release check loads all 12 genuine bundled city/category snapshots, simulates an offline provider, and confirms no upstream request is made.
- Next.js production build: passed.
- Playwright: 4 existing browser tests passed using installed Edge, with mocked competitor transport and blocked tiles. A fifth test now covers pharmacy and supermarket; the runner could not be rerun while the local Next.js dev server held its lock. The updated flows were checked in the open app.
- Desktop and mobile screenshots inspected. List/results remain usable with tile failures.
- `npm audit --omit=dev`: no known production dependency vulnerabilities reported.
- In-app browser smoke with genuine exact 1 km snapshots: the four-city café flow and NYC-to-London comparison passed; NYC pharmacy returned 21 features and supermarket returned 23. All showed complete `snapshot-fresh` results.

## Live source checks

Overpass.ch health check returned HTTP 200. A live 500 m NYC analysis returned 39 cafés, and a live 1,000 m NYC analysis returned 182. The capture script loads `.env` before initializing its provider and captured genuine café, pharmacy, and supermarket snapshots at 1,000 m for NYC, London, Dubai, and Singapore. The source records and exact tags are preserved with original retrieval metadata and integrity hashes. The free provider key is read only on the server and is not stored in Git.

## Implemented

Four-city UI; café/bakery/bubble-tea/pharmacy/supermarket registry; category suggestions; strict semantic API contracts; inspectable evidence; mapped-feature density; exact fresh/stale cache logic; partial handling; compatibility-gated comparison; local browser save; bounded upstream retrieval; separate tile/list behavior; responsive controls; visible attribution and dates. Pharmacy and supermarket use reviewed exact OSM tags. Upstream failures report timeout, HTTP status, or connection guidance; `ATLAS_OVERPASS_ENDPOINT` explicitly selects among four allowlisted global endpoints, including optional Overpass.ch API-key support.

## Remaining release gates

- Deploy to the intended Vercel account/project and verify snapshot tracing and runtime duration.
- Add deployed contact information to the upstream User-Agent.

The source and captured snapshots are on https://github.com/anewdevl/AtlasSBUH, branch `main`. No hosted Vercel deployment was created. Halal qualification, independently sourced demographic/transit/footfall metrics, heatmaps, and AI research remain outside the current implementation.

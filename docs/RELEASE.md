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

Four sequential genuine snapshot captures were attempted against Private.coffee Overpass. Each reached the 25-second abort deadline. A tiny query to the documented Maps Mail.ru global instance returned HTTP 504; a separate HTTPS connectivity check to Private.coffee timed out after 15 seconds with no response bytes. No competitor records were received, no source records could be inspected, and no genuine JSON snapshots were created. The API now reports provider timeouts, connection failures, and HTTP statuses clearly, and supports explicitly selecting a reviewed global endpoint via ATLAS_OVERPASS_ENDPOINT. The snapshot/rehearsal release gate remains open until a provider returns a valid response.

## Implemented

Four-city UI; café/bakery/bubble-tea registry; category suggestions; strict semantic API contracts; inspectable evidence; mapped-feature density; exact fresh/stale cache logic; partial handling; compatibility-gated comparison; local browser save; bounded upstream retrieval; separate tile/list behavior; responsive controls; visible attribution and dates. Upstream failures report timeout, HTTP status, or connection guidance; `ATLAS_OVERPASS_ENDPOINT` explicitly selects among three allowlisted global endpoints.

## Remaining release gates

- Obtain and inspect genuine four-city snapshots; rehearse the backup.
- Deploy to the intended Vercel account/project and verify snapshot tracing and runtime duration.
- Add deployed contact information to the upstream User-Agent.

The source was pushed to https://github.com/anewdevl/AtlasSBUH on `main` in commit `e5315eb`. No hosted Vercel deployment was created. Pharmacy, supermarket, halal food, heatmaps, and AI research remain outside this initial implementation.

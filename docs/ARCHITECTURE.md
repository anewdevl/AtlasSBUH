# Technical architecture

## Request pipeline

Confirmed category and area → strict shape validation (400) → semantic validation (422) → canonical scope → exact fresh memory cache → exact fresh bundled snapshot → fixed allowlisted Overpass request → normalization and final radius filtering → semantic response validation → map/list/comparison. If live retrieval fails, use an exact compatible stale entry no older than 30 days; otherwise 503. Local rate limits return 429 and Retry-After.

No business description enters server query construction. The instant classifier proposes categories locally; an optional explicit NVIDIA NIM request can interpret free-form descriptions and return only a supported registry category or null. NVIDIA NIM is the primary LLM provider for general language-model tasks. The user confirms a registry category. Query predicates are constants owned by the registry. AI suggestions never create map evidence or metrics. All geometries are queried with `nwr`; ways and relations use returned centers. HTTP errors, invalid JSON, missing element arrays, runtime remarks, oversized payloads, and invalid timestamps fail retrieval. Invalid individual records make the usable response partial. A valid empty array yields a complete zero result.

Gemini integration is not implemented yet. It is reserved for a later, explicitly map-related capability, such as Maps Grounding for place questions with provider citations. This is a separate provider adapter from Overpass and must not replace or silently supplement the OSM dataset, alter category classification, or generate competitor counts. Keep Gemini keys server-only and separate from NVIDIA credentials. A future `GEMINI_MAPS_API_KEYS` secret list may hold multiple authorized credentials with project/account tracking. Fail over only for invalid credentials or transient provider outages; do not use the list to pool free-tier quotas or bypass 429/daily caps. Keys in a project share project quotas, so quota exhaustion must honor retry/reset guidance and surface an unavailable/capped state. Verify current model eligibility, quotas, billing, and terms before enabling the integration. References: [Maps Grounding](https://ai.google.dev/gemini-api/docs/maps-grounding), [rate limits](https://ai.google.dev/gemini-api/docs/rate-limits), [billing](https://ai.google.dev/gemini-api/docs/billing).

## Contracts

`src/lib/contracts.ts` is authoritative. The schema version is `1`; the category registry version is `2`. Strict object validation rejects extra fields. WGS84 coordinates use `lat`/`lon`, are rounded to four decimals for requests, and are validated against city guardrails before and after rounding. Source coordinates remain unmodified to preserve the source position. Allowed radii are 500, 1000, and 2000 meters.

Responses validate canonical scope, derived source URLs, unique source IDs, category/relation membership, exact matching evidence, distances, counts, density, dates, and partial semantics. `validateResponse` additionally checks the response against the expected request. Server cache compatibility checks the exact generated query hash. Invalid positions and the 5,000-record cap make a response partial. Partial aggregates are null and cannot be compared.

The integrity hash is SHA-256 of `JSON.stringify(response)` in a snapshot wrapper. It detects accidental changes; it is not a cryptographic authenticity signature. The normalized response includes original retrieval metadata and exact scope. Snapshot loading recomputes integrity and validates the response. Expired snapshots are never relabeled as fresh.

## City guardrails

The following broad rectangles were reviewed as search guardrails around the requested city presets; they are not administrative boundaries, service coverage guarantees, or land-only polygons. The center must be inside the rectangle; the search circle may extend beyond it.

| Preset | Center latitude, longitude | South, west, north, east |
| --- | --- | --- |
| NYC | 40.7308, -73.9973 | 40.49, -74.27, 40.93, -73.68 |
| London | 51.5137, -0.1365 | 51.28, -0.51, 51.70, 0.34 |
| Dubai | 25.2048, 55.2708 | 24.80, 54.85, 25.40, 55.60 |
| Singapore | 1.3000, 103.8500 | 1.15, 103.59, 1.48, 104.10 |

## Cache and reliability

Exact keys include schema, registry, city, category, sorted adjacent categories, canonical coordinates, and radius. Memory cache is bounded to 100 scopes and is best effort per process. Freshness is 24 hours from original fetch; stale fallback is 30 days. Bundled snapshots survive deployments but require recapture as they age. No durable or globally coordinated cache is claimed.

Overpass has a 20-second query budget, a 25-second AbortController deadline spanning transfer, an 8 MiB payload cap, and a 5,001-record sentinel. A 60-second route duration leaves time for validation and fallback. There are no retries or endpoint rotation. Retry-After imposes a process cooldown. Rate limiting is 12 requests/minute/client key per process and is not a distributed abuse control.

At most two upstream requests run concurrently per process. Client requests have a 35-second deadline. A generation counter and AbortController discard obsolete responses when the scope changes. Results are hidden whenever the input scope changes. Map panning triggers no retrieval. Tile failure messages do not disable list analysis.

Client rendering accepts a result only when its schema, registry, and exact request scope still match the current settings. A registry update during development clears incompatible in-memory results and pins instead of passing stale data into strict cache-key validation.

## Comparison

The pure function accepts unknown inputs and validates both. Complete results must agree on category, radius, schema/registry versions, and adjacent categories. Density is `direct / (π × radiusKm²)`. Each area's retrieval time and cache state remain visible. Coverage is unknown; no winner or demand estimate is inferred.

# Phases and milestones

## M1 — Trustworthy vertical slice (complete)

Four city presets; three reviewed categories; explicit category confirmation; map/list; exact scope validation; bounded retrieval; evidence inspection; exact cache behavior; comparison; browser save; responsive UI. Exit: typecheck, unit/API tests, production build, mocked browser smoke, and genuine four-city snapshots with inspected records.

## M2 — Local demo reliability gate (complete)

Capture exact 1 km/no-adjacent snapshots for all four centers. Local verification is complete for café, pharmacy, and supermarket: genuine snapshots returned complete `snapshot-fresh` responses, and an integration test simulates an offline provider across every city/category scope without making an upstream call. Pinning NYC and comparing London also passed. Deployment is deferred while ATLAS is run locally.

## M3 — Evidence-backed market breadth (complete)

All five reviewed categories are supported using exact OSM tags, qualifier/exclusion tests, and genuine 1 km snapshots for all four city presets. Snapshot fallback passed offline tests across all 20 city/category scopes, including a valid complete empty result for Dubai bubble tea. Consider heatmaps only after a justified spatial model and independently sourced metrics exist. Competitor density is not a demand score. Do not invent population, footfall, rents, reviews, or expansion rankings.

## M4 — Bounded category assistance (in progress)

The optional NVIDIA NIM helper interprets free-form business descriptions and maps them only to the reviewed categories in the current registry, with an explicit unsupported state. It does not create categories, produce market research, counts, or expansion claims. Keep this phase within the existing evidence-backed OSM workflow: add a category only when its tags, qualifiers, exclusions, and genuine snapshots can be reviewed and tested. Invalid category state must recover to a supported selection. Do not add web-search agents or open-ended business discovery in this phase.

## M5 — Flexible business discovery and sourced insights (future)

After the current phases are complete, broaden support to arbitrary business and technology company types and add richer market insights using web-search agents or other research providers. NVIDIA NIM remains the primary LLM for general reasoning and synthesis. Gemini is a separate, map-specific provider option for Maps Grounding and cited Google Maps place context; it does not replace OSM competitor retrieval or become the source of mapped feature counts. Treat every claim as sourced research: preserve citations, retrieval dates, scope, and uncertainty, and distinguish external research from mapped OSM features. Design provider adapters and verification before making research an input to rankings or recommendations. Keep multiple authorized Gemini credentials only for genuine provider/key failover; do not rotate across accounts to combine free-tier quotas or bypass quota exhaustion. Respect project-level quotas and provider retry/reset guidance. This phase is not part of the current implementation scope. See [Maps Grounding](https://ai.google.dev/gemini-api/docs/maps-grounding), [rate limits](https://ai.google.dev/gemini-api/docs/rate-limits), and [billing](https://ai.google.dev/gemini-api/docs/billing).

Add durable PostgreSQL storage only when shared analysis/history needs it; PostGIS only for justified spatial operations. Reports and audio are later presentation features.

## Under a 20-hour budget

Protect correctness, snapshots, and a rehearsed demo first. Cut speculative metrics before provenance or failure states. Local demo reliability is verified; deployment can be reconsidered later.

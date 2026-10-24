# Phases and milestones

## M1 — Trustworthy vertical slice (complete)

Four city presets; three reviewed categories; explicit category confirmation; map/list; exact scope validation; bounded retrieval; evidence inspection; exact cache behavior; comparison; browser save; responsive UI. Exit: typecheck, unit/API tests, production build, mocked browser smoke, and genuine four-city snapshots with inspected records.

## M2 — Local demo reliability gate (complete)

Capture exact 1 km/no-adjacent snapshots for all four centers. Local verification is complete for café, pharmacy, and supermarket: genuine snapshots returned complete `snapshot-fresh` responses, and an integration test simulates an offline provider across every city/category scope without making an upstream call. Pinning NYC and comparing London also passed. Deployment is deferred while ATLAS is run locally.

## M3 — Evidence-backed market breadth (current)

Pharmacy and supermarket are now supported using reviewed, exact OSM tags and genuine four-city snapshots. Continue adding business categories only with specific evidence rules and negative cases. Consider heatmaps only after a justified spatial model and independently sourced metrics exist. Competitor density is not a demand score. Do not invent population, footfall, rents, reviews, or expansion rankings.

## M4 — Optional research and reports

Provider adapters for geocoding, AI-assisted research, and additional evidence. Visible citations and separable facts/inferences. Add durable PostgreSQL storage only when shared analysis/history needs it; PostGIS only for justified spatial operations. Reports and audio are later presentation features, not dependencies for the first build.

## Under a 20-hour budget

Protect correctness, snapshots, and a rehearsed demo first. Cut speculative metrics before provenance or failure states. Local demo reliability is verified; deployment can be reconsidered later.

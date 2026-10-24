# Phases and milestones

## M1 — Trustworthy vertical slice (complete)

Four city presets; three reviewed categories; explicit category confirmation; map/list; exact scope validation; bounded retrieval; evidence inspection; exact cache behavior; comparison; browser save; responsive UI. Exit: typecheck, unit/API tests, production build, mocked browser smoke, and genuine four-city snapshots with inspected records.

## M2 — Demo reliability gate (current)

Capture exact café/1 km/no-adjacent snapshots for all four centers. Inspect representative source records. Local verification is complete: all four real snapshots returned complete `snapshot-fresh` responses in the browser, and an integration test simulated an offline provider and confirmed no upstream call was made. Pinning NYC and comparing London also passed. Remaining: deploy to the intended Vercel project and verify the deployed function includes the snapshots and can serve them within runtime limits.

## M3 — Additional metrics only with evidence

Consider heatmaps after a justified spatial model and independently sourced metrics exist. Competitor density is not a demand score. Do not invent population, footfall, rents, reviews, or expansion rankings. Review pharmacy, supermarket, and explicit halal qualifiers separately.

## M4 — Optional research and reports

Provider adapters for geocoding, AI-assisted research, and additional evidence. Visible citations and separable facts/inferences. Add durable PostgreSQL storage only when shared analysis/history needs it; PostGIS only for justified spatial operations. Reports and audio are later presentation features, not dependencies for the first build.

## Under a 20-hour budget

Protect correctness, snapshots, and a rehearsed demo first. Cut category breadth and speculative metrics before cutting provenance or failure states. Deployment and genuine-data validation remain necessary even if visual polish is reduced.

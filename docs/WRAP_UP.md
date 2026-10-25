# ATLAS — completed refinement checklist

Approved scope: evaluate the user's chosen location, optionally compare two locations, and generate research only when requested. Local operation; stores and retail are the primary demo.

- [x] Use the teammate's latest main implementation as the baseline; preserve earlier local work in a named Git stash.
- [x] Business-first search with automatic NVIDIA interpretation across the existing 30 mapped business types. Exact local alias fallback on provider failure, explicit manual override, and no silent café fallback for unsupported input.
- [x] Share description, confirmed business type, city, center and radius across Search and Research. User edits cancel old work and clear obsolete reports; classification updates do not cancel the request that initiated them.
- [x] Retain address/place lookup and map clicking. Show the chosen address or pin label with coordinates and a confirmation reminder. Bound lookup duration and ignore canceled results.
- [x] Use four primary views: Search, Competitors, Compare, Research. Open each view at the top of its sidebar.
- [x] Research runs on demand. Show an overview and insights first, followed by three shortlist cards and expandable additional candidates/evidence.
- [x] Connect current name-matched web findings to existing mapped competitor IDs. Keep exact branch identity explicitly unconfirmed; display quotes, source links and retrieval dates.
- [x] Replace generated candidate areas with an on-demand selected-location assessment. Measure competition, potential complementary activity and transit. NVIDIA selects investigation priorities and practical validation checks.
- [x] Remove generated offset coordinates, relative scores and automatic winning-location recommendations. Zoning, rent, footfall, available premises and profitability remain unverified.
- [x] Keep explicit two-location comparison, compatibility checks, dates, cache states, browser save, both themes, map/list filters and temporary competitor details.
- [x] Validate partial counts, late classification, failures, unsupported input, keyboard/mobile flows, source links, and comparison.
- [x] Typecheck, production build, 98 unit/API tests and 20 production browser tests passed on 2026-10-24.
- [x] Live checks performed separately from mocked tests: address lookup, retail analysis, competitor inspection, browser save, comparison, research pipeline and selected-location assessment.
- [x] Keep local secrets and live reports ignored; no paid service is mandatory for mapped analysis.

## Live observations — 2026-10-24, America/New_York

- Photon returned six address results for Washington Square Park; selecting a result updated the displayed location.
- NYC supermarket at the exact 1 km preset returned 23 direct mapped features. London returned 15; equal-setting comparison worked and both retained their original snapshot dates/cache states.
- Live NVIDIA/Tavily research retained 181 named mapped features, six sources, three supported findings and three insights. All five agent roles completed. The report correctly remained partial because source coverage was limited. This is not a complete market census or a representative review sample.
- Live supermarket assessment stayed at 40.7308, -73.9973 and returned 23 competition, 269 potential-complement and 127 transit mapped features. NVIDIA selected priorities and validation checks with recommendedId null. Feature counts do not establish distinct business/station totals or suitability.
- Live report and genuine browser screenshots are retained under ignored `.atlas-local/`. Synthetic browser fixtures remain in tests only.

## Rehearse

See [DEMO.md](DEMO.md). Use `npx tsx scripts/rehearse-demo.ts` against localhost:3000 to repeat the live address/retail/compare journey. `npx tsx scripts/check-research.ts` runs the bounded live research diagnostic; it exits nonzero for a partial report even when provider calls succeed. `npx tsx scripts/check-location-assessment.ts` checks the selected-location advisor.

No deployment, authentication, database, automatic site discovery or legal zoning validation is part of this release. Push status is recorded by Git and the completion message.

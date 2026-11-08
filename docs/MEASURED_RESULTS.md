# Measured results

Verified on November 8, 2026, on `codex/python-agentic-backend`, using the existing root `.env` and real NVIDIA, Tavily and Overpass.ch credentials. No credential values are included in artifacts.

## Method and validity

The TypeScript behavior reference was called directly with an instrumented transport. The Python application was called through Next.js at port 3001, with `X-ATLAS-Backend: python` and the original frontend Zod validators checking responses and progress. Both used the same configured Overpass endpoint and the same descriptions, city centers, categories and 1 km radii. Each measured an analysis followed by local research.

The corrected baseline loads `.env` before importing the provider modules, matching Next.js startup. Earlier exploratory numbers used the wrong default map endpoint and are not used for the comparison below. The baseline artifact was replaced with the corrected capture.

This is a two-request live sample, not a controlled accuracy study or a statistical speed estimate. Provider contents/load can change between calls. The Python workflow defaults all roles to NVIDIA Lightning; the TypeScript reference uses GPT-OSS 20B for judgment/review. Model selection, retrieval choices, concurrency and cache behavior all differ. These results do not isolate any one optimization. Initial application retrieval caches were process-local; the analysis result was deliberately reused by the following research, matching the frontend flow. Provider-side caching is outside our visibility.

## Final live capture

| Request | TypeScript total / research | Python total / research | Reference findings / impacts | Python findings / impacts |
| --- | --- | --- | --- | --- |
| NYC café: “Specialty coffee with fast morning pickup” | 100.636 s / 100.020 s | 33.497 s / 32.762 s | 0 / 0, partial | 4 / 3, complete |
| London clothing: “South Asian clothing boutique” | 100.602 s / 100.012 s | 16.191 s / 15.566 s | 0 / 0, partial | 1 / 0, partial |

“Complete” describes the bounded workflow, not market coverage or a positive business recommendation. The coffee assessment remained Not recommended; the specialty result could not support an opening judgment and displays Not recommended with an Insufficient evidence note.

| Measurement | NYC reference | NYC Python | London reference | London Python |
| --- | --- | --- | --- | --- |
| Map calls | 1 | 1 | 1 | 1 |
| Research provider/model attempts | 8 | 7 | 8 | 9 |
| Failed/cancelled attempts, including map call | 2 / 9 | 0 / 8 | 2 / 9 | 0 / 10 |
| Available research token usage | 11,939 | 14,991 | 11,309 | 17,822 |
| Python research cache hits | — | 2 | — | 2 |
| Python rejected-claim count | — | 3 | — | 7 |

The reference’s failed attempts were client deadline cancellations, not evidence that the provider returned those errors. Baseline token totals cover successful responses that supplied usage; cancelled calls may have consumed additional unreported tokens. Rejected-claim accounting is not available on the reference, so no numerical rejection-rate comparison is claimed.

Both reference runs reached the 100-second research deadline at judgment/review and withheld unreviewed findings. Python retained exact-quote observations, completed the coffee review, and recovered one specialty observation after a targeted retrieval. All five retained Python findings had source IDs resolving to their retrieved evidence and exact quote substrings. This is a citation-integrity check, not independent verification that every source assertion is true.

Regressions/tradeoffs are explicit: the recorded Python token totals increased; London made one additional research call; specialty positioning and exact branch identity remained unverified. Earlier Python attempts returned no approved findings while consuming model calls. Source/quote enums, weaker-heading rejection and clearer distinction between qualified brand observations and unsupported branch conclusions addressed those failures. No general speed or accuracy percentage is claimed.

Photon intermittently returned 403 in exploratory checks. A bounded mapped-landmark fallback successfully returned Washington Square results. Photon was reachable in the final measurement. Suggestion and selected-location assessment returned valid responses; the assessment was provisional, with null score and no alternative location ranking.

## Reliability evaluation

The deterministic evaluation contains 11 named scenarios: normal research, specialty requirements, empty mapped results, ambiguous branches, unsupported quote selections, unsupported claims, unsupported conclusions, search-provider failure, verifier failure, overall deadline and targeted correction. Fixture outcomes are in [evaluation.json](measurements/evaluation.json). They test expected handling, not real-world model accuracy.

Tests additionally cover malformed provider envelopes, radius exclusion, inactive features, source identity/duplicate handling, taxonomy guardrails, partial advice counts, source URL permissions, cache bounds/timestamp reuse, request budgets, provider concurrency and cancellation reaching an in-flight HTTP operation. API integration checks exercise all five routes, body/semantic validation and Photon fallback.

Verification completed:

- TypeScript: 123 tests passed; type checking passed.
- Python: 15 tests passed, including 11 workflow scenarios.
- Cross-language contracts: all 11 Python report scenarios plus map analysis and location advice passed the original frontend schemas.
- Production Next.js build passed.
- Browser suite: 37 tests passed, including the opt-in real-provider Python demonstration. One earlier concurrent marker check timed out; its isolated rerun and the subsequent full suite passed.
- The live browser demonstration checked Python response headers, location search, real map features/markers, compatible comparisons, streamed cited findings, selected-location assessment, and actual parseable PDF and editable PowerPoint downloads.

The bundled Playwright browser was unavailable, so the installed Chrome channel was used. Public map tiles were intentionally blocked in browser tests; Leaflet markers, radius, interaction and list behavior were tested without downloading tiles.

## Artifacts and reproduction

- [baseline.json](measurements/baseline.json): corrected reference capture with provider attempts, durations, available usage and reports.
- [python-live.json](measurements/python-live.json): final connected capture, source excerpts, findings, comparisons, stage/call metrics and endpoint checks. Map records are omitted and only the first ten shortlist entries are retained to keep review manageable; original aggregates and the full shortlist count remain recorded.
- [evaluation.json](measurements/evaluation.json): explicitly synthetic evaluation outcomes.
- Ignored `.atlas-local/metrics.jsonl`: per-run operational telemetry.
- Ignored `.atlas-local/python-live-full.json`: full final live capture when regenerating measurements.
- Ignored `test-results/python-backend-…/`: live screenshots and downloaded `live-report.pdf` / `live-report.pptx`.

See [PYTHON_BACKEND.md](PYTHON_BACKEND.md) for startup and exact verification commands. Live measurements consume provider quota. Measurements are evidence from these runs; future runs may be slower, fail partially or produce different reviewed conclusions.

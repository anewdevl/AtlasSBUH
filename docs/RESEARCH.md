# Local business research

The app now builds a ranked shortlist from validated OpenStreetMap features inside the selected radius. Research uses the shared business description and location, then interprets the description into a mapped type for its own shortlist. Search uses its selected category. Named features are retained separately with their source identity. Coverage, current operating status and duplicates remain uncertain. Representative centers are not guaranteed entrances.

Shortlist ordering is a deterministic heuristic using mapped category, explicit specialty text and distance. Category aliases are not evidence of offerings. Requirements outside the category (for example, desi in desi clothing store) remain explicit and unverified unless supported by source records. No confidence-style match percentages are displayed. All named mapped candidates remain inspectable; only the top three distinct names receive web enrichment to bound quota use.

The researcher qualifies candidate-specific sources. Code rejects news/blog/press paths, roundups and unrelated names; NVIDIA additionally accepts only official business pages or dedicated business listings/reviews. The extractor reads up to three pages and selects exact quotes. Public product/service prices require an official-business source and a quoted monetary amount, excluding reviewer-reported or approximate prices. A web name match does not establish a branch match, so reviews are never presented as proven local-branch reputation.

The analyst selects business-specific offering comparisons using exact substrings from the user proposal and source quotes. Code checks business identity, finding IDs, quote text and overlapping offering terms before displaying potential competition. Complements remain conditional crossover hypotheses. The analyst also chooses a provisional Recommended / Not recommended / Insufficient evidence verdict with cited findings and risks. A separate verifier must approve the verdict; absent or unsupported judgments are withheld. No free-writing report agent runs. The ranked shortlist remains available if enrichment fails; a missing provider never becomes evidence that no businesses exist.

The default local path uses at most three basic searches, one page extraction batch and four NVIDIA calls. Live OSM retrieval, when needed, shares the 12-request default budget (hard maximum 14) and 100-second deadline (maximum 110). Cached OSM data retains its original date. Upstream responses and model outputs remain bounded. No external research cache is implemented.

The request API retains broad research when `localOnly` is omitted; that mode cannot establish radius membership for web sources. The app requests `localOnly: true` with its confirmed OSM settings. `scripts/check-research.ts` tests the local path by default; `--broad` explicitly tests the old broad flow. Agent definitions are in `src/server/research-agents.ts`.

Location search uses the [Photon API](https://github.com/komoot/photon), with explicit user submission, a city-envelope filter, cached results and a process-wide request interval. The public demo service permits reasonable use and offers no availability guarantee. Set `ATLAS_GEOCODER_ENDPOINT` to a compatible service for larger deployments. No Google key is needed. The city envelopes are search guardrails, not official municipal boundaries.

## Verification

Unit tests cover relevance weighting, radius exclusion, distinct branch preservation, source rejection, price classification, provider failures, location-search caching and limits, and local-only failure behavior. Browser tests exercise selecting a location, actual center-marker positioning after recenter, and the shortlist surviving failed web enrichment. Live reports remain under ignored `.atlas-local/` and describe the provider evidence available at that moment.

## Current UI

Generate insights is explicit; opening Research makes no research request. The business is interpreted automatically before research, with a validated mapped type for the research request. The reviewed opening assessment and business effects appear first; the top three mapped candidates are visible with additional candidates and supporting evidence expandable. Supported research observations can be expanded in matching competitor details; name-matched observations are clearly marked as branch-unconfirmed. User business/location edits cancel old work and invalidate the report.

The separate selected-location assessment uses `/api/location-advice` on demand. It no longer generates offset candidate areas or scores. Users select a second real location themselves through Search and use Compare for compatible mapped results.

## Agent roles

The four roles share the server-side NVIDIA adapter and one coordinator. Tavily supplies actual web search and extraction; model inference alone does not browse.

| Role | Responsibility | Output boundary |
| --- | --- | --- |
| Researcher | Qualify sources for shortlisted business names | Retrieved sources and existing quote IDs |
| Extractor | Select offerings, prices and accessible commentary | Exact quotes from discovered pages; branch uncertainty retained |
| Analyst | Compare sourced offerings and judge competitive positioning | Exact offering substrings, existing business/finding IDs, bounded verdict and risks |
| Verifier | Check claim support and citation consistency | Unsupported findings and dependent insights are removed |

The coordinator owns all provider calls, request/deadline/concurrency limits and cancellation. Retrieved pages are untrusted evidence, never executable instructions. Output schemas validate IDs and quotes. Extraction is restricted to discovered HTTPS sources. The UI retains stage failures, original dates, missing information and branch caveats. A complete run describes processing, not exhaustive market coverage.

## Providers

Set server-only `NVIDIA_API_KEY` and `TAVILY_API_KEY` in ignored `.env` or `.env.local`; restart after changes. The default model is `nvidia/nemotron-3.5-lightning-30b-a3b`; `ATLAS_RESEARCH_MODEL=openai/gpt-oss-20b` selects the supported alternative. Defaults and optional limits are in [`.env.example`](../.env.example).


There is no automatic saved-research fallback. The LLM opening verdict expresses judgment on the retrieved competitive evidence; rent, demand, footfall, zoning and profitability remain unverified. No verdict is forced when supported offering comparisons are unavailable.

## Report exports

Each generated report offers PDF and editable PowerPoint downloads. Both revalidate the current report and use its existing observations, insights, source references, original dates and limitations; exports do not call AI or data providers. The PDF puts insights ahead of competition details. The deck starts with six briefing sections, with continuation slides if needed, followed by an evidence appendix and source notes. The mapped shortlist is limited to the top ten with the total explicitly stated; complete findings, insights and source references are retained.

Libraries load only when exporting. PDF fonts are bundled under `public/fonts/` with their SIL Open Font License; unsupported glyphs are preserved as labeled Unicode code points. The export is canceled if the report/location changes. Failures leave research available and permit retry. A report's partial/unavailable state stays visible, and exports preserve the existing reviewed LLM verdict without generating a new one.

## Business mini maps

Every Competitors detail and every Research shortlist card (including expanded results) offers a mini map in the same workspace. Named source observations also support a name/city preview. Unnamed mapped features use coordinates. `/map-preview` accepts any business or address; there is no fixed sample business or name-based identity assertion.

Previews use Google's public embeddable map search output, which currently redirects to a Google-hosted embed. No API key or Places API request is required. Search previews are explicitly unverified branch matches; the full Google Maps link remains available if embedding is blocked or unavailable. The map covers the OSM workspace while open and does not change counts, research or exports.

## Practical opening judgments

Research treats Recommended / Not recommended as a preliminary competitive-positioning opinion under disclosed unknowns. Missing rent, demand, footfall or branch confirmation does not automatically require abstention. The UI and exports show Recommended or Not recommended with a short reason. When product evidence is missing or judgment review fails, they show Not recommended with an explicit hold-off explanation; this fallback does not assert that the location is unsuitable. The underlying report preserves the missing judgment.

Concrete product descriptions tagged as competitor identity are reclassified as offering evidence after checking their text; address-only brand mentions are not. Judgment and verification use NVIDIA-hosted `openai/gpt-oss-20b` by default, while retrieval/extraction retain their configured model. `ATLAS_RESEARCH_JUDGMENT_MODEL` may select the existing Lightning alternative. Known business names, source quotes and the user description constrain the impact selection. One factual correction and recheck is allowed within the original HTTP-call/time budget; no retry loop is used.

# Local business research

The app now builds a ranked shortlist from validated OpenStreetMap features inside the selected radius. Research shares the business description and automatically interpreted category with Search; Advanced settings offers a manual override. Named features are retained separately with their source identity. Coverage, current operating status and duplicates remain uncertain. Representative centers are not guaranteed entrances.

Ranking is deterministic: `0.8 * relevance + 0.2 * proximity`. Relevance starts at 85/100 for the confirmed category or 45/100 for adjacent categories, with up to 15 points for matching business/category terms. Proximity decreases linearly from 100 at the selected center to 0 at the radius boundary. It measures category/text similarity, not business quality or semantic similarity across arbitrary business types. All named mapped candidates are listed; web enrichment is limited to the three highest-ranked distinct names to bound quota use.

The researcher qualifies candidate-specific sources. Code rejects news/blog/press paths, roundups and unrelated names; NVIDIA additionally accepts only official business pages or dedicated business listings/reviews. The extractor reads up to three pages and selects exact quotes. Public menu prices require an official-business source and a quoted monetary amount, excluding reviewer-reported or approximate prices. A web name match does not establish a branch match, so reviews are never presented as proven local-branch reputation.

The analyst receives only accepted findings and separately labeled OSM context. It must cite finding IDs, never invent pricing baselines, and propose bounded validation steps. The verifier removes unsupported claims. The writer can only reorder verified records. The ranked shortlist remains available if enrichment fails; a missing provider never becomes evidence that no businesses exist.

The default local path uses at most three basic searches, one page extraction batch and five NVIDIA calls. Live OSM retrieval, when needed, and optional Maps calls share the 12-request default budget (hard maximum 14) and 100-second deadline (maximum 110). Cached OSM data retains its original date. Upstream responses and model outputs remain bounded. No external research cache is implemented.

The request API retains broad research when `localOnly` is omitted; that mode cannot establish radius membership for web sources. The app requests `localOnly: true` with its confirmed OSM settings. `scripts/check-research.ts` tests the local path by default; `--broad` explicitly tests the old broad flow. Agent definitions are in `src/server/research-agents.ts`.

Location search uses the [Photon API](https://github.com/komoot/photon), with explicit user submission, a city-envelope filter, cached results and a process-wide request interval. The public demo service permits reasonable use and offers no availability guarantee. Set `ATLAS_GEOCODER_ENDPOINT` to a compatible service for larger deployments. No Google key is needed. The city envelopes are search guardrails, not official municipal boundaries.

## Verification

Unit tests cover relevance weighting, radius exclusion, distinct branch preservation, source rejection, price classification, provider failures, location-search caching and limits, and local-only failure behavior. Browser tests exercise selecting a location, actual center-marker positioning after recenter, and the shortlist surviving failed web enrichment. Live reports remain under ignored `.atlas-local/` and describe the provider evidence available at that moment.

## Current UI

Generate insights is explicit; opening Research makes no research request. The business is interpreted automatically before research, using the same type as map analysis. The overview and suggested next steps appear first; the top three mapped candidates are visible with additional candidates and supporting evidence expandable. Current research can be opened from competitor details; name-matched observations are clearly marked as branch-unconfirmed. User business/location edits cancel old work and invalidate the report.

The separate selected-location assessment uses `/api/location-advice` on demand. It no longer generates offset candidate areas or scores. Users select a second real location themselves through Search and use Compare for compatible mapped results.

## Agent roles

All five roles share the server-side NVIDIA adapter and one coordinator. Tavily supplies actual web search and extraction; model inference alone does not browse.

| Role | Responsibility | Output boundary |
| --- | --- | --- |
| Researcher | Qualify sources for shortlisted business names | Retrieved sources and existing quote IDs |
| Extractor | Select offerings, prices and accessible commentary | Exact quotes from discovered pages; branch uncertainty retained |
| Analyst | Develop interpretations, hypotheses and experiments | Existing finding IDs, reasoning, uncertainty and validation steps |
| Verifier | Check claim support and citation consistency | Unsupported findings and dependent insights are removed |
| Report editor | Order accepted observations and insights | Existing IDs only; cannot create facts or restore rejected claims |

The coordinator owns all provider calls, request/deadline/concurrency limits and cancellation. Retrieved pages are untrusted evidence, never executable instructions. Output schemas validate IDs and quotes. Extraction is restricted to discovered HTTPS sources. The UI retains stage failures, original dates, missing information and branch caveats. A complete run describes processing, not exhaustive market coverage.

## Providers

Set server-only `NVIDIA_API_KEY` and `TAVILY_API_KEY` in ignored `.env` or `.env.local`; restart after changes. The default model is `nvidia/nemotron-3.5-lightning-30b-a3b`; `ATLAS_RESEARCH_MODEL=openai/gpt-oss-20b` selects the supported alternative. Defaults and optional limits are in [`.env.example`](../.env.example).

Optional Maps context uses separate `GEMINI_MAPS_API_KEY` and `GEMINI_MAPS_API_KEY_FALLBACK` credentials. Exhausted keys retain cooldowns; tracked keys in one project share project-level cooldowns. Do not combine accounts to bypass quotas. Google context is requested explicitly and never changes OSM counts. The web flow works independently of Google.

There is no automatic saved-research fallback or final Recommended/Not Recommended verdict in the current UI. Research remains evidence and investigation advice; rent, demand, footfall, zoning and profitability are unverified.

## Report exports

Each generated report offers PDF and editable PowerPoint downloads. Both revalidate the current report and use its existing observations, insights, source references, original dates and limitations; exports do not call AI or data providers. The PDF puts insights ahead of competition details. The deck starts with six briefing sections, with continuation slides if needed, followed by an evidence appendix and source notes. The mapped shortlist is limited to the top ten with the total explicitly stated; complete findings, insights and source references are retained.

Libraries load only when exporting. PDF fonts are bundled under `public/fonts/` with their SIL Open Font License; unsupported glyphs are preserved as labeled Unicode code points. The export is canceled if the report/location changes. Failures leave research available and permit retry. A report's partial/unavailable state stays visible, and exporting does not introduce a Recommended/Not Recommended verdict.

Google's [Maps Demo Key documentation](https://developers.google.com/maps/demo-key) currently lists Places API (New) support, excludes user-generated reviews/photos, and pauses usage until the next day on reaching daily limits. No fixed numeric allowance is stated on that page. Demo-key Places integration is not implemented by the export feature.

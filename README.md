# ATLAS

A local map-first workspace for business and location research, built with Next.js App Router, React, TypeScript, Leaflet and Zod. Supports New York, London, Dubai and Singapore.

## Run

Use Node.js 24 and the pinned dependencies:

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3000. Describe a business, choose an address or map pin and radius, then Analyze. The business is automatically classified into one of 30 mapped types; Advanced settings provides a manual override. Unsupported descriptions never silently select a café.

Search, Competitors, Compare and Research share the chosen business and location. Inspect marker previews and temporary detail panels, filter the map/list, save one mapped analysis in the browser, or pin an analysis to compare with another location using matching settings. The first comparison pin stays fixed until Clear pin is selected. After analyzing a second location, choose Compare with pinned area. Both themes and mobile/keyboard controls are supported.

Research runs only when requested. NVIDIA and Tavily enrich up to three distinct mapped business names with cited observations and insights. Supporting evidence expands underneath; exact branch matches and missing information remain explicit. Assess this location measures competition, potential complements and transit around the selected pin. It generates no alternative sites or suitability score. Research explains potential competition, complements or uncertain effects using exact sourced offerings. NVIDIA chooses a provisional Recommended / Not recommended / Insufficient evidence opening verdict; a separate verifier must approve its factual basis. Broad mapped categories do not verify specialty competitors, and shortlist ordering is not a confidence percentage. Generated reports offer Download PDF and Download slides (.pptx), with editable slides, sources, original dates and limitations. Exports run locally in the browser without new research calls.

## Configuration

Copy the names and examples from [`.env.example`](.env.example) into ignored `.env` or `.env.local`; restart after changes. Never commit secrets.

- Mapped analysis: no API key is required with a public Overpass endpoint. `ATLAS_OVERPASS_ENDPOINT` selects an allowlisted provider; `ATLAS_OVERPASS_API_KEY` supports the optional Overpass.ch endpoint.
- Business interpretation and research: `NVIDIA_API_KEY`; web search/extraction also requires `TAVILY_API_KEY`. The default NVIDIA model is `nvidia/nemotron-3.5-lightning-30b-a3b`; `ATLAS_RESEARCH_MODEL=openai/gpt-oss-20b` selects the supported alternative. An unambiguous exact local alias can provide classification fallback; manual selection needs no AI key.
- Optional Google Places demo lookup: `GOOGLE_PLACES_API_KEY` and optional `ATLAS_PLACES_DAILY_LIMIT=5` (allowed 1–20). Competitor details → Extra info (Google), or Research shortlist → Google details, opens an in-app sheet and sends one lookup. No new browser tab, reviews/photos, automatic retries, pagination, key rotation or dependency on this feature. The local UTC-day attempt counter persists across restarts in ignored `.atlas-local/places-budget.json`.
- Address lookup uses Photon without a key. `ATLAS_GEOCODER_ENDPOINT` can select a compatible service.

No database, authentication, or paid service is mandatory for mapped analysis. Research requires the relevant provider credentials and available quota.

## Evidence and limits

Counts describe OpenStreetMap features, with unknown coverage. They do not establish unique businesses, customer demand or profitability. Web evidence never changes mapped counts. Rent, footfall, available premises and legal zoning remain unverified.

Genuine snapshots cover café, bakery, bubble tea, pharmacy and supermarket for the four exact city presets at 1 km with no adjacent categories. Fallback must match the exact scope; fresh entries last 24 hours and stale fallback at most 30 days from the original retrieval date. Other scopes may require live retrieval. Research has no automatic offline fallback. Failed retrieval is distinct from a valid empty result; partial aggregates are unavailable.

OSM-derived data is © OpenStreetMap contributors under [ODbL](https://www.openstreetmap.org/copyright). Basemap tiles and competitor data are separate services.

## Checks and documentation

```sh
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Automated tests mock upstream data. Playwright uses installed Microsoft Edge by default. Live provider checks are separate; see the testing guide.

- [Architecture and contracts](docs/ARCHITECTURE.md)
- [Business types and matching rules](docs/TAXONOMY.md)
- [Research flow, agents and providers](docs/RESEARCH.md)
- [Testing and live diagnostics](docs/TESTING.md)
- [Local demo and backup](docs/DEMO.md)
- [Deployment and operations](docs/DEPLOYMENT.md)

Mini maps are available for every Competitors detail, every Research shortlist card and every optional Google Places candidate. They use the business/location being inspected, including coordinates for unnamed features. General search is available at `/map-preview`. Opening a mini map does not consume the Places API budget.

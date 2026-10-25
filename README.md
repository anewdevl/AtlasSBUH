# ATLAS

Local market exploration using inspectable OpenStreetMap evidence. Next.js App Router, React, TypeScript, client-only Leaflet, Zod, Vitest, and Playwright. No API key, database, authentication, or AI service is required for map analysis; NVIDIA NIM category suggestions and external business research are optional.

## Run

Use Node.js 24 and npm. Dependencies are pinned; commit `package-lock.json` with the source.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Describe your business and select a city, address or map pin and radius. Analyze automatically interprets the business into one of 30 supported mapped types; Advanced settings offers a manual override. Research runs only when requested and shares the confirmed business and location. Pin one analysis, choose another location with matching settings, and compare. Browser storage preserves one mapped analysis and its original retrieval date.

Explore uses a full-height map and a sidebar with Search, Competitors, and Compare views. The corner theme button switches between light and dark styling and remembers the choice in this browser. Hover or focus a competitor marker for a preview; click it, press Enter/Space, or select its list entry to open source details on the right. Escape closes the details and restores focus. Mobile uses collapsible controls and a detail sheet. The detail component displays existing OSM evidence; agent-sourced reviews and insights are not connected yet.

Search competitors by name, filter direct/adjacent relationships, and sort nearest or farthest first. These controls affect the list and map together; aggregate metrics, saved evidence, and comparisons still use the full analysis. Recenter frames the search area, and Fit results frames the currently visible features. Selecting a list entry reveals its marker beside the details panel. Closely overlapping markers open a chooser for individual source features without moving their recorded coordinates or merging businesses. Navigation and display filtering do not trigger retrieval. Filters reset for a new scope or restored analysis.

If public OpenStreetMap query services are unreachable, the free Overpass.ch plan is another option. Create an API key at https://overpass.ch/, then set `ATLAS_OVERPASS_ENDPOINT=https://api.overpass.ch/v1/interpreter` and `ATLAS_OVERPASS_API_KEY=your_key` in the ignored `.env.local` file. The key stays on the server and is never sent to the browser. Error messages distinguish provider timeouts, HTTP errors, and connection failures. Other allowlisted public endpoints are listed in [.env.example](.env.example).

Set `NVIDIA_API_KEY` in `.env` or `.env.local` and restart the dev server for semantic business interpretation. The shared NVIDIA adapter defaults to `nvidia/nemotron-3.5-lightning-30b-a3b`; `ATLAS_RESEARCH_MODEL=openai/gpt-oss-20b` selects the supported alternative. Interpretation returns a supported type or null. An exact unambiguous local alias can provide fallback if AI is unavailable; a manual type needs no AI key. Software/IT offices are supported as `office=it`, with limited mapped coverage. Unsupported descriptions never silently select a café.

Business research uses NVIDIA and Tavily by default and needs no Google credentials. Gemini Maps is an optional adapter under advanced research options. It never changes OSM mapped counts or category decisions; existing primary/fallback key settings remain supported, with exhausted credentials held in cooldown.

```sh
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run snapshots
```

Playwright uses installed Microsoft Edge by default on this Windows workspace. Update the configured browser channel for other environments. Automated tests mock upstream data and tile requests; synthetic records exist only under `tests/`.

## Optional business research (M5, in progress)

The **Research** tab builds a shortlist of named mapped businesses inside the selected radius. Ranking weights relevance at 80% and proximity at 20%, using the confirmed category and matching business terms. All available named candidates are shown; NVIDIA and Tavily enrich the top three distinct names. Agents reject news, roundups and unrelated sources, and distinguish official menu prices from reviewer-reported costs. The report groups supported observations by business and retains the shortlist if web retrieval fails. A web-name match does not prove a local branch match; mapped coverage and current operating status remain uncertain. See [research implementation](docs/RESEARCH.md) and [agent roles](docs/AGENTS_RESEARCH.md).

Use **Search → Find a location** for an address, neighborhood or landmark in the selected city envelope. Select a result to move the center, then confirm the pin and choose a radius. Photon supplies location lookup without an API key. Recenter restores the selected search circle using symmetric padding; it never changes the chosen area or starts retrieval.

Set `NVIDIA_API_KEY` and `TAVILY_API_KEY` server-side to enable the web flow. Research defaults to NVIDIA-hosted `nvidia/nemotron-3.5-lightning-30b-a3b` with thinking disabled; the category helper uses the same configured NVIDIA adapter. `ATLAS_RESEARCH_MODEL=openai/gpt-oss-20b` remains an optional research alternative, but live checks found it substantially slower. No new key is required for the default model. For optional Maps context, set `GEMINI_MAPS_API_KEY` and optionally `GEMINI_MAPS_API_KEY_FALLBACK`. Exhausted credentials retain their cooldown; tracked credentials in one project share their cooldown. Google is never called by the default web flow. See [.env.example](.env.example) and [research implementation](docs/RESEARCH.md). Restart after changing local environment configuration; preserve existing local secrets.

Provider adapters are implemented and covered with mocked transports. Live credential, billing, regional availability and result-quality checks remain a deployment gate. Missing providers return partial/unavailable reports; map analysis continues without research credentials.

## OSM scope

- New York, London, Dubai, and Singapore search presets, with documented rectangular request guardrails.
- Café, bakery, bubble tea, pharmacy, and supermarket, using explicit OSM tag evidence. Pharmacy excludes chemists and deprecated pharmacy tags; supermarket excludes convenience and grocery shops.
- Exact runtime and bundled snapshot cache lookup, bounded live retrieval, exact stale fallback, and explicit unavailable state.
- Direct/adjacent evidence, source links, representative-center disclosure, dates, cache state, density, and comparison compatibility checks.
- Responsive map/list interface, keyboard-accessible form, and list operation independent of tiles.
- Optional NVIDIA NIM category suggestions; AI never generates competitor records or counts.

Genuine café, bakery, bubble-tea, pharmacy, and supermarket snapshots for the four exact city presets at 1,000 m are bundled in `data/snapshots/`. They include validated source records, original retrieval metadata, and file integrity hashes. Use `npm run snapshots -- bakery bubble-tea` to refresh only those categories; without arguments, the script refreshes the original café, pharmacy, and supermarket set. Exact stale fallback remains age-limited; recapture snapshots before they exceed 30 days.

## Documents

- [Technical architecture](docs/ARCHITECTURE.md)
- [Taxonomy and evidence rules](docs/TAXONOMY.md)
- [Phases and milestones](docs/MILESTONES.md)
- [Developer ownership](docs/DEVELOPMENT.md)
- [Testing the research agents](docs/TESTING.md)
- [Codex continuation prompt](docs/CODEX_PROMPT.md)
- [Deployment and operations](docs/DEPLOYMENT.md)
- [Demo runbook](docs/DEMO.md)
- [Release status](docs/RELEASE.md)

OSM-derived data is © OpenStreetMap contributors, available under [ODbL](https://www.openstreetmap.org/copyright). Tiles and competitor data are separate services.

The Research tab also offers **Assess this location**: a separate on-demand agent uses mapped competitors, potentially complementary features and transit around the chosen pin to select investigation priorities and practical validation checks. It generates no alternative coordinates, suitability score or winning location. Partial retrieval withholds aggregate counts. Rent, footfall, zoning and available premises remain unverified. See [wrap-up checklist](docs/WRAP_UP.md) for validation and demo steps.

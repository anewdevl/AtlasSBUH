# ATLAS

Local market exploration using inspectable OpenStreetMap evidence. Next.js App Router, React, TypeScript, client-only Leaflet, Zod, Vitest, and Playwright. No API key, database, authentication, or AI service is required for map analysis; NVIDIA NIM category suggestions are optional.

## Run

Use Node.js 24 and npm. Dependencies are pinned; commit `package-lock.json` with the source.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Choose a city, confirm a category, select a radius, and analyze. Click the map or enter coordinates to change the center. Retrieval is explicit. Pin one analysis, change the area, and analyze again to compare. Optional browser storage retains one analysis with its original retrieval date.

Explore uses a full-height map and a sidebar with Search, Competitors, and Compare views. The corner theme button switches between light and dark styling and remembers the choice in this browser. Hover or focus a competitor marker for a preview; click it, press Enter/Space, or select its list entry to open source details on the right. Escape closes the details and restores focus. Mobile uses collapsible controls and a detail sheet. The detail component displays existing OSM evidence; agent-sourced reviews and insights are not connected yet.

Search competitors by name, filter direct/adjacent relationships, and sort nearest or farthest first. These controls affect the list and map together; aggregate metrics, saved evidence, and comparisons still use the full analysis. Recenter frames the search area, and Fit results frames the currently visible features. Selecting a list entry reveals its marker beside the details panel. Closely overlapping markers open a chooser for individual source features without moving their recorded coordinates or merging businesses. Navigation and display filtering do not trigger retrieval. Filters reset for a new scope or restored analysis.

If public OpenStreetMap query services are unreachable, the free Overpass.ch plan is another option. Create an API key at https://overpass.ch/, then set `ATLAS_OVERPASS_ENDPOINT=https://api.overpass.ch/v1/interpreter` and `ATLAS_OVERPASS_API_KEY=your_key` in the ignored `.env.local` file. The key stays on the server and is never sent to the browser. Error messages distinguish provider timeouts, HTTP errors, and connection failures. Other allowlisted public endpoints are listed in [.env.example](.env.example).

To enable AI category suggestions, set `NVIDIA_API_KEY=your_key` in `.env.local` and restart the dev server. NVIDIA NIM (`openai/gpt-oss-20b`) is the primary LLM for general ATLAS language-model tasks. The current optional button sends the entered business description to NVIDIA and suggests only a category already supported by ATLAS. An unsupported business, such as a software office, stays unsupported. The key and map analysis remain server-side; AI suggestions are not required for local analysis.

Gemini integration is not implemented yet. It is reserved for a later, explicitly map-related feature such as Maps Grounding: answering a map question using grounded Google Maps places and citations. It does not replace Overpass/OpenStreetMap competitor retrieval, and it must not create or change mapped competitor records, counts, or current category decisions. Keep Gemini credentials server-side and separate from `NVIDIA_API_KEY`. A future `GEMINI_MAPS_API_KEYS` secret list may hold multiple authorized credentials for failover after an invalid credential or transient provider outage. Do not switch keys to combine free quotas or evade a 429/quota limit. Multiple keys in one Google Cloud project share that project's limits; on quota exhaustion, respect the provider's reset/retry guidance. See the [Gemini Maps Grounding docs](https://ai.google.dev/gemini-api/docs/maps-grounding), [rate limits](https://ai.google.dev/gemini-api/docs/rate-limits), and [billing details](https://ai.google.dev/gemini-api/docs/billing).

```sh
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run snapshots
```

Playwright uses installed Microsoft Edge by default on this Windows workspace. Update the configured browser channel for other environments. Automated tests mock upstream data and tile requests; synthetic records exist only under `tests/`.

## Current scope

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
- [Codex continuation prompt](docs/CODEX_PROMPT.md)
- [Deployment and operations](docs/DEPLOYMENT.md)
- [Demo runbook](docs/DEMO.md)
- [Release status](docs/RELEASE.md)

OSM-derived data is © OpenStreetMap contributors, available under [ODbL](https://www.openstreetmap.org/copyright). Tiles and competitor data are separate services.

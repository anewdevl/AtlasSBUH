# ATLAS

A map-first workspace for exploring local competition and comparing business locations. Choose a business type and an area in New York, London, Dubai or Singapore, then inspect mapped competitors and their supporting evidence.

Built with Next.js 16, React 19, TypeScript and Leaflet. No database is required. Map analysis works without API keys; optional AI interpretation and web research use server-side credentials.

## Getting started

Use Node.js 24 and npm.

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). To enable optional providers, copy `.env.example` to `.env.local`, add your credentials and restart the server. In PowerShell:

```powershell
Copy-Item .env.example .env.local
```

## Explore an area

1. Describe your business or select a supported type in Advanced settings. Choose a city, address or map pin and a radius of 500 m, 1 km or 2 km.
2. Analyze the area. Inspect marker clusters, filter competitors and open business cards for source evidence, distance and available address, hours or website details.
3. Pin an analysis, choose another location and compare results with matching business types, radius and adjacent categories. You can also save an analysis in your browser.
4. Generate Research insights on demand for cited web observations about shortlisted businesses. Optional location assessment examines competition, complements and transit around your selected pin.

There are 30 supported business types. Search, Competitors, Compare and Research share the selected business and location. Light/dark themes and mobile controls are included.

## Configuration

Provider settings and research limits are documented in [`.env.example`](.env.example). Keep credentials in ignored `.env.local` files.

| Setting | Purpose |
| --- | --- |
| `NVIDIA_API_KEY` | Optional business interpretation and AI research |
| `TAVILY_API_KEY` | Web search and extraction for research, alongside NVIDIA |
| `GEMINI_MAPS_API_KEY`, `GEMINI_MAPS_API_KEY_FALLBACK` | Optional, explicitly requested Google Maps context |
| `ATLAS_OVERPASS_ENDPOINT` | Select an allowlisted competitor-data endpoint |
| `ATLAS_OVERPASS_API_KEY` | Optional Overpass.ch credentials |
| `ATLAS_GEOCODER_ENDPOINT` | Override the Photon-compatible address service |
| `NEXT_PUBLIC_ATLAS_RESEARCH=0` | Hide the Research tab; visible by default |
| `NEXT_PUBLIC_ATLAS_LOCATIONS=1` | Show location assessment; hidden by default |
| `NEXT_PUBLIC_TILE_URL` | Override the basemap tile URL |

`NEXT_PUBLIC_*` settings are public and embedded at build time; rebuild production after changing them. Never put secrets in these variables. For public hosting, review tile attribution, provider policies, quotas and rate limiting in the [deployment guide](docs/DEPLOYMENT.md).

## Data and limitations

Competitors come from OpenStreetMap through Overpass using explicit category rules. Counts represent mapped features with unknown coverage; they do not establish demand, profitability or a complete business census. Web observations may describe a brand rather than a confirmed local branch and never change mapped counts. Rent, footfall, available premises and zoning remain unverified.

Bundled snapshots cover café, bakery, bubble tea, pharmacy and supermarket at the four exact city presets, with a 1 km radius and no adjacent categories. Fresh data lasts 24 hours; an exact compatible stale fallback can be used for up to 30 days from its original retrieval. Other scopes need live retrieval. Snapshot fallback does not provide offline basemap tiles, address lookup or research.

Refresh all five bundled categories with:

```sh
npm run snapshots -- cafe bakery bubble-tea pharmacy supermarket
```

This contacts real providers and replaces successful captures without resetting source dates. Failed retrieval is distinct from a valid empty result; partial aggregates are withheld. Research has no automatic offline-report fallback.

## Development and verification

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Vitest covers unit and API behavior. Playwright covers browser workflows and starts a development server by default. Automated tests mock upstream services and do not establish live availability. Synthetic fixtures stay under `tests/`.

For an isolated production browser check after building, use PowerShell:

```powershell
$env:ATLAS_E2E_PRODUCTION='1'
$env:ATLAS_E2E_PORT='3100'
npm run test:e2e
```

Set `ATLAS_E2E_CHANNEL=msedge` to use installed Microsoft Edge instead of Playwright Chromium. Enable `NEXT_PUBLIC_ATLAS_LOCATIONS=1` during the production build when testing location assessment.

To serve a production build locally:

```sh
npm run start -- --hostname 127.0.0.1 --port 3000
```

The following diagnostics contact real providers and may consume quota:

```sh
npx tsx scripts/check-local.ts http://127.0.0.1:3000
npx tsx scripts/check-research.ts
npx tsx scripts/check-location-assessment.ts
npx tsx scripts/rehearse-demo.ts
```

The rehearsal requires a running app on port 3000 and exercises address lookup, supermarket analysis, evidence inspection, browser save and comparison. For a snapshot demonstration, use an exact city preset and matching snapshot settings. Research diagnostics save sanitized reports under ignored `.atlas-local/` and exit unsuccessfully for partial or unavailable reports. `check-research.ts --maps` includes optional Maps context; `--maps --simulate-primary-quota` simulates only the primary 429 while remaining requests are live. `--broad` exercises the broader research path instead of the default local shortlist. Inspect sources and stage outcomes before presenting results.

## Project structure

| Path | Contents |
| --- | --- |
| `src/app/` | App entry point and API routes |
| `src/components/` | Map, search, comparison and research UI |
| `src/lib/` | Shared contracts, category rules and analysis helpers |
| `src/server/` | Retrieval, caching and bounded research pipeline |
| `data/snapshots/` | Genuine source-backed fallback captures |
| `scripts/` | Snapshot capture and live diagnostics |
| `tests/` | Unit, integration and browser tests |

See [architecture](docs/ARCHITECTURE.md), [taxonomy and evidence rules](docs/TAXONOMY.md), [research implementation](docs/RESEARCH.md) and [deployment](docs/DEPLOYMENT.md) for technical details.

Map data © OpenStreetMap contributors, available under the [ODbL](https://www.openstreetmap.org/copyright).

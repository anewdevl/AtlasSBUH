# ATLAS

ATLAS helps people explore local competition before choosing where to open a business. Select a business type and location, inspect nearby businesses on a map, compare areas, and generate an evidence-backed research report.

**[Watch the demo](https://www.youtube.com/watch?v=KbZlJ5nXHnM)**

## Features

- Search mapped competitors by business type with a 500 m, 1 km, or 2 km radius.
- Inspect business cards with distance, source, and available contact details.
- Compare two locations using the same category and search settings.
- Generate AI-assisted research with cited web findings; export the report as PDF or editable PowerPoint.
- Explore preset locations in New York, London, Dubai, and Singapore, or search for another address.

## Run locally

Requires Node.js 24 and npm.

```sh
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Core map analysis works without API keys. For optional AI research, copy `.env.example` to `.env.local`, set `NVIDIA_API_KEY` and `TAVILY_API_KEY`, then restart the server. See [`.env.example`](.env.example) for other settings.

## How it works

ATLAS uses OpenStreetMap and Overpass for mapped businesses, Leaflet for the map, and Next.js, React, and TypeScript for the application. Its research pipeline uses NVIDIA NIM for analysis and Tavily for web retrieval. A set of source-backed snapshots can support exact preset searches when live competitor retrieval is unavailable.

Mapped business counts depend on OpenStreetMap coverage. Research findings can refer to a brand rather than a confirmed local branch. ATLAS does not verify demand, rent, foot traffic, or profitability; review cited sources before making a location decision.

## Development

```sh
npm run typecheck
npm test
npm run build
```

For browser tests, run `npx playwright install chromium` followed by `npm run test:e2e`. Technical details are in the [architecture](docs/ARCHITECTURE.md), [research](docs/RESEARCH.md), and [deployment](docs/DEPLOYMENT.md) guides.

Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright).

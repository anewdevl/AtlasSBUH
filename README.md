# ATLAS

ATLAS helps people evaluate a potential business location. It combines mapped competitor data, area comparison, and source-linked research in one map-based workspace.

**[Watch the demo](https://www.youtube.com/watch?v=KbZlJ5nXHnM)**

## Features

- Search mapped competitors by business type with a 500 m, 1 km, or 2 km radius.
- Inspect business cards with distance, source, and available contact details.
- Compare two locations using the same category and search settings.
- Generate AI-assisted research with inspectable sources and a reviewed, provisional location assessment; export it as PDF or editable PowerPoint.
- Explore preset locations in New York, London, Dubai, and Singapore, or search for an address within those city areas.

## Run locally

Requires Node.js 24 and npm.

```sh
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Core map analysis works without API keys. For optional AI research, copy `.env.example` to `.env.local`, set `NVIDIA_API_KEY` and `TAVILY_API_KEY`, then restart the server. See [`.env.example`](.env.example) for other settings.

## How it works

ATLAS uses OpenStreetMap and Overpass for mapped businesses, Leaflet for the map, and Next.js, React, and TypeScript for the application. Its bounded research pipeline uses NVIDIA NIM for analysis and verification, and Tavily for web retrieval. Input validation and caching limit unnecessary requests; source-backed snapshots provide a fallback for specific preset searches.

## Limitations

- Map analysis needs no paid map API, but live OpenStreetMap, Overpass, geocoding, and map-tile services depend on external availability and usage policies. Snapshots cover only specific preset searches.
- AI research requires NVIDIA and Tavily API credentials. Their free tiers, quotas, pricing, and availability depend on each provider; research is unavailable without those services.
- OpenStreetMap coverage is incomplete, and web findings may describe a brand rather than a confirmed local branch. The assessment does not verify demand, rent, foot traffic, zoning, or profitability. Review sources before making a location decision.

## Development

```sh
npm run typecheck
npm test
npm run build
```

For browser tests, run `npx playwright install chromium` followed by `npm run test:e2e`. Technical details are in the [architecture](docs/ARCHITECTURE.md), [research](docs/RESEARCH.md), and [deployment](docs/DEPLOYMENT.md) guides.

Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright).

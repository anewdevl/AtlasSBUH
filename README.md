# ATLAS

Local market exploration using inspectable OpenStreetMap evidence. Next.js App Router, React, TypeScript, client-only Leaflet, Zod, Vitest, and Playwright. No API key, database, authentication, or AI service is required.

## Run

Use Node.js 24 and npm. Dependencies are pinned; commit `package-lock.json` with the source.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Choose a city, confirm a category, select a radius, and analyze. Click the map or enter coordinates to change the center. Retrieval is explicit. Pin one analysis, change the area, and analyze again to compare. Optional browser storage retains one analysis with its original retrieval date.

If the default OpenStreetMap query service is unreachable, the error reports whether it timed out, returned an HTTP error, or could not be contacted. Select another allowlisted global Overpass endpoint at server startup with `ATLAS_OVERPASS_ENDPOINT`; see [.env.example](.env.example). These community services have best-effort availability.

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
- Café, bakery, and bubble tea. Other categories are intentionally unsupported pending reviewed qualifier rules.
- Exact runtime and bundled snapshot cache lookup, bounded live retrieval, exact stale fallback, and explicit unavailable state.
- Direct/adjacent evidence, source links, representative-center disclosure, dates, cache state, density, and comparison compatibility checks.
- Responsive map/list interface, keyboard-accessible form, and list operation independent of tiles.

**Genuine demo data is not fabricated.** See [release status](docs/RELEASE.md) for capture and verification outcomes. Until genuine snapshots are captured, offline fallback is unavailable. Run the capture script on a network that can reach the configured provider before demoing offline.

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

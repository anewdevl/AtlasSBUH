# Python backend integration

ATLAS runs Next.js for the interface and FastAPI for all five APIs in combined local development. Existing Vercel deployments retain the TypeScript APIs by default; enabling hosted Python there is an explicit deployment choice.

## Install and start

Use Node.js 24 and Python 3.11 or newer (verified with Python 3.12). From the repository root:

```powershell
npm ci
python -m pip install -e ./python_backend
npm run dev
```

After installation, **`npm run dev` starts both services**. Open http://localhost:3000. FastAPI listens on loopback port 8000; `/health` identifies the Python backend. Ctrl+C stops the services owned by the launcher. It recognizes `python_backend/.venv` or an executable selected with `ATLAS_PYTHON`.

Reuse the existing root `.env`. Python loads it explicitly without overriding environment variables; Next.js loads it normally. `NVIDIA_API_KEY`, `TAVILY_API_KEY` and optional `ATLAS_OVERPASS_API_KEY` remain server-side. No new provider account is required.

If ports are occupied, leave the existing processes alone:

```powershell
$env:ATLAS_API_PORT='8001'
$env:ATLAS_NEXT_DIST_DIR='.next-python'
npm run dev -- --hostname 127.0.0.1 --port 3001
```

The separate build directory permits an isolated Next.js instance. Verification used 3001/8001 because the original app was already running on 3000/8000.

For production, retain the repository and install the Python package in editable mode as above, then run `python -m uvicorn atlas_api.main:app --host 127.0.0.1 --port 8000`. Build/start Next.js with `npm run build` and `npm start`. Set `ATLAS_BACKEND_URL` before building when FastAPI has another address. On Vercel, also explicitly set `ATLAS_USE_PYTHON_BACKEND=1`; otherwise the existing TypeScript APIs remain active. A Next.js-only deployment does not deploy FastAPI. Keep the backend private or add deployment authentication. Process-local limits are not distributed abuse controls.

## Routes and frontend contracts

Next.js forwards these paths to Python before checking the reference TypeScript route files:

| API | Implementation | Frontend contract |
| --- | --- | --- |
| `POST /api/analyze` | `maps.py`, `main.py` | `src/lib/contracts.ts`: versioned scope, categories, distances, aggregates, provenance |
| `POST /api/research` | `research.py`, `providers.py` | `src/lib/research-contracts.ts`: NDJSON progress and report |
| `POST /api/suggest` | `main.py`, `providers.py` | `src/lib/category-suggestion.ts`: category or null and explanation |
| `GET /api/locations?q=…&city=…` | `main.py` | `src/lib/location-search.ts`: labels/coordinates inside the selected city |
| `POST /api/location-advice` | `advice.py` | `src/lib/location-advisor.ts`: one selected area, null score, no location ranking |

The implementations in `src/server` and `src/app/api` remain the behavior reference. Set `ATLAS_TYPESCRIPT_REFERENCE=1` and run `npm run dev:web` only when deliberately testing that reference. Responses in Python mode carry `X-ATLAS-Backend: python` so integration checks detect accidental reference-route execution.

Leaflet maps, source links, compatible-area comparisons, browser saves, embedded business previews, PDF and editable PowerPoint exports remain in the frontend. Exports consume existing validated reports without new research calls.

The final decision is exactly **Recommended** or **Not recommended**. If evidence cannot support an opening judgment, the latter carries an **Insufficient evidence** note: hold off, not a claim that the area is proven unsuitable. The internal three-way evidence contract preserves this distinction.

The installed Next.js proxy defaults to 30 seconds. It is configured for 115 seconds, and Python sends harmless NDJSON heartbeats during long waits. Existing consumers ignore these events; the research deadline remains at most 110 seconds.

## Maps, registry and source validation

`npm run registry:python` exports the 30-category TypeScript registry, city envelopes and Overpass allowlist to `python_backend/atlas_api/registry.json`. Regenerate after intentional taxonomy changes. Contract checks validate Python output with the original frontend schemas.

Python validates versions, city guardrails, radii (500/1000/2000 m), adjacency and canonical four-decimal centers. Active category rules, exact source IDs and Haversine radius filtering determine inclusion. Duplicate OSM IDs are excluded. Invalid records or the 5,000-record cap make results partial, with null aggregates. Display details are independently filtered, including unsafe website schemes.

Map caches retain original dates: 24 hours fresh and up to 30 days for exact-scope fallback after live failure. Snapshots must pass integrity, exact request/query compatibility and semantic checks. Integrity detects accidental modification; it is not an authenticity signature. Partial results never become complete zero counts.

Photon already provided location search before this migration. It returned 403 during verification. Python now falls back to an escaped, bounded name search for mapped landmarks inside the city envelope through the configured Overpass provider. This supports named landmarks, not general postal-address geocoding. Search is explicit, cached and rate-limited. If both services fail, selecting a map pin still works.

## Research state machine and permissions

1. Validate mapped features in the selected category/radius. Rank named candidates by category, specialty text and distance; enrich at most three distinct names. Map membership does not establish specialty or web branch identity.
2. Search independent candidates concurrently. Allocate evidence across candidates, deduplicate URLs and reject editorial, unrelated and category-contradicting sources.
3. The researcher chooses search, inspect, refine or stop. It selects supplied candidate/source IDs and a fixed focus. The application builds queries and resolves URLs. Models cannot execute code, fetch arbitrary URLs or invoke unrestricted tools.
4. The extractor receives compact numbered quotes. Dynamic schemas restrict names, source IDs and quote IDs to the supplied values. Code checks quote association, literal support, observation type and business/category relevance. Navigation, contact-only text and weak headings are rejected. Findings remain qualified source assertions.
5. The analyst compares actual quoted offerings with exact proposal substrings. Code validates business-specific finding references, offering text and unsupported factual assertions. Specialty, branch, demand and profitability gaps remain explicit.
6. The verifier reviews observations and conclusions. Omitted, duplicate or rejected decisions cannot approve claims. Dependent comparisons and judgments are removed. One targeted correction cycle is permitted if budget/time remains; new claims require fresh review.
7. Stream the five existing stages and return complete, partial or unavailable results. Preserve mapped shortlists and inspectable sources on failure; withhold unreviewed generated claims.

Requests without a confirmed map category return an unavailable report requesting confirmation. The historical city-wide discovery mode is intentionally not replicated: this workflow starts from mapped candidates as required for this migration.

## Performance and operational bounds

The default research budget is 12 provider calls, hard maximum 14, including live OSM retrieval. The default overall deadline is 100 seconds, maximum 110. NVIDIA/Tavily share a configurable semaphore capped at two; OSM has its own two-call limit. At most two research runs are active per process. One shared `httpx.AsyncClient` reuses connections and refuses redirects. Provider payloads are capped at 512 KB; OSM at 8 MiB. Individual HTTP waits also have timeouts.

Process-local caches hold 100 map scopes, 200 search queries (one hour), 100 extracted pages (six hours) and 500 geocoder queries (24 hours). Original source retrieval timestamps survive cache reuse. These caches disappear on restart and are not a durable report store.

Location/description edits cancel frontend work, including classification before research. Next.js propagates socket closure to FastAPI, which cancels research and child HTTP calls. Nonstreaming endpoints watch for disconnects too. Generation checks prevent late responses from replacing a newer scope.

`.atlas-local/metrics.jsonl` records stage/total latency, provider calls, available numeric token usage, cache hits, rejected-claim counts and failure reasons. It excludes prompts, credentials and full responses. Logs rotate after 5 MB. Agent activity is also visible through the existing report contract. See [measured results](MEASURED_RESULTS.md).

## Verification and demonstration

```powershell
npm run typecheck
npm test
npm run test:python
npm run check:contracts
npm run build
$env:ATLAS_E2E_CHANNEL='chrome' # or install Playwright Chromium
npm run test:e2e
```

Python tests use deterministic providers and exercise all five APIs. Cross-language checks generate 11 research scenarios and validate them with the existing Zod contracts. Standard browser tests mock providers.

Opt in to a real-provider demonstration against an already running app:

```powershell
$env:ATLAS_E2E_PORT='3001'
$env:ATLAS_E2E_CHANNEL='chrome'
$env:ATLAS_PYTHON_E2E='1'
npx playwright test tests/e2e/python-backend.spec.ts --workers=1
```

It checks location search, map results/markers, compatible comparisons, streamed research with cited findings, selected-location assessment, and actual PDF/PowerPoint downloads. Artifacts are under ignored `test-results/`. Tests block public map tiles to avoid unnecessary tile traffic.

Repeat live measurements with `npx tsx scripts/measure-baseline.ts` and `npx tsx scripts/measure-python.ts http://127.0.0.1:3001`. These consume real provider quota. Small samples are observations, not accuracy estimates or promises of future latency.

## Resume explanation

Describe the work as migrating a five-route geospatial application to FastAPI while preserving streamed contracts, maps and exports; implementing bounded multi-role research with exact-quote grounding, conclusion review, targeted correction, concurrency, cancellation and retrieval caches; and validating it through cross-language tests and a real-provider browser demonstration.

Do not describe mapped counts as exhaustive market coverage or this evaluation as an accuracy percentage. A useful demonstration opens a cited finding, explains branch/specialty uncertainty, and shows why a stronger recommendation was withheld.

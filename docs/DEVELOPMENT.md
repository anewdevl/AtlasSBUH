# Developer ownership

The workspace started empty and without Git. This implementation was created in one checkout; no developer branches or worktrees have been manufactured. Before concurrent A/B/C work, A should initialize or connect the intended repository and commit the shared baseline. Create separate worktrees from that commit.

- **A — Integration/UI:** app shell, map/search/results, shared contracts, cities, configuration, dependency files, integration, deployment. Only A edits dependency files after bootstrap.
- **B — Data/API:** route, server modules, queries, normalization, caching, capture script, snapshots, API tests.
- **C — Taxonomy/comparison/QA:** registry, classifier, comparison function/panel, taxonomy tests, browser acceptance.

A coordinates all contract changes; C owns taxonomy and B consumes the same registry. Increase registry/schema versions when incompatible rules change. Do not make separate category registries for the query builder and normalizer.

Automated tests must mock upstream transport. Keep synthetic fixtures under `tests/`; never put them in `data/snapshots/`. Report live checks separately. Do not commit secrets, `.env` values, build output, browser traces, or node_modules.

M5 research work is on `fahad/atlas-sbu`. Research uses separate contracts and server modules; shared OSM contracts remain authoritative for mapped analysis. NVIDIA, Tavily and Gemini credentials stay in server-only configuration. Research transport tests and browser fixtures are synthetic and live only under `tests/`. Follow docs/RESEARCH.md before extending providers or review-source coverage.

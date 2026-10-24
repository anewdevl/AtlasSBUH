# Demo runbook

1. Before the event, run `npm run snapshots` from a network with access to the provider. Confirm four complete JSON captures and inspect several source links and tags per city. Do not overwrite successful captures with test fixtures.
2. Run typecheck, tests, production build, and browser smoke. Start the application.
3. Show NYC → Café → 1 km → no adjacent categories. Analyze, inspect a source feature, show its tags and retrieval date, and explain unknown coverage.
4. Pin NYC, switch to London, keep the same category/radius/adjacent settings, and analyze. Show independent dates and counts. Explain that density is mapped features per circular km², not demand or a winner.
5. Show Dubai and Singapore with the same exact presets. Saving and restoring keeps original retrieval metadata.
6. With genuine snapshots present, rehearse fresh snapshot retrieval without upstream access. Separately use mocked tests to demonstrate partial and expired behavior.

## Backup

Keep the built local application and genuine snapshots on the demo laptop. Tile outages leave the evidence list usable. If snapshots have expired and live retrieval is unavailable, show the explicit unavailable state and explain the limitation. Do not relabel stale data or show fake competitors. Without genuine snapshots, this backup is not ready.

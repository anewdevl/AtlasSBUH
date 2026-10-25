# Testing and live diagnostics

## Automated checks

Use Node.js 24. Tests mock provider transport; synthetic records belong under `tests/`, never `data/snapshots/`.

```powershell
npm run typecheck
npm test
npm run build
$env:ATLAS_E2E_PRODUCTION='1'
$env:ATLAS_E2E_PORT='3100'
npm run test:e2e
```

Playwright starts an isolated production server on port 3100 using installed Edge. Change its channel for other environments. The suite covers classification/manual override, unsupported businesses, address selection, evidence inspection, scope changes, comparison, browser save, themes, keyboard/mobile controls, research and selected-location assessment. Unit/API tests cover normalization, exact caching, partial results, provider failures, bounded research handoffs, citations and model-output validation.

Mocked success does not establish live provider access or quota. Snapshot integrity and exact scope must remain valid; dates are never reset.

## Run the verified app

```powershell
npm run start -- --hostname 127.0.0.1 --port 3000
```

Open http://127.0.0.1:3000. Rebuild after source changes; stop the production server before rebuilding. `.env.local` takes precedence over `.env`. Restart after changing configuration.

## Live checks

These commands contact real providers and consume their normal quota. Keep credentials server-side. Diagnostics print presence flags and sanitized output, not key values.

```powershell
npx tsx scripts/check-local.ts http://127.0.0.1:3000
npx tsx scripts/check-research.ts
npx tsx scripts/check-location-assessment.ts
npx tsx scripts/rehearse-demo.ts
```

The rehearsal uses a running localhost:3000 app for real address lookup, retail analysis, competitor inspection, browser save and two-city comparison. See [DEMO.md](DEMO.md).

The research diagnostic saves its dated report and sanitized NVIDIA diagnostics under ignored `.atlas-local/`. It exits with code 1 for partial/unavailable reports, even when individual provider calls succeed. Inspect sources, findings and stage outcomes before presenting a result. The default research budget is 12 shared requests; configuration is in [`.env.example`](../.env.example).

To explicitly include optional Google Maps context:

```powershell
npx tsx scripts/check-research.ts --maps
```

To test configured primary/fallback behavior without exhausting the primary key:

```powershell
npx tsx scripts/check-research.ts --maps --simulate-primary-quota
```

Only the primary HTTP 429 is simulated; remaining provider requests are live. Provider cooldowns remain enforced. Both exhausted keys can leave Maps unavailable while independent web results survive. See [RESEARCH.md](RESEARCH.md) for agent roles and provider boundaries.

Research has no automatic offline-report fallback. Keep a verified report open or use genuine saved diagnostic artifacts as clearly identified backups; do not substitute synthetic test data.

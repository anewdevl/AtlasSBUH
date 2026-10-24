# Deployment and operations

Deploy this repository as a Next.js project on Vercel, with Node.js 24. No secrets are required. `npm run build` is the build command. API routes use Node runtime and export `maxDuration = 60`; current Vercel Fluid Compute Hobby limits allow this. Verify the target project's actual duration configuration before deployment: https://vercel.com/docs/functions/configuring-functions/duration.

`next.config.ts` includes `data/snapshots/**/*.json` in the analyze function trace. Confirm bundled snapshots exist and are within the 30-day window. Do not publish a claim of offline demo support without them.

The default competitor-data endpoint is https://overpass.private.coffee/api/interpreter. Its policy permits use without registration and requests reasonable shared-resource behavior: https://overpass.private.coffee/. If public services are unavailable, Overpass.ch offers a free API-key plan with a monthly query quota: https://overpass.ch/docs. Set `ATLAS_OVERPASS_ENDPOINT=https://api.overpass.ch/v1/interpreter` and `ATLAS_OVERPASS_API_KEY` as server-only environment variables. Never place the key in client-visible URLs or commit it. Selection is explicit; there is no automatic rotation or retry loop. Review operator policy before changing the endpoint allowlist. Add an actual project/contact URL to the User-Agent when a deployment URL is known.

Runtime cache, cooldown, and rate limiting are local to each process. They are not durable or global. Before opening to broad public traffic, add shared rate limiting and an appropriate provider arrangement. An upstream outage yields exact stale fallback or 503, never a substituted location.

The basemap uses https://tile.openstreetmap.org/{z}/{x}/{y}.png via normal browser caching. `NEXT_PUBLIC_TILE_URL` may override it at build time; a replacement provider must use a compatible attribution policy, and the code attribution must be updated if needed. Do not set no-cache headers, suppress Referer, prefetch regions, or bulk-download tiles. Policy: https://operations.osmfoundation.org/policies/tiles/.

Browser tests abort public tile requests and mock competitor transport. Their success does not establish live provider availability. Keep live source checks in the release report.

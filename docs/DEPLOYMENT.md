# Deployment and operations

The current app runs locally; hosting is optional. For Vercel, use a Next.js project with Node.js 24 and `npm run build`. Review each route's exported `maxDuration` against the target project's configured function limits before deployment. Map analysis does not require a key with a public Overpass endpoint; NVIDIA/Tavily credentials enable optional research. Configure all credentials server-side.

`next.config.ts` includes `data/snapshots/**/*.json` in the analyze function trace. Confirm bundled snapshots exist and are within the 30-day window. Do not publish a claim of offline demo support without them.

The default competitor-data endpoint is https://overpass.private.coffee/api/interpreter. Its policy permits use without registration and requests reasonable shared-resource behavior: https://overpass.private.coffee/. If public services are unavailable, Overpass.ch offers a free API-key plan with a monthly query quota: https://overpass.ch/docs. Set `ATLAS_OVERPASS_ENDPOINT=https://api.overpass.ch/v1/interpreter` and `ATLAS_OVERPASS_API_KEY` as server-only environment variables. Never place the key in client-visible URLs or commit it. Selection is explicit; there is no automatic rotation or retry loop. Review operator policy before changing the endpoint allowlist. Add an actual project/contact URL to the User-Agent when a deployment URL is known.

Runtime cache, cooldown, and rate limiting are local to each process. They are not durable or global. Before opening to broad public traffic, add shared rate limiting and an appropriate provider arrangement. An upstream outage yields exact stale fallback or 503, never a substituted location.

Research defaults to server-side `NVIDIA_API_KEY` plus `TAVILY_API_KEY`. No Gemini or Geoapify key is required. Optional Maps grounding uses separate server-only Gemini primary/fallback credentials. Keys in the same Google Cloud project share project-level limits; tracked project identifiers share a cooldown, and plain credentials use private key-hash cooldowns. Failed Google context never changes OSM metrics or prevents the independent web flow. See docs/RESEARCH.md for live provider status and implemented fallback bounds.

The basemap uses https://tile.openstreetmap.org/{z}/{x}/{y}.png via normal browser caching. `NEXT_PUBLIC_TILE_URL` may override it at build time; a replacement provider must use a compatible attribution policy, and the code attribution must be updated if needed. Do not set no-cache headers, suppress Referer, prefetch regions, or bulk-download tiles. Policy: https://operations.osmfoundation.org/policies/tiles/.

Browser tests abort public tile requests and mock competitor transport. Their success does not establish live provider availability. Report live source checks separately from automated tests.

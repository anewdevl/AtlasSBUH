export {};
const origin = process.argv[2] || 'http://127.0.0.1:3200';
async function main() {
  const page = await fetch(origin); console.log(JSON.stringify({ check: 'page', status: page.status, atlas: (await page.text()).includes('ATLAS') }));
  const response = await fetch(`${origin}/api/analyze`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ schemaVersion: '1', registryVersion: '2', scope: { cityId: 'nyc', center: { lat: 40.7308, lon: -73.9973 }, radiusMeters: 1000 }, categoryId: 'cafe', adjacentCategoryIds: [] }), signal: AbortSignal.timeout(35000) });
  const result = await response.json();
  console.log(JSON.stringify({ check: 'OSM analysis', httpStatus: response.status, status: result.status, directMappedCount: result.directMappedCount, cacheState: result.provenance?.cacheState, fetchedAt: result.provenance?.fetchedAt, errorCode: result.code }));
  if (!page.ok || !response.ok) process.exitCode = 1;
}
main().catch(() => { console.error('Local app check failed or timed out.'); process.exitCode = 1; });

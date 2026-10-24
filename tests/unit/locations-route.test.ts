import { afterEach, describe, expect, it, vi } from 'vitest';
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
describe('location search', () => {
  it('bounds searches to the chosen city, caches queries, and rejects out-of-city results', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ features: [
      { geometry: { coordinates: [-73.9973, 40.7308] }, properties: { name: 'Washington Square Park', city: 'New York', osm_id: 1, osm_type: 'W' } },
      { geometry: { coordinates: [0, 0] }, properties: { name: 'Outside' } },
    ] })));
    vi.stubGlobal('fetch', fetch); const { GET } = await import('../../src/app/api/locations/route');
    const url = 'http://localhost/api/locations?q=Washington%20Square&city=nyc';
    const response = await GET(new Request(url));
    expect(response.status).toBe(200); const data = await response.json(); expect(data.results).toHaveLength(1);
    expect(data.results[0].coordinates).toEqual({ lat: 40.7308, lon: -73.9973 });
    expect(String(fetch.mock.calls[0][0])).toContain('bbox=');
    await GET(new Request(url)); expect(fetch).toHaveBeenCalledTimes(1);
    expect((await GET(new Request('http://localhost/api/locations?q=Other%20Park&city=nyc'))).status).toBe(429);
  });
  it('returns an explicit provider error and validates input before making calls', async () => {
    const fetch = vi.fn().mockRejectedValue(new Error('network')); vi.stubGlobal('fetch', fetch);
    const { GET } = await import('../../src/app/api/locations/route');
    expect((await GET(new Request('http://localhost/api/locations?q=a&city=nyc'))).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
    const response = await GET(new Request('http://localhost/api/locations?q=Main%20Street&city=nyc'));
    expect(response.status).toBe(503); expect((await response.json()).error).toContain('click the map');
  });
});

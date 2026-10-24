import { z } from 'zod';
import { cities, inCity, quantize } from '../../../lib/cities';
import { locationResultsSchema, locationSearchSchema } from '../../../lib/location-search';

export const runtime = 'nodejs';
const cache = new Map<string, { time: number; results: z.infer<typeof locationResultsSchema> }>();
let nextRequest = 0;
const photonSchema = z.object({ features: z.array(z.object({ geometry: z.object({ coordinates: z.tuple([z.number(), z.number()]) }), properties: z.record(z.string(), z.unknown()) })).max(50) });
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const parsed = locationSearchSchema.safeParse({ query: params.get('q'), cityId: params.get('city') });
  const headers = { 'Cache-Control': 'no-store' };
  if (!parsed.success) return Response.json({ error: 'Enter at least three characters and select a supported city.' }, { status: 400, headers });
  const { query, cityId } = parsed.data, key = `${cityId}:${query.toLowerCase()}`, saved = cache.get(key);
  if (saved && Date.now() - saved.time < 86400000) return Response.json({ results: saved.results }, { headers });
  if (Date.now() < nextRequest) return Response.json({ error: 'Please wait a second before searching again.' }, { status: 429, headers: { ...headers, 'Retry-After': '1' } });
  nextRequest = Date.now() + 1100;
  try {
    const endpoint = new URL(process.env.ATLAS_GEOCODER_ENDPOINT || 'https://photon.komoot.io/api/');
    if (endpoint.protocol !== 'https:') throw new Error('Invalid geocoder');
    const [south, west, north, east] = cities[cityId].envelope;
    endpoint.search = new URLSearchParams({ q: query, limit: '8', lang: 'en', bbox: `${west},${south},${east},${north}` }).toString();
    const response = await fetch(endpoint, { signal: AbortSignal.any([request.signal, AbortSignal.timeout(8000)]), redirect: 'error', cache: 'no-store', headers: { 'User-Agent': 'ATLAS-SBUH/1.0 (https://github.com/anewdevl/AtlasSBUH)' } });
    if (!response.ok) throw new Error('Geocoder unavailable');
    const body = await response.text(); if (body.length > 100000) throw new Error('Geocoder response too large');
    const data = photonSchema.parse(JSON.parse(body));
    const results = locationResultsSchema.parse(data.features.flatMap((f, index) => {
      const coordinates = quantize({ lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] });
      if (!inCity(cityId, coordinates)) return [];
      const p = f.properties;
      const label = [...new Set([p.name, [p.housenumber, p.street].filter(Boolean).join(' '), p.district, p.city, p.state].filter((v): v is string => typeof v === 'string' && !!v))].join(', ').slice(0, 1000);
      return label ? [{ id: `${p.osm_type ?? 'place'}-${p.osm_id ?? index}`, label, coordinates }] : [];
    }).slice(0, 8));
    if (cache.size >= 500) cache.delete(cache.keys().next().value!);
    cache.set(key, { time: Date.now(), results });
    return Response.json({ results }, { headers });
  } catch { return Response.json({ error: 'Location search is unavailable. Try again, or click the map to choose a center.' }, { status: 503, headers }); }
}

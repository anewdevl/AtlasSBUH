export const cities = {
  nyc: { label: 'New York', short: 'NYC', center: { lat: 40.7308, lon: -73.9973 }, envelope: [40.49, -74.27, 40.93, -73.68] },
  london: { label: 'London', short: 'LON', center: { lat: 51.5137, lon: -0.1365 }, envelope: [51.28, -0.51, 51.70, 0.34] },
  dubai: { label: 'Dubai', short: 'DXB', center: { lat: 25.2048, lon: 55.2708 }, envelope: [24.80, 54.85, 25.40, 55.60] },
  singapore: { label: 'Singapore', short: 'SIN', center: { lat: 1.3000, lon: 103.8500 }, envelope: [1.15, 103.59, 1.48, 104.10] },
} as const;
export type CityId = keyof typeof cities;
export type Position = { lat: number; lon: number };
export const quantize = (p: Position): Position => ({ lat: Number(p.lat.toFixed(4)), lon: Number(p.lon.toFixed(4)) });
export function inCity(city: CityId, p: Position) { const [s,w,n,e] = cities[city].envelope; return p.lat >= s && p.lat <= n && p.lon >= w && p.lon <= e; }
export function distance(a: Position, b: Position) {
  const rad = Math.PI / 180, dlat = (b.lat-a.lat)*rad, dlon = (b.lon-a.lon)*rad;
  const h = Math.sin(dlat/2)**2 + Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dlon/2)**2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1,h)));
}

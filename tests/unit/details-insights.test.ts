import { describe, it, expect } from 'vitest';
import { extractDetails } from '../../src/lib/details';
import { insights } from '../../src/lib/competitor-insights';
import { request, result } from '../fixtures';

const base = { sourceType: 'node' as const, positionKind: 'node' as const, categoryId: 'cafe' as const, relation: 'direct' as const, evidence: { amenity: 'cafe' }, sourceUrl: 'https://www.openstreetmap.org/node/1' };
const at = (id: number, name: string | null, lat: number, distanceMeters: number) => ({ ...base, sourceId: id, name, coordinates: { lat, lon: -74 }, distanceMeters });

describe('extractDetails', () => {
  it('builds readable fields from OSM tags', () => {
    expect(extractDetails({
      'addr:housenumber': '12', 'addr:street': 'Bleecker St', 'addr:city': 'New York',
      website: 'bluebottle.com', phone: '+1 212 555 0100', opening_hours: 'Mo-Su 07:00-19:00',
      cuisine: 'coffee_shop;breakfast', takeaway: 'yes', wheelchair: 'limited', outdoor_seating: 'no', brand: 'Blue Bottle',
    })).toEqual({
      address: '12 Bleecker St, New York', website: 'https://bluebottle.com', phone: '+1 212 555 0100',
      openingHours: 'Mo-Su 07:00-19:00', cuisine: 'coffee shop, breakfast', takeaway: 'yes',
      wheelchair: 'limited', outdoorSeating: 'no', brand: 'Blue Bottle',
    });
  });
  it('drops unsafe or invalid values but keeps the rest', () => {
    const d = extractDetails({ website: 'javascript:alert(1)', takeaway: 'maybe', phone: '555-0100' });
    expect(d).toEqual({ phone: '555-0100' });
  });
  it('returns undefined when nothing is usable', () => {
    expect(extractDetails({ amenity: 'cafe' })).toBeUndefined();
  });
});

describe('normalize with details', () => {
  it('attaches details only when tags provide them', () => {
    const r = result([
      { type: 'node', id: 1, lat: request.scope.center.lat, lon: request.scope.center.lon, tags: { amenity: 'cafe', name: 'A', website: 'https://a.example' } },
      { type: 'node', id: 2, lat: request.scope.center.lat, lon: request.scope.center.lon, tags: { amenity: 'cafe', name: 'B' } },
    ]);
    expect(r.competitors.find(c => c.sourceId === 1)?.details).toEqual({ website: 'https://a.example' });
    expect('details' in r.competitors.find(c => c.sourceId === 2)!).toBe(false);
  });
});

describe('insights', () => {
  const all = [at(1, 'Joe Coffee', 40.7300, 100), at(2, 'Joe  Coffee!', 40.7302, 300), at(3, 'Other', 40.7301, 200), at(4, 'Far', 40.7400, 900)];
  it('ranks, counts neighbors, and finds same-name branches', () => {
    const i = insights(all[0], all);
    expect(i.rank).toBe(1);
    expect(i.total).toBe(4);
    expect(i.rivalsNearby).toBe(2);
    expect(i.nearestRival?.name).toBe('Other');
    expect(i.sameNameOthers).toBe(1);
  });
  it('handles a lone business', () => {
    const i = insights(all[0], [all[0]]);
    expect(i).toMatchObject({ rank: 1, total: 1, rivalsNearby: 0, nearestRival: null, sameNameOthers: 0 });
  });
});
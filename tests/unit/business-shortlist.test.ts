import { describe, expect, it } from 'vitest';
import { businessSourceAllowed, shortlistBusinesses } from '../../src/lib/business-shortlist';
import { request, result } from '../fixtures';

describe('radius shortlist and evidence relevance', () => {
  it('ranks a relevant farther business ahead of an adjacent nearby one and excludes outside/unnamed features', () => {
    const scope = { ...request, adjacentCategoryIds: ['bakery' as const] };
    const data = result([
      { type: 'node', id: 1, lat: 40.738, lon: -73.9973, tags: { amenity: 'cafe', name: 'Far Coffee' } },
      { type: 'node', id: 2, lat: 40.7308, lon: -73.9973, tags: { shop: 'bakery', name: 'Near Bakery' } },
      { type: 'node', id: 3, lat: 40.8, lon: -73.9973, tags: { amenity: 'cafe', name: 'Outside Coffee' } },
      { type: 'node', id: 4, lat: 40.7308, lon: -73.9973, tags: { amenity: 'cafe' } },
    ], scope);
    const shortlist = shortlistBusinesses(data, 'coffee shop');
    expect(shortlist.map(b => b.name)).toEqual(['Far Coffee', 'Near Bakery']);
    expect(shortlist[0].distanceMeters).toBeGreaterThan(shortlist[1].distanceMeters);
    expect(shortlist.every(b => b.distanceMeters <= 1000)).toBe(true);
  });
  it('uses proximity among equally related businesses, without merging separate branches', () => {
    const data = result([1, 2, 3].map((id) => ({ type: 'node', id, lat: 40.7308 + id * 0.001, lon: -73.9973, tags: { amenity: 'cafe', name: 'Coffee Brand' } })));
    expect(shortlistBusinesses(data, 'coffee').map(b => b.id)).toEqual(['node/1', 'node/2', 'node/3']);
  });
  it('rejects news, roundups, vendor case studies and unrelated names', () => {
    const source = { url: 'https://fixture.example/menu', title: 'Birch Coffee menu', excerpt: 'Birch Coffee serves espresso.' };
    expect(businessSourceAllowed(source, ['Birch Coffee'])).toBe(true);
    expect(businessSourceAllowed(source, ['Another Business'])).toBe(false);
    expect(businessSourceAllowed({ ...source, url: 'https://fixture.example/news/birch-coffee' }, ['Birch Coffee'])).toBe(false);
    expect(businessSourceAllowed({ ...source, url: 'https://squareup.com/us/en/press/birch-coffee' }, ['Birch Coffee'])).toBe(false);
    expect(businessSourceAllowed({ ...source, title: 'Top 10 coffee shops including Birch Coffee' }, ['Birch Coffee'])).toBe(false);
    expect(businessSourceAllowed({ ...source, url: 'https://yelp.com/search?find_desc=Birch+Coffee' }, ['Birch Coffee'])).toBe(false);
    expect(businessSourceAllowed({ ...source, title: 'Irving Farm New York', excerpt: 'Our cafes and menus.' }, ['Irving Farm Coffee Roasters'])).toBe(true);
  });
});

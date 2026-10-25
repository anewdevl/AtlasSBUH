import { describe, expect, it } from 'vitest';
import { businessSourceAllowed, shortlistBusinesses, businessQualifiers, sourceCategoryAllowed, localBusinessQuery } from '../../src/lib/business-shortlist';
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
  it('preserves desi as a specialty requirement without inventing evidence from category aliases', () => {
    const scope = { ...request, categoryId: 'clothing' as const };
    const data = result([
      {type:'node',id:1,lat:40.7308,lon:-73.9973,tags:{shop:'clothes',name:'Generic Boutique'}},
      {type:'node',id:2,lat:40.732,lon:-73.9973,tags:{shop:'clothes',name:'Desi Boutique'}},
    ], scope);
    const rows = shortlistBusinesses(data, 'desi Clothing store');
    expect(businessQualifiers('desi Clothing store', 'clothing')).toEqual(['desi']);
    expect(rows.map(b=>b.name)).toEqual(['Desi Boutique','Generic Boutique']);
    expect(rows[1].matchReason).toContain('No specialty evidence');
    expect(rows[1].relevanceScore).toBe(40);
    expect(rows[0].matchReason).toContain('offerings still require verification');
    const query = localBusinessQuery('Atelier New York','clothing','New York','desi clothing store');
    expect(query).toContain('Clothing shop'); expect(query).toContain('offerings'); expect(query).not.toContain('menu');
  });
  it('rejects same-name restaurants for clothing research, including mixed excerpts', () => {
    expect(sourceCategoryAllowed({title:'Atelier - New York, NY Restaurant | Menu + Delivery',excerpt:'Atelier fashion nearby'},'clothing')).toBe(false);
    expect(sourceCategoryAllowed({title:'Atelier New York',excerpt:'Our restaurant serves dinner.'},'clothing')).toBe(false);
    expect(sourceCategoryAllowed({title:'Atelier New York designer clothing',excerpt:'Shop apparel and accessories.'},'clothing')).toBe(true);
    expect(sourceCategoryAllowed({title:'Random Atelier',excerpt:'Contact us.'},'clothing')).toBe(false);
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

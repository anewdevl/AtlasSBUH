import { describe, expect, it, vi } from 'vitest';
import { request } from '../fixtures';
import { categories, categoryIds, matchingEvidence } from '../../src/lib/categories';
import { areaCenters, scoreAreas, type AreaCandidate } from '../../src/lib/location-advisor';
import { adviseLocation, buildAreaQuery, measureAreas } from '../../src/server/location-advisor';
import { researchConfig } from '../../src/server/research-providers';
import { buildQuery, MAX_RECORDS } from '../../src/server/overpass';

const input = { analysis: request, description: 'Coffee shop' };
const config = researchConfig({ NVIDIA_API_KEY: 'test' });
function elements() {
 return areaCenters(request).flatMap((a, index) => [
  { type: 'node', id: index * 10 + 1, ...a.center, tags: { highway: 'bus_stop' } },
  ...Array.from({ length: index + 1 }, (_, n) => ({ type: 'node', id: index * 10 + n + 2, ...a.center, tags: { shop: 'books', name: 'Synthetic bookshop' } })),
  { type: 'node', id: index * 10 + 9, ...a.center, tags: { amenity: 'cafe' } },
 ]);
}
const json = (v: unknown) => new Response(JSON.stringify(v));
describe('Expanded mapped business types', () => {
 it('every new selector produces matching evidence and excludes closed features', () => {
  expect(categoryIds.length).toBe(30);
  for (const id of categoryIds.slice(5)) for (const predicate of categories[id].predicates) {
   const [, key, value] = predicate.match(/^\["([a-z_]+)"="([a-z_]+)"\]$/)!;
   expect(matchingEvidence(id, { [key]: value })).toEqual({ [key]: value });
   expect(matchingEvidence(id, { [key]: value, 'disused:yes': 'yes' })).toBeNull();
   expect(buildQuery({ ...request, categoryId: id })).toContain(`nwr${predicate}`);
  }
 });
 it('does not treat arbitrary offices, shops or fitness pitches as selected businesses', () => {
  expect(matchingEvidence('software', { office: 'company' })).toBeNull();
  expect(matchingEvidence('gym', { leisure: 'pitch' })).toBeNull();
  expect(matchingEvidence('restaurant', { shop: 'books' })).toBeNull();
 });
});
describe('Location screening evidence and decisions', () => {
 it('builds three equal-radius queries and substitutes alternatives at the city edge', () => {
  expect(areaCenters(request).map(a => a.id)).toEqual(['current', 'north', 'east']);
  const edge = { ...request, scope: { ...request.scope, center: { lat: 40.93, lon: -73.68 } } };
  expect(areaCenters(edge).map(a => a.id)).toEqual(['current', 'south', 'west']);
  expect(buildAreaQuery(input)).toContain('["highway"="bus_stop"]');
  expect(buildAreaQuery(input)).not.toContain(input.description);
 });
 it('uses exact radius, deduplicates source IDs and excludes inactive features', () => {
  const records = elements();
  const measured = measureAreas(input, [...records, records[0], { ...records[0], id: 500, tags: { highway: 'bus_stop', disused: 'yes' } }, { ...records[0], id: 501, lat: 40.9 }]);
  expect(measured.complete).toBe(true);
  expect(measured.areas.map(a => a.transit)).toEqual([1, 1, 1]);
  expect(measured.areas.map(a => a.complements)).toEqual([1, 2, 3]);
  expect(measured.areas.map(a => a.score)).toEqual([27.5, 50, 72.5]);
 });
 it('withholds rankings for truncation, invalid positions and empty activity', () => {
  const truncated = measureAreas(input, Array.from({ length: MAX_RECORDS + 1 }, () => elements()[0]));
  expect(truncated.areas.every(a => a.score === null)).toBe(true);
  expect(measureAreas(input, [...elements(), { type: 'node', id: 999, lat: 999, lon: 0 }]).complete).toBe(false);
  const areas = measureAreas(input, elements()).areas;
  expect(scoreAreas(areas.map((a, i) => i ? a : { ...a, complements: 0, transit: 0 }), true).every(a => a.score === null)).toBe(true);
  expect(scoreAreas([areas[0]], true)[0].score).toBeNull();
 });
 it('scores identical areas equally rather than inventing differences', () => {
  const a = measureAreas(input, elements()).areas[0];
  expect(scoreAreas([a, { ...a, id: 'north' }] as AreaCandidate[], true).map(c => c.score)).toEqual([50, 50]);
 });
 it('makes one map call and one bounded NVIDIA decision with validated source IDs', async () => {
  const transport = vi.fn<typeof fetch>(async url => String(url).includes('nvidia') ? json({ choices: [{ message: { content: JSON.stringify({ recommendedId: 'east', priorities: ['complements', 'transit'], checks: ['rent', 'footfall', 'permits'] }) } }] }) : json({ elements: elements() }));
  const report = await adviseLocation(input, { config, transport });
  expect(report.status).toBe('provisional'); expect(report.recommendation?.recommendedId).toBe('east');
  expect(transport).toHaveBeenCalledTimes(2);
  expect(report.queryHash).toMatch(/^[a-f0-9]{64}$/);
  expect(report.candidates[0].sources[0].id).toBe('node/1');
 });
 it('keeps measured areas but rejects a model recommendation against the computed ranking', async () => {
  const transport: typeof fetch = async url => String(url).includes('nvidia') ? json({ choices: [{ message: { content: JSON.stringify({ recommendedId: 'current', priorities: ['competition'], checks: ['rent', 'footfall', 'permits'] }) } }] }) : json({ elements: elements() });
  const report = await adviseLocation(input, { config, transport });
  expect(report.status).toBe('agent-unavailable'); expect(report.recommendation).toBeNull();
  expect(report.candidates).toHaveLength(3);
 });
 it('does not call NVIDIA for insufficient map evidence; a provider failure never becomes zero counts', async () => {
  const transport = vi.fn<typeof fetch>(async () => json({ elements: [] }));
  expect((await adviseLocation(input, { config, transport })).status).toBe('insufficient');
  expect(transport).toHaveBeenCalledTimes(1);
  await expect(adviseLocation(input, { config, transport: async () => new Response('', { status: 503 }) })).rejects.toThrow();
 });
});

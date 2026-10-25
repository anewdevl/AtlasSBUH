import { describe, it, expect } from 'vitest';
import { areaStats, describeChange, percentChange } from '../../src/lib/compare-stats';
import { result } from '../fixtures';

const cafe = (id: number, name: string, dy = 0) => ({ type: 'node', id, lat: 40.7308 + dy, lon: -73.9973, tags: { amenity: 'cafe', name } });

describe('areaStats', () => {
  it('counts chains by repeated names, ignoring case and punctuation', () => {
    const r = result([cafe(1, 'Joe Coffee'), cafe(2, 'JOE  coffee!', 0.001), cafe(3, 'Joe Coffee', 0.002), cafe(4, 'Solo Cafe', 0.003), cafe(5, 'Other', 0.004)]);
    const s = areaStats(r);
    expect(s.direct).toBe(5);
    expect(s.chainShare).toBe(60);
    expect(s.repeatedNames).toEqual([{ name: 'Joe Coffee', count: 3 }]);
  });
  it('handles an empty area', () => {
    const s = areaStats(result([]));
    expect(s).toMatchObject({ direct: 0, adjacent: 0, density: 0, chainShare: 0, repeatedNames: [] });
  });
});

describe('percentChange and describeChange', () => {
  it('computes percent change and refuses a zero base', () => {
    expect(percentChange(50, 75)).toBe(50);
    expect(percentChange(80, 20)).toBe(-75);
    expect(percentChange(0, 5)).toBeNull();
  });
  it('uses neutral wording', () => {
    expect(describeChange('competitors', 100, 150)).toBe('The current area has 50% more competitors than the pinned area.');
    expect(describeChange('competitors', 100, 25)).toBe('The current area has 75% fewer competitors than the pinned area.');
    expect(describeChange('competitors', 4, 4)).toBe('Both areas have the same competitors.');
    expect(describeChange('competitors', 0, 4)).toBe('The current area has competitors where the pinned area has none.');
  });
});
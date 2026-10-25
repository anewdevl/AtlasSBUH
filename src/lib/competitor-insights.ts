import { distance } from './cities';
import type { Competitor } from './competitor-view';

/** Rivals closer than this to a business count as "right next door". */
export const NEARBY_METERS = 250;

export type CompetitorInsights = {
  /** 1 = closest to the search center. */
  rank: number;
  total: number;
  rivalsNearby: number;
  nearestRival: { name: string; meters: number } | null;
  /** Other businesses in the area with the same name (a chain or a repeat brand). */
  sameNameOthers: number;
};

const key = (c: Competitor) => `${c.sourceType}/${c.sourceId}`;
const normalName = (name: string | null) => (name ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export function insights(target: Competitor, all: Competitor[]): CompetitorInsights {
  const id = key(target);
  const name = normalName(target.name);
  let rank = 1, rivalsNearby = 0, sameNameOthers = 0;
  let nearest: { name: string; meters: number } | null = null;
  for (const c of all) {
    if (key(c) === id) continue;
    if (c.distanceMeters < target.distanceMeters) rank++;
    const gap = distance(target.coordinates, c.coordinates);
    if (gap <= NEARBY_METERS) rivalsNearby++;
    if (!nearest || gap < nearest.meters) nearest = { name: c.name ?? 'Unnamed mapped feature', meters: gap };
    if (name && normalName(c.name) === name) sameNameOthers++;
  }
  return { rank, total: all.length, rivalsNearby, nearestRival: nearest, sameNameOthers };
}
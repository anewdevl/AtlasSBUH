import type { AnalysisResponse } from './contracts';

export type AreaStats = {
  direct: number;
  adjacent: number;
  density: number;
  /** Share (0-100) of direct businesses whose name also appears elsewhere in the same area. */
  chainShare: number;
  /** Names that appear more than once, most frequent first (at most 3). */
  repeatedNames: { name: string; count: number }[];
};

const normalName = (name: string | null) => (name ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** Expects a complete analysis, so the aggregate counts are present. */
export function areaStats(r: AnalysisResponse): AreaStats {
  const direct = r.competitors.filter(c => c.relation === 'direct');
  const groups = new Map<string, { name: string; count: number }>();
  for (const c of direct) {
    const key = normalName(c.name);
    if (!key) continue;
    const g = groups.get(key);
    if (g) g.count++; else groups.set(key, { name: c.name!, count: 1 });
  }
  const repeated = [...groups.values()].filter(g => g.count > 1).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const inChains = repeated.reduce((sum, g) => sum + g.count, 0);
  return {
    direct: r.directMappedCount ?? direct.length,
    adjacent: r.adjacentMappedCount ?? r.competitors.length - direct.length,
    density: r.directMappedDensity ?? 0,
    chainShare: direct.length ? Math.round((inChains / direct.length) * 100) : 0,
    repeatedNames: repeated.slice(0, 3),
  };
}

/** Percent change from a to b, or null when a is zero (no meaningful base). */
export function percentChange(a: number, b: number): number | null {
  if (a === 0) return null;
  return Math.round(((b - a) / a) * 100);
}

/** Neutral wording: describes the gap and never names a winner. */
export function describeChange(label: string, a: number, b: number): string {
  if (a === b) return `Both areas have the same ${label}.`;
  const pct = percentChange(a, b);
  if (pct === null) return `The current area has ${label} where the pinned area has none.`;
  return `The current area has ${Math.abs(pct)}% ${pct > 0 ? 'more' : 'fewer'} ${label} than the pinned area.`;
}
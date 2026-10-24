import { z } from 'zod';
import { categories, categoryIds } from './categories';
import { distance } from './cities';
import { positionSchema, type AnalysisResponse } from './contracts';

export const shortlistedBusinessSchema = z.object({
  id: z.string(), name: z.string().min(1).max(500), coordinates: positionSchema,
  distanceMeters: z.number().nonnegative(), positionKind: z.enum(['node', 'representative-center']),
  categoryId: z.enum(categoryIds), relation: z.enum(['direct', 'adjacent']),
  relevanceScore: z.number().min(0).max(100), rankScore: z.number().min(0).max(100),
  matchReason: z.string(), sourceUrl: z.url(),
}).strict();
export type ShortlistedBusiness = z.infer<typeof shortlistedBusinessSchema>;
export const normalizedName = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export function businessNames(name: string) {
  const full = normalizedName(name), short = full.replace(/\s+(?:coffee roasters|coffee roasting company|inc|llc)$/, '');
  return [...new Set([full, ...(short.length >= 6 ? [short] : [])])];
}

/** All named mapped candidates are retained; distance is recomputed, never supplied by an LLM. */
export function shortlistBusinesses(result: AnalysisResponse, description: string): ShortlistedBusiness[] {
  const words = normalizedName(description).split(' ').filter(w => w.length > 3);
  return result.competitors.flatMap(c => {
    const meters = distance(result.request.scope.center, c.coordinates);
    if (!c.name || meters > result.request.scope.radiusMeters) return [];
    const searchable = normalizedName(`${c.name} ${categories[c.categoryId].aliases.join(' ')} ${Object.values(c.evidence).join(' ')}`);
    const matches = [...new Set(words.filter(w => searchable.split(' ').includes(w)))];
    const relevanceScore = Math.min(100, (c.relation === 'direct' ? 85 : 45) + Math.min(15, matches.length * 5));
    const proximity = Math.max(0, 1 - meters / result.request.scope.radiusMeters) * 100;
    return [{ id: `${c.sourceType}/${c.sourceId}`, name: c.name, coordinates: c.coordinates, distanceMeters: meters, positionKind: c.positionKind, categoryId: c.categoryId, relation: c.relation, relevanceScore,
      rankScore: Math.round((0.8 * relevanceScore + 0.2 * proximity) * 10) / 10,
      matchReason: `${c.relation === 'direct' ? 'Matches selected' : 'Adjacent'} category: ${categories[c.categoryId].label}.${matches.length ? ` Matching terms: ${matches.join(', ')}.` : ''}`,
      sourceUrl: c.sourceUrl }];
  }).sort((a, b) => b.rankScore - a.rankScore || b.relevanceScore - a.relevanceScore || a.distanceMeters - b.distanceMeters || a.id.localeCompare(b.id));
}

/** Deterministic exclusion is followed by the extractor's narrower business-page classification. */
export function businessSourceAllowed(source: { url: string; title: string; excerpt: string }, names: string[]) {
  const url = new URL(source.url); let path: string;
  try { path = decodeURIComponent(url.pathname).toLowerCase(); } catch { return false; }
  if (/(?:^|\/)(?:news|blog|blogs|article|articles|press|press-release|magazine|search|search_results|search-results)(?:\/|$)/.test(path)) return false;
  if (/\b(?:top\s+\d+|best\s+\d+|roundup|round-up|news|stock market|press release|best .* (?:in|for))\b/i.test(source.title)) return false;
  if (/(^|\.)(?:reuters|bbc|cnn|nytimes|theguardian|forbes)\.(?:com|co\.uk)$/.test(url.hostname)) return false;
  const text = ` ${normalizedName(`${source.title} ${source.excerpt}`)} `;
  return names.some(name => businessNames(name).some(alias => text.includes(` ${alias} `)));
}

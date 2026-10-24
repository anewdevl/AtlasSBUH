import { z } from 'zod';
import { canonicalize, positionSchema, requestSchema, type AnalysisRequest } from './contracts';
import { inCity, quantize } from './cities';
import type { CategoryId } from './categories';

export const locationAdviceRequestSchema = z.object({ analysis: requestSchema, description: z.string().trim().max(500).default('') }).strict();
export type LocationAdviceRequest = z.infer<typeof locationAdviceRequestSchema>;
export const metricIds = ['complements', 'transit', 'competition'] as const;
export const checks = {
 rent: 'Collect rent, lease terms and fit-out costs for actual available premises.',
 footfall: 'Count pedestrians at the proposed entrance on weekdays and weekends.',
 competitors: 'Visit nearby competitors and verify their current offerings, prices and opening status.',
 access: 'Walk transit routes and check entrances, accessibility, parking and delivery access.',
 permits: 'Confirm zoning, licensing and permitted use with the relevant local authority.',
 customers: 'Interview prospective customers and test willingness to pay before committing.',
} as const;
export const advisorDecisionSchema = z.object({
 recommendedId: z.enum(['current', 'north', 'east', 'south', 'west']).nullable(),
 priorities: z.array(z.enum(metricIds)).min(1).max(3),
 checks: z.array(z.enum(['rent', 'footfall', 'competitors', 'access', 'permits', 'customers'])).min(3).max(6),
}).strict();
const candidateSchema = z.object({
 id: z.enum(['current', 'north', 'east', 'south', 'west']), label: z.string(), center: positionSchema,
 competition: z.number().int().nonnegative(), complements: z.number().int().nonnegative(), transit: z.number().int().nonnegative(),
 score: z.number().min(0).max(100).nullable(),
 sources: z.array(z.object({ id: z.string().regex(/^(node|way|relation)\/\d+$/), name: z.string(), metric: z.enum(metricIds) }).strict()).max(12),
}).strict();
export type AreaCandidate = z.infer<typeof candidateSchema>;
export const locationAdviceSchema = z.object({
 request: locationAdviceRequestSchema, candidates: z.array(candidateSchema).min(1).max(3),
 status: z.enum(['provisional', 'insufficient', 'agent-unavailable']),
 recommendation: advisorDecisionSchema.nullable(), model: z.string(), fetchedAt: z.iso.datetime(), osmBaseTimestamp: z.string().nullable(),
 query: z.string(), queryHash: z.string(), complementCategories: z.array(z.string()), warnings: z.array(z.string()),
}).strict();
export type LocationAdvice = z.infer<typeof locationAdviceSchema>;

/** Sample alternatives, not an exhaustive city search. Equal radii; centers ~2 radii apart. */
export function areaCenters(input: AnalysisRequest) {
 const r = canonicalize(input), { center, radiusMeters } = r.scope;
 const delta = radiusMeters * 2.1 / 111195;
 const options = [
  { id: 'current' as const, label: 'Selected area', center },
  { id: 'north' as const, label: 'Nearby north', center: quantize({ lat: center.lat + delta, lon: center.lon }) },
  { id: 'east' as const, label: 'Nearby east', center: quantize({ lat: center.lat, lon: center.lon + delta / Math.cos(center.lat * Math.PI / 180) }) },
  { id: 'south' as const, label: 'Nearby south', center: quantize({ lat: center.lat - delta, lon: center.lon }) },
  { id: 'west' as const, label: 'Nearby west', center: quantize({ lat: center.lat, lon: center.lon - delta / Math.cos(center.lat * Math.PI / 180) }) },
 ];
 return options.filter(a => inCity(r.scope.cityId, a.center)).slice(0, 3);
}
/** These are hypotheses about complementary activity, not measured customer demand. */
export function complementCategories(id: CategoryId): CategoryId[] {
 const food: CategoryId[] = ['cafe', 'bakery', 'bubble-tea', 'restaurant', 'fast-food', 'bar', 'ice-cream'];
 const offices: CategoryId[] = ['software', 'coworking', 'estate-agent', 'accountant', 'lawyer'];
 if (food.includes(id)) return ['coworking', 'hotel', 'books', 'clothing'];
 if (offices.includes(id)) return ['cafe', 'restaurant', 'hotel'];
 if (['clinic', 'dentist', 'pharmacy'].includes(id)) return (['clinic', 'dentist', 'pharmacy', 'supermarket'] as CategoryId[]).filter(c => c !== id);
 return (['cafe', 'supermarket', 'gym', 'hairdresser'] as CategoryId[]).filter(c => c !== id);
}
/** Relative scores, with equal counts neutral. No ranking when an area has no activity signal. */
export function scoreAreas(areas: AreaCandidate[], complete: boolean): AreaCandidate[] {
 if (!complete || areas.length < 2 || areas.some(a => a.complements + a.transit === 0)) return areas.map(a => ({ ...a, score: null }));
 const normalized = (a: AreaCandidate, key: typeof metricIds[number]) => {
  const values = areas.map(c => c[key]), lo = Math.min(...values), hi = Math.max(...values);
  return hi === lo ? 0.5 : (a[key] - lo) / (hi - lo);
 };
 return areas.map(a => ({ ...a, score: Math.round(1000 * (0.45 * normalized(a, 'complements') + 0.35 * normalized(a, 'transit') + 0.2 * (1 - normalized(a, 'competition')))) / 10 }));
}

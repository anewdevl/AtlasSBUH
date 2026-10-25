import { z } from 'zod';

const text = (max: number) => z.string().trim().min(1).max(max);

/** Optional, display-only facts copied from OpenStreetMap tags. They never affect counts or matching. */
export const competitorDetailsSchema = z.object({
  address: text(200).optional(),
  phone: text(60).optional(),
  website: z.url().max(300).refine(u => /^https?:\/\//i.test(u), 'Only http(s) links').optional(),
  openingHours: text(300).optional(),
  brand: text(120).optional(),
  cuisine: text(120).optional(),
  takeaway: z.enum(['yes', 'no', 'only']).optional(),
  wheelchair: z.enum(['yes', 'no', 'limited']).optional(),
  outdoorSeating: z.enum(['yes', 'no']).optional(),
}).strict();
export type CompetitorDetails = z.infer<typeof competitorDetailsSchema>;

const clean = (v?: string) => v?.replace(/\s+/g, ' ').trim() || undefined;

function websiteOf(tags: Record<string, string>) {
  const raw = clean(tags.website ?? tags['contact:website']);
  if (!raw) return undefined;
  return /^https?:\/\//i.test(raw) ? raw : /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(raw) ? `https://${raw}` : raw;
}

/**
 * Pulls display details out of raw OSM tags. Every field is validated on its own,
 * so one bad value (for example a javascript: link) is dropped without losing the rest.
 */
export function extractDetails(tags: Record<string, string>): CompetitorDetails | undefined {
  const street = [clean(tags['addr:housenumber']), clean(tags['addr:street'])].filter(Boolean).join(' ');
  const place = clean(tags['addr:city']) ?? clean(tags['addr:suburb']);
  const candidate: Record<string, unknown> = {
    address: [street, place].filter(Boolean).join(', ') || undefined,
    phone: clean(tags.phone ?? tags['contact:phone']),
    website: websiteOf(tags),
    openingHours: clean(tags.opening_hours),
    brand: clean(tags.brand),
    cuisine: clean(tags.cuisine)?.replace(/;/g, ', ').replace(/_/g, ' '),
    takeaway: clean(tags.takeaway),
    wheelchair: clean(tags.wheelchair),
    outdoorSeating: clean(tags.outdoor_seating),
  };
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(candidate)) {
    if (value === undefined) continue;
    const field = competitorDetailsSchema.shape[key as keyof typeof competitorDetailsSchema.shape];
    const parsed = field.safeParse(value);
    if (parsed.success && parsed.data !== undefined) out[key] = parsed.data;
  }
  return Object.keys(out).length ? (out as CompetitorDetails) : undefined;
}
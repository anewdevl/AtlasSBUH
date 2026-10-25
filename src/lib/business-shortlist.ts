import { z } from 'zod';
import { categories, categoryIds, type CategoryId } from './categories';
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

/** Words outside the map category remain explicit, unverified business requirements. */
export function businessQualifiers(description: string, categoryId: CategoryId) {
  const generic = new Set(normalizedName(`${categories[categoryId].label} ${categories[categoryId].aliases.join(' ')} business shop store company open opening want would like start sell selling a an the in at with and for of to my new`).split(' '));
  return [...new Set(normalizedName(description).split(' ').filter(w => w.length > 2 && !generic.has(w)))];
}
export function candidateQualification(b: ShortlistedBusiness, description: string) {
  const terms = businessQualifiers(description, b.categoryId);
  return terms.length ? `Broad category candidate; specialty requirements (${terms.join(', ')}) remain unverified.` : 'Mapped category candidate; offerings and exact branch remain unverified.';
}
/** Internal ordering is a heuristic, never a confidence percentage. Category aliases are not evidence. */
export function shortlistBusinesses(result: AnalysisResponse, description: string): ShortlistedBusiness[] {
  const qualifiers = businessQualifiers(description, result.request.categoryId);
  return result.competitors.flatMap(c => {
    const meters = distance(result.request.scope.center, c.coordinates);
    if (!c.name || meters > result.request.scope.radiusMeters) return [];
    const tokens = normalizedName(`${c.name} ${Object.values(c.evidence).join(' ')}`).split(' ');
    const matches = qualifiers.filter(w => tokens.includes(w));
    const relevanceScore = (c.relation === 'direct' ? 40 : 10) + (qualifiers.length ? 40 * matches.length / qualifiers.length : 0);
    const proximity = Math.max(0, 1 - meters / result.request.scope.radiusMeters) * 100;
    return [{ id: `${c.sourceType}/${c.sourceId}`, name: c.name, coordinates: c.coordinates, distanceMeters: meters, positionKind: c.positionKind, categoryId: c.categoryId, relation: c.relation, relevanceScore,
      rankScore: Math.round((0.8 * relevanceScore + 0.2 * proximity) * 10) / 10,
      matchReason: `Mapped ${c.relation === 'direct' ? 'category' : 'adjacent category'}: ${categories[c.categoryId].label}. ${qualifiers.length ? `Specialty requirements: ${qualifiers.join(', ')}. ${matches.length ? `Mapped text mentions: ${matches.join(', ')}; offerings still require verification.` : 'No specialty evidence in this mapped record.'}` : 'Category membership alone does not verify competitive relevance.'}`,
      sourceUrl: c.sourceUrl }];
  }).sort((a, b) => b.rankScore - a.rankScore || a.distanceMeters - b.distanceMeters || a.id.localeCompare(b.id));
}

/** Reject explicit category contradictions even if the business name happens to match. */
export function sourceCategoryAllowed(source: { title: string; excerpt: string }, categoryId: CategoryId) {
  const title = normalizedName(source.title), text = normalizedName(`${source.title} ${source.excerpt}`);
  const explicitIdentity: [RegExp, CategoryId[]][] = [
    [/\b(?:is a|is an|we are a|we are an) software company\b/, ['software']],
    [/\b(?:is a|is an|we are a|we are an) restaurant\b/, ['restaurant','fast-food','cafe','bar']],
    [/\b(?:is a|is an|we are a|we are an) (?:clothing store|fashion boutique)\b/, ['clothing']],
    [/\b(?:is a|is an|we are a|we are an) dental clinic\b/, ['dentist','clinic']],
    [/\b(?:is a|is an|we are a|we are an) law firm\b/, ['lawyer']],
  ];
  if (explicitIdentity.some(([pattern, allowed]) => pattern.test(text) && !allowed.includes(categoryId))) return false;
  if (categoryId === 'clothing' || categoryId === 'shoes') {
    if (/\b(restaurant|food delivery|takeout|takeaway|dinner menu|lunch menu)\b/.test(title)) return false;
    return /\b(clothing|clothes|fashion|apparel|boutique|garments|footwear|shoes|wear|designer|resale|vintage)\b/.test(text);
  }
  const food = ['cafe','bakery','bubble-tea','restaurant','fast-food','bar','ice-cream'];
  if (!food.includes(categoryId) && /\b(restaurant|food delivery|takeout|dinner menu)\b/.test(title)) return false;
  if (food.includes(categoryId) && /\b(clothing|apparel|law firm|dental clinic)\b/.test(title)) return false;
  const signals: Partial<Record<CategoryId, RegExp>> = {
    cafe: /\b(coffee|cafe|espresso|latte|cappuccino)\b/,
    bakery: /\b(bakery|bakeries|bread|pastry|pastries|baked|cakes)\b/,
    'bubble-tea': /\b(boba|bubble tea|milk tea)\b/,
    pharmacy: /\b(pharmacy|pharmacies|prescriptions|drugstore)\b/,
    supermarket: /\b(supermarket|groceries|grocery|food market)\b/,
    restaurant: /\b(restaurant|dining|menu|cuisine|dinner|lunch)\b/,
    'fast-food': /\b(fast food|takeaway|takeout|burger|pizza|sandwich|menu)\b/,
    bar: /\b(bar|pub|cocktail|beer|wine)\b/,
    'ice-cream': /\b(ice cream|gelato|sorbet)\b/,
    convenience: /\b(convenience|groceries|grocery|corner store)\b/,
    electronics: /\b(electronics|computer|computers|laptop|phones|devices)\b/,
    books: /\b(books|bookstore|bookshop|bookseller)\b/,
    florist: /\b(florist|flowers|bouquet|floral)\b/,
    'pet-shop': /\b(pet|pets|petfood|aquarium|dog supplies|cat supplies)\b/,
    hairdresser: /\b(hair|hairdresser|barber|haircut|salon)\b/,
    beauty: /\b(beauty|nail|nails|salon|cosmetics|skincare)\b/,
    laundry: /\b(laundry|laundromat|dry cleaning|dry cleaner)\b/,
    gym: /\b(gym|fitness|workout|exercise|training)\b/,
    dentist: /\b(dentist|dental|dentistry|orthodontic)\b/,
    clinic: /\b(clinic|medical|healthcare|physician|doctor)\b/,
    veterinary: /\b(veterinary|veterinarian|vet|animal hospital)\b/,
    'car-repair': /\b(auto repair|car repair|mechanic|automotive|vehicle service)\b/,
    hotel: /\b(hotel|guest house|rooms|accommodation|lodging)\b/,
    software: /\b(software|technology|tech|information technology|it services|saas|cloud)\b/,
    coworking: /\b(coworking|co working|workspace|shared office)\b/,
    'estate-agent': /\b(real estate|estate agent|property|properties|realtor)\b/,
    accountant: /\b(accountant|accounting|bookkeeping|tax|audit)\b/,
    lawyer: /\b(lawyer|law firm|attorney|legal|solicitor)\b/,
  };
  return signals[categoryId]?.test(text) ?? false;
}
export function localBusinessQuery(name: string, categoryId: CategoryId, city: string, description: string) {
  return `"${name}" ${city} ${categories[categoryId].label} official website products services offerings`.trim();
}

/** Deterministic exclusion is followed by the extractor's narrower business-page classification. */
export function businessSourceAllowed(source: { url: string; title: string; excerpt: string }, names: string[]) {
  const url = new URL(source.url); let path: string;
  try { path = decodeURIComponent(url.pathname).toLowerCase(); } catch { return false; }
  if (/(?:^|\/)(?:news|blog|blogs|article|articles|press|press-release|magazine|search|search_results|search-results)(?:\/|$)/.test(path)) return false;
  if (/\b(?:top\s+\d+|best\s+\d+|roundup|round-up|news|stock market|press release|best .* (?:in|for))\b/i.test(source.title)) return false;
  if (/(^|\.)(?:reuters|bbc|cnn|nytimes|theguardian|forbes)\.(?:com|co\.uk)$/.test(url.hostname)) return false;
  const text = ` ${normalizedName(`${source.title} ${source.excerpt}`)} `;
  return names.some(name => businessNames(name).some(alias => alias.length > 0 && text.includes(` ${alias} `)));
}

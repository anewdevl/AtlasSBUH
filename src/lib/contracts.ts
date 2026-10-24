import { z } from 'zod';
import { categoryIds, categories, matchingEvidence, REGISTRY_VERSION } from './categories';
import { distance, inCity, quantize } from './cities';
import { OVERPASS_ENDPOINTS } from './providers';
export const SCHEMA_VERSION = '1';
export const positionSchema = z.object({ lat: z.number().finite().min(-90).max(90), lon: z.number().finite().min(-180).max(180) }).strict();
export const requestShape = z.object({
 schemaVersion: z.string(), registryVersion: z.string(),
 scope: z.object({ cityId: z.string(), center: positionSchema, radiusMeters: z.number().int() }).strict(),
 categoryId: z.string(), adjacentCategoryIds: z.array(z.string()).max(3),
}).strict();
export const requestSchema = z.object({
 schemaVersion: z.literal(SCHEMA_VERSION), registryVersion: z.literal(REGISTRY_VERSION),
 scope: z.object({ cityId: z.enum(['nyc','london','dubai','singapore']), center: positionSchema, radiusMeters: z.union([z.literal(500),z.literal(1000),z.literal(2000)]) }).strict(),
 categoryId: z.enum(categoryIds), adjacentCategoryIds: z.array(z.enum(categoryIds)).max(2),
}).strict().superRefine((r,ctx) => {
 if (!inCity(r.scope.cityId,r.scope.center) || !inCity(r.scope.cityId,quantize(r.scope.center))) ctx.addIssue({ code:'custom', message:'Center outside city guardrail', path:['scope','center'] });
 if (new Set(r.adjacentCategoryIds).size !== r.adjacentCategoryIds.length || r.adjacentCategoryIds.some(id => !categories[r.categoryId].adjacent.includes(id))) ctx.addIssue({ code:'custom', message:'Unsupported adjacent categories', path:['adjacentCategoryIds'] });
});
export type AnalysisRequest = z.infer<typeof requestSchema>;
export function canonicalize(input: AnalysisRequest): AnalysisRequest {
 const r = requestSchema.parse(input);
 return { ...r, scope:{ ...r.scope,center:quantize(r.scope.center) },adjacentCategoryIds:[...r.adjacentCategoryIds].sort() };
}
export function cacheKey(r: AnalysisRequest) { const c = canonicalize(r); return JSON.stringify([c.schemaVersion,c.registryVersion,c.scope.cityId,c.categoryId,c.adjacentCategoryIds,c.scope.center.lat,c.scope.center.lon,c.scope.radiusMeters]); }
const timestamp = z.iso.datetime({ offset:true }).refine(s => Number.isFinite(Date.parse(s)) && Date.parse(s) <= Date.now()+300000, 'Invalid or future timestamp');
const count = z.number().int().min(0);
export const competitorSchema = z.object({
 sourceType:z.enum(['node','way','relation']),sourceId:z.number().int().positive().max(Number.MAX_SAFE_INTEGER),sourceUrl:z.url(),
 name:z.string().min(1).max(500).nullable(),coordinates:positionSchema,positionKind:z.enum(['node','representative-center']),
 categoryId:z.enum(categoryIds),relation:z.enum(['direct','adjacent']),evidence:z.record(z.string(),z.string()),distanceMeters:z.number().finite().nonnegative(),
}).strict();
export const responseSchema = z.object({
 request:requestSchema,status:z.enum(['complete','partial']),truncated:z.boolean(),competitors:z.array(competitorSchema).max(5000),
 directMappedCount:count.nullable(),adjacentMappedCount:count.nullable(),directMappedDensity:z.number().finite().nonnegative().nullable(),
 provenance:z.object({ provider:z.literal('OpenStreetMap / Overpass'),fetchedAt:timestamp,osmBaseTimestamp:timestamp.nullable(),upstreamEndpoint:z.enum(OVERPASS_ENDPOINTS),queryHash:z.string().regex(/^[a-f0-9]{64}$/),cacheState:z.enum(['live','runtime-fresh','snapshot-fresh','runtime-stale','snapshot-stale']),attribution:z.literal('© OpenStreetMap contributors'),licenseLink:z.literal('https://www.openstreetmap.org/copyright'),coverage:z.literal('unknown'),excludedRecordCount:count }).strict(),
 warnings:z.array(z.string().min(1)).max(20),
}).strict().superRefine((r,ctx) => {
 const issue = (message:string) => ctx.addIssue({code:'custom',message});
 const canonical=canonicalize(r.request);
 if (r.request.scope.center.lat!==canonical.scope.center.lat || r.request.scope.center.lon!==canonical.scope.center.lon || r.request.adjacentCategoryIds.join(',')!==canonical.adjacentCategoryIds.join(',')) issue('Request is not canonical');
 const seen = new Set<string>();
 for (const c of r.competitors) {
  const id = `${c.sourceType}/${c.sourceId}`;
  if (seen.has(id)) issue('Duplicate source'); seen.add(id);
  if (c.sourceUrl !== `https://www.openstreetmap.org/${id}`) issue('Invalid derived source URL');
  if ((c.sourceType === 'node') !== (c.positionKind === 'node')) issue('Position kind mismatch');
  if (c.relation === 'direct' ? c.categoryId !== r.request.categoryId : !r.request.adjacentCategoryIds.includes(c.categoryId)) issue('Category relation mismatch');
  const evidence = matchingEvidence(c.categoryId,c.evidence);
  if (!evidence || JSON.stringify(Object.entries(evidence).sort()) !== JSON.stringify(Object.entries(c.evidence).sort())) issue('Invalid matching evidence');
  const d = distance(r.request.scope.center,c.coordinates);
  if (d > r.request.scope.radiusMeters || Math.abs(d-c.distanceMeters)>0.01) issue('Distance or scope mismatch');
 }
 const direct = r.competitors.filter(c=>c.relation==='direct').length;
 const density = direct/(Math.PI*(r.request.scope.radiusMeters/1000)**2);
 if (r.status === 'partial') {
  if (r.directMappedCount !== null || r.adjacentMappedCount !== null || r.directMappedDensity !== null || !r.warnings.length) issue('Partial results require null aggregates and warning');
 } else if (r.truncated || r.directMappedCount !== direct || r.adjacentMappedCount !== r.competitors.length-direct || r.directMappedDensity === null || Math.abs(r.directMappedDensity-density)>1e-9) issue('Inconsistent complete aggregates');
 if (r.truncated && r.status !== 'partial') issue('Truncation requires partial');
 if (r.provenance.osmBaseTimestamp && Date.parse(r.provenance.osmBaseTimestamp)>Date.parse(r.provenance.fetchedAt)+300000) issue('OSM base timestamp after retrieval');
});
export type AnalysisResponse = z.infer<typeof responseSchema>;
export function validateResponse(input:unknown, expected:AnalysisRequest) {
 const r=responseSchema.parse(input);
 if (cacheKey(r.request)!==cacheKey(expected)) throw new Error('Response scope mismatch');
 return r;
}

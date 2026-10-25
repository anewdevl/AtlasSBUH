import { z } from 'zod';
import { positionSchema, requestSchema } from './contracts';
import { shortlistedBusinessSchema } from './business-shortlist';
import { distance } from './cities';

const text = z.string().trim().min(1).max(2000);
export const sourceUrlSchema = z.url().max(2000).refine(value => {
  const u = new URL(value);
  return u.protocol === 'https:' && !u.username && !u.password;
}, 'Sources must use HTTPS without credentials');
export const researchRequestSchema = z.object({
  description: z.string().trim().min(3).max(500),
  scope: requestSchema.shape.scope,
  goals: z.string().trim().max(500).optional(),
  osmRequest: requestSchema.optional(),
  localOnly: z.boolean().optional(),
}).strict().superRefine((r, ctx) => {
  const valid = requestSchema.safeParse({ schemaVersion: '1', registryVersion: '2', scope: r.scope, categoryId: 'cafe', adjacentCategoryIds: [] });
  if (!valid.success) ctx.addIssue({ code: 'custom', message: 'Choose a center inside the city guardrail.' });
  if (r.osmRequest && JSON.stringify(r.osmRequest.scope) !== JSON.stringify(r.scope)) ctx.addIssue({ code: 'custom', message: 'OSM scope must match research scope.' });
  if (r.localOnly && !r.osmRequest) ctx.addIssue({ code: 'custom', message: 'Local research requires a confirmed mapped category.' });
});
export type ResearchRequest = z.infer<typeof researchRequestSchema>;
export const evidenceSchema = z.object({
  id: text, url: sourceUrlSchema, provider: z.enum(['tavily', 'google-maps']),
  retrievedAt: z.iso.datetime(), title: text, excerpt: z.string().min(1).max(8000),
  contentKind: z.enum(['page', 'search-excerpt', 'map-grounded']),
  placeId: text.nullable(), coordinates: positionSchema.nullable(),
}).strict();
export type Evidence = z.infer<typeof evidenceSchema>;
export const findingSchema = z.object({
  id: text, claim: text, kind: z.enum(['competitor', 'offering', 'price', 'feedback', 'location']),
  business: text.nullable(), relation: z.enum(['direct', 'adjacent', 'context']),
  evidence: z.array(z.object({ sourceId: text, quote: z.string().min(1).max(2000) }).strict()).min(1).max(8),
  geographicRelevance: text, limitations: z.array(text).min(1).max(8),
  reviewSampleSize: z.number().int().positive().nullable(), reviewDates: text.nullable(),
}).strict();
export type Finding = z.infer<typeof findingSchema>;
export const insightSchema = z.object({
  id: text, kind: z.enum(['interpretation', 'hypothesis', 'experiment']), recommendation: text,
  findingIds: z.array(text).min(1).max(8), reasoning: text, uncertainty: text, validation: text,
}).strict();
export const impactSchema = z.object({
 id:text, business:text, effect:z.enum(['competition','complement','limited-overlap','unclear']),
 yourOffering:text, competitorOffering:text, findingIds:z.array(text).min(1).max(4),
}).strict();
export const assessmentSchema = z.object({
 verdict:z.enum(['recommended','not-recommended','insufficient-evidence']),
 reasoning:z.string().trim().min(1).max(600), findingIds:z.array(text).max(8),
 risks:z.array(z.string().trim().min(1).max(300)).min(1).max(3),
}).strict();
export type BusinessImpact=z.infer<typeof impactSchema>;
export type BusinessAssessment=z.infer<typeof assessmentSchema>;
export const stages = ['planning', 'web', 'insights', 'verification', 'reporting'] as const;
export const stageSchema = z.object({ stage: z.enum(stages), status: z.enum(['running', 'complete', 'partial', 'unavailable', 'skipped']), message: text }).strict();
export type Stage = z.infer<typeof stageSchema>;
export const osmContextSchema = z.object({
  request: requestSchema, fetchedAt: z.iso.datetime({ offset: true }),
  status: z.enum(['complete', 'partial']), directMappedCount: z.number().int().nonnegative().nullable(),
  adjacentMappedCount: z.number().int().nonnegative().nullable(), coverage: z.literal('unknown'),
}).strict();
export const reportSchema = z.object({
  request: researchRequestSchema, status: z.enum(['complete', 'partial', 'unavailable']), startedAt: z.iso.datetime(),
  impacts:z.array(impactSchema).max(3).default([]), assessment:assessmentSchema.nullable().default(null),
  evidence: z.array(evidenceSchema).max(16), findings: z.array(findingSchema).max(24), insights: z.array(insightSchema).max(8),
  stages: z.array(stageSchema).min(5).max(6), warnings: z.array(text).max(50), unknowns: z.array(text).max(20),
  agentRuns: z.array(z.object({ role: z.enum(['researcher', 'extractor', 'analyst', 'verifier', 'writer']), task: text, model: text, status: z.enum(['complete', 'unavailable']), durationMs: z.number().nonnegative(), tools: z.array(text).max(8) }).strict()).max(10).default([]),
  osmContext: osmContextSchema.nullable().default(null),
  shortlist: z.array(shortlistedBusinessSchema).max(5000).default([]),
}).strict().superRefine((r, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
  for (const b of r.shortlist) {
    const meters = distance(r.request.scope.center, b.coordinates);
    if (meters > r.request.scope.radiusMeters || Math.abs(meters - b.distanceMeters) > 0.01 || b.sourceUrl !== `https://www.openstreetmap.org/${b.id}`) issue('Invalid shortlist location or source');
  }
  if (new Set(r.stages.map(s => s.stage)).size !== r.stages.length) issue('Duplicate stage');
  for (const rows of [r.evidence, r.findings, r.insights]) if (new Set(rows.map(x => x.id)).size !== rows.length) issue('Duplicate ID');
  for (const f of r.findings) for (const ref of f.evidence) {
    const source = r.evidence.find(e => e.id === ref.sourceId);
    if (!source || !source.excerpt.includes(ref.quote)) issue('Evidence quote missing from retrieved source');
  }
  for (const i of r.insights) if (i.findingIds.some(id => !r.findings.some(f => f.id === id))) issue('Unknown finding');
  for(const impact of r.impacts){
    if(impact.findingIds.some(id=>!r.findings.some(f=>f.id===id&&f.business===impact.business&&['offering','price'].includes(f.kind))))issue('Impact requires business-specific offering evidence');
    if(!r.request.description.toLowerCase().includes(impact.yourOffering.toLowerCase())||!impact.findingIds.some(id=>r.findings.find(f=>f.id===id)?.evidence.some(e=>e.quote.includes(impact.competitorOffering))))issue('Impact offering text must occur in the request and evidence');
  }
  if(r.assessment){
    if(r.assessment.findingIds.some(id=>!r.findings.some(f=>f.id===id)))issue('Assessment cites an unknown finding');
    if(r.assessment.verdict!=='insufficient-evidence'&&(!r.impacts.length||!r.assessment.findingIds.some(id=>r.impacts.some(i=>i.findingIds.includes(id)))))issue('An opening judgment requires supported business impacts');
  }
  if (r.osmContext) {
    if (!r.request.osmRequest || JSON.stringify(r.osmContext.request) !== JSON.stringify(r.request.osmRequest)) issue('OSM context scope mismatch');
    if (r.osmContext.status === 'partial' && (r.osmContext.directMappedCount !== null || r.osmContext.adjacentMappedCount !== null)) issue('Partial OSM context must not have counts');
  }
  if (r.status === 'complete' && (!r.findings.length || r.stages.some(s => !['complete', 'skipped'].includes(s.status)))) issue('Incomplete report');
});
export type ResearchReport = z.infer<typeof reportSchema>;

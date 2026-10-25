import { z } from 'zod';
import { canonicalize, positionSchema, requestSchema, type AnalysisRequest } from './contracts';
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
 competition: z.number().int().nonnegative().nullable(), complements: z.number().int().nonnegative().nullable(), transit: z.number().int().nonnegative().nullable(),
 score: z.number().min(0).max(100).nullable(),
 sources: z.array(z.object({ id: z.string().regex(/^(node|way|relation)\/\d+$/), name: z.string(), metric: z.enum(metricIds) }).strict()).max(12),
}).strict();
export type AreaCandidate = z.infer<typeof candidateSchema>;
export const locationAdviceSchema = z.object({
 request: locationAdviceRequestSchema, candidates: z.array(candidateSchema).length(1),
 status: z.enum(['provisional', 'insufficient', 'agent-unavailable']),
 recommendation: advisorDecisionSchema.nullable(), model: z.string(), fetchedAt: z.iso.datetime(), osmBaseTimestamp: z.iso.datetime({offset:true}).nullable(),
 query: z.string(), queryHash: z.string().regex(/^[a-f0-9]{64}$/), complementCategories: z.array(z.string()), warnings: z.array(z.string()),
}).strict().superRefine((r,ctx)=>{
 const a=r.candidates[0]; if(!a)return;
 const issue=(message:string)=>ctx.addIssue({code:'custom',message});
 const metrics=[a.competition,a.complements,a.transit];
 if(metrics.some(v=>v===null)&&metrics.some(v=>v!==null))issue('Partial counts must all be unavailable.');
 if(new Set(a.sources.map(s=>s.id)).size!==a.sources.length)issue('Duplicate source example.');
 for(const metric of metricIds)if(a[metric]!==null&&a.sources.filter(s=>s.metric===metric).length>a[metric]!)issue('Source examples exceed mapped count.');
 if(r.recommendation&&(new Set(r.recommendation.priorities).size!==r.recommendation.priorities.length||new Set(r.recommendation.checks).size!==r.recommendation.checks.length))issue('Duplicate assessment priorities or checks.');
 if(r.status==='provisional'&&metrics.reduce<number>((sum,v)=>sum+(v??0),0)<3)issue('Insufficient evidence for assessment.'); const expected=canonicalize(r.request.analysis).scope.center;
 if(a.id!=='current'||a.center.lat!==expected.lat||a.center.lon!==expected.lon||a.score!==null||r.recommendation?.recommendedId)ctx.addIssue({code:'custom',message:'Assessment must describe the selected location without a ranking.'});
 if((r.status==='provisional')!==Boolean(r.recommendation))ctx.addIssue({code:'custom',message:'Reviewed assessments require a decision.'});
 if(r.status==='provisional'&&[a.competition,a.complements,a.transit].some(v=>v===null))ctx.addIssue({code:'custom',message:'Partial evidence cannot support an assessment.'});
});
export type LocationAdvice = z.infer<typeof locationAdviceSchema>;

/** Only the user-selected location is assessed. Never generate shifted pins. */
export function areaCenters(input: AnalysisRequest) {
 const r=canonicalize(input);
 return [{id:'current' as const,label:'Selected location',center:r.scope.center}];
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
/** A single location has no relative score or inferred suitability rating. */
export function scoreAreas(areas: AreaCandidate[], complete: boolean): AreaCandidate[] {
 return areas.map(a=>({...a,score:null,...(!complete?{competition:null,complements:null,transit:null}:{})}));
}

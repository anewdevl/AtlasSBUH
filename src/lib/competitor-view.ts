import type { AnalysisResponse } from './contracts';
export type Competitor = AnalysisResponse['competitors'][number];
export type CompetitorFilters = {query:string;relation:'all'|'direct'|'adjacent';sort:'nearest'|'farthest'};
export const defaultCompetitorFilters:CompetitorFilters={query:'',relation:'all',sort:'nearest'};
export const competitorId=(c:Competitor)=>`${c.sourceType}/${c.sourceId}`;
export function filterCompetitors(competitors:Competitor[],filters:CompetitorFilters):Competitor[]{
 const query=filters.query.normalize('NFKC').trim().toLocaleLowerCase();
 return competitors.filter(c=>(filters.relation==='all'||c.relation===filters.relation)&&(!query||(c.name??'Unnamed mapped feature').normalize('NFKC').toLocaleLowerCase().includes(query)))
  .sort((a,b)=>(filters.sort==='nearest'?1:-1)*(a.distanceMeters-b.distanceMeters)||competitorId(a).localeCompare(competitorId(b)));
}

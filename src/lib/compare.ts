import { responseSchema, type AnalysisResponse } from './contracts';
export function compare(a: unknown, b: unknown): { comparable:false; reason:string } | { comparable:true; a:AnalysisResponse; b:AnalysisResponse; densityDifference:number } {
 const pa=responseSchema.safeParse(a),pb=responseSchema.safeParse(b);
 if(!pa.success || !pb.success) return {comparable:false,reason:'Two valid analyses are required.'};
 const x=pa.data,y=pb.data;
 if(x.status!=='complete'||y.status!=='complete') return {comparable:false,reason:'Partial results cannot be compared.'};
 const signature=(r:AnalysisResponse)=>JSON.stringify([r.request.schemaVersion,r.request.registryVersion,r.request.categoryId,r.request.scope.radiusMeters,r.request.adjacentCategoryIds]);
 if(signature(x)!==signature(y)) return {comparable:false,reason:'Match category, radius, versions, and adjacent categories to compare.'};
 return {comparable:true,a:x,b:y,densityDifference:y.directMappedDensity!-x.directMappedDensity!};
}

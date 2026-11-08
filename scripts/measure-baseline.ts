import { loadEnvConfig } from '@next/env';
import { mkdir, writeFile } from 'node:fs/promises';
import type { AnalysisRequest, AnalysisResponse } from '../src/lib/contracts';
loadEnvConfig(process.cwd());
async function main() {
 // Provider endpoints are resolved at module initialization. Load .env first,
 // as Next.js does, so the reference uses the same configured provider.
 const {research}=await import('../src/server/research');
 const {analyze}=await import('../src/server/analyze');
 const {researchConfig}=await import('../src/server/research-providers');
 const rows=[];
 for(const [cityId,categoryId,description,lat,lon] of [
  ['nyc','cafe','Specialty coffee with fast morning pickup',40.7308,-73.9973],
  ['london','clothing','South Asian clothing boutique',51.5137,-0.1365],
 ] as const){
  const osmRequest:AnalysisRequest={schemaVersion:'1',registryVersion:'2',scope:{cityId,center:{lat,lon},radiusMeters:1000},categoryId,adjacentCategoryIds:[]};
  const calls:object[]=[]; const start=Date.now(); let map:AnalysisResponse|undefined;
  const transport:typeof fetch=async(url,init)=>{
   const t=Date.now();try{const response=await fetch(url,init);let usage:unknown;try{usage=(await response.clone().json()).usage;}catch{}calls.push({provider:new URL(String(url)).host,durationMs:Date.now()-t,status:response.status,...(usage?{usage}:{})});return response;}catch(e){calls.push({provider:new URL(String(url)).host,durationMs:Date.now()-t,failure:e instanceof Error?e.name:'error'});throw e;}
  };
  try{map=await analyze(osmRequest,{transport});}catch{ /* record unavailable without fabricating map data */ }
  const mappingDurationMs=Date.now()-start;
  const researchStart=Date.now();
  const report=await research({description,scope:osmRequest.scope,osmRequest,localOnly:true},{config:researchConfig(),osmLookup:async()=>map,transport});
  rows.push({description,cityId,durationMs:Date.now()-start,mappingDurationMs,researchDurationMs:Date.now()-researchStart,mapStatus:map?.status,mapCache:map?.provenance.cacheState,calls,report});
 }
 await mkdir('docs/measurements',{recursive:true});
 const artifact={measuredAt:new Date().toISOString(),rows};
 await mkdir('.atlas-local',{recursive:true});
 await writeFile('.atlas-local/baseline-full.json',JSON.stringify(artifact,null,2));
 await writeFile('docs/measurements/baseline.json',JSON.stringify({...artifact,rows:rows.map(r=>({...r,shortlistTotal:r.report.shortlist.length,report:{...r.report,shortlist:r.report.shortlist.slice(0,10)}})),recordingNote:'Shortlist limited to first ten entries for review. Original counts, sources, findings and available call metrics retained; full artifact is in ignored .atlas-local/baseline-full.json.'},null,2));
 console.log(rows.map(r=>({description:r.description,durationMs:r.durationMs,calls:r.calls.length,status:r.report.status,findings:r.report.findings.length,warnings:r.report.warnings})));
}
main().catch(e=>{console.error(e.name);process.exitCode=1;});

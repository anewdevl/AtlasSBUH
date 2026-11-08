import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { responseSchema, type AnalysisRequest } from '../src/lib/contracts';
import { reportSchema, stageSchema } from '../src/lib/research-contracts';
import { locationAdviceSchema } from '../src/lib/location-advisor';
import { categorySuggestionSchema } from '../src/lib/category-suggestion';
const origin=process.argv[2] || 'http://127.0.0.1:3001';
async function main(){
 const measurementStart=Date.now();
 const rows=[];
 for(const [cityId,categoryId,description,lat,lon] of [
  ['nyc','cafe','Specialty coffee with fast morning pickup',40.7308,-73.9973],
  ['london','clothing','South Asian clothing boutique',51.5137,-0.1365],
 ] as const){
  const osmRequest:AnalysisRequest={schemaVersion:'1',registryVersion:'2',scope:{cityId,center:{lat,lon},radiusMeters:1000},categoryId,adjacentCategoryIds:[]};
  const started=Date.now();
  const map=await fetch(`${origin}/api/analyze`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(osmRequest)});
  const mapBody=await map.json();if(map.ok)responseSchema.parse(mapBody);
  if(map.headers.get('x-atlas-backend')!=='python')throw Error('Frontend did not reach Python');
  const researchStart=Date.now();
  const response=await fetch(`${origin}/api/research`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({description,scope:osmRequest.scope,osmRequest,localOnly:true}),signal:AbortSignal.timeout(115000)});
  const events=(await response.text()).trim().split('\n').map(line=>JSON.parse(line));
  for(const event of events)if(event.type==='stage')stageSchema.parse(event.stage);
  const report=reportSchema.parse(events.find(e=>e.type==='report')?.report);
  const row={description,cityId,durationMs:Date.now()-started,researchDurationMs:Date.now()-researchStart,mapStatus:map.status,map:mapBody,report};rows.push(row);
  console.log({description,durationMs:row.durationMs,researchMs:row.researchDurationMs,status:report.status,findings:report.findings.length,impacts:report.impacts.length,warnings:report.warnings});
 }
 const post=async(route:string,body:unknown)=>{const r=await fetch(`${origin}/api/${route}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {httpStatus:r.status,body:await r.json()};};
 const suggestion=await post('suggest',{description:'Coffee shop'});if(suggestion.httpStatus===200)categorySuggestionSchema.parse(suggestion.body);
 const locations=await fetch(`${origin}/api/locations?q=Washington%20Square&city=nyc`).then(async r=>({httpStatus:r.status,body:await r.json()}));
 const advice=await post('location-advice',{analysis:rows[0].report.request.osmRequest,description:rows[0].description});if(advice.httpStatus===200)locationAdviceSchema.parse(advice.body);
 await mkdir('docs/measurements',{recursive:true});
 const metrics=(await readFile('.atlas-local/metrics.jsonl','utf8')).trim().split('\n').map(line=>JSON.parse(line)).filter(r=>Date.parse(r.startedAt)>=measurementStart&&['research','analysis','suggestion','location-search','location-advice'].includes(r.kind));
 const artifact={measuredAt:new Date().toISOString(),origin,rows,suggestion,locations,advice,metrics};
 await writeFile('.atlas-local/python-live-full.json',JSON.stringify(artifact,null,2));
 const recorded=rows.map(({map,...row})=>({...row,mapSummary:{request:map.request,status:map.status,competitorCount:map.competitors?.length,directMappedCount:map.directMappedCount,adjacentMappedCount:map.adjacentMappedCount,provenance:map.provenance},shortlistTotal:row.report.shortlist.length,report:{...row.report,shortlist:row.report.shortlist.slice(0,10)}}));
 await writeFile('docs/measurements/python-live.json',JSON.stringify({...artifact,rows:recorded,recordingNote:'Map records omitted and shortlist limited to the first ten entries for review. Original aggregates, source excerpts, findings and metrics retained; full live artifact is in ignored .atlas-local/python-live-full.json.'},null,2));
 await writeFile('.atlas-local/live-report.json',JSON.stringify(rows[0].report));
}
main().catch(e=>{console.error(e);process.exitCode=1;});

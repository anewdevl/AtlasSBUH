import {responseSchema} from '../src/lib/contracts';
const origin=process.argv[2] || 'http://127.0.0.1:3300';
async function main(){
 const page=await fetch(origin,{signal:AbortSignal.timeout(30000)});
 if(!page.ok||!(await page.text()).includes('ATLAS'))throw Error('ATLAS page unavailable');
 const checks:object[]=[{route:'/',status:page.status}];
 const analysis=await fetch(`${origin}/api/analyze`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({schemaVersion:'1',registryVersion:'2',scope:{cityId:'nyc',center:{lat:40.7308,lon:-73.9973},radiusMeters:1000},categoryId:'cafe',adjacentCategoryIds:[]}),signal:AbortSignal.timeout(40000)});
 const body=await analysis.json();
 if(!analysis.ok)throw Error(`Map endpoint returned ${analysis.status}: ${body.code}`);
 responseSchema.parse(body);
 if(analysis.headers.get('x-atlas-backend')==='python')throw Error('Deployment unexpectedly uses Python');
 checks.push({route:'/api/analyze',status:analysis.status,mappedCount:body.directMappedCount,cache:body.provenance.cacheState});
 for(const route of ['suggest','research','location-advice']){
  const response=await fetch(`${origin}/api/${route}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({description:'x'}),signal:AbortSignal.timeout(10000)});
  if(response.status!==400)throw Error(`${route}: expected TypeScript validation response, received ${response.status}`);
  checks.push({route:`/api/${route}`,status:response.status});
 }
 const locations=await fetch(`${origin}/api/locations?q=a&city=nyc`,{signal:AbortSignal.timeout(10000)});
 if(locations.status!==400)throw Error(`locations: expected validation response, received ${locations.status}`);
 checks.push({route:'/api/locations',status:locations.status});
 console.log(JSON.stringify({origin,backend:'typescript',checks},null,2));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});

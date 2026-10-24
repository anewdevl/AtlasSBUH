import { mkdir,writeFile } from 'node:fs/promises';
import { cities,type CityId } from '../src/lib/cities';
import { SCHEMA_VERSION,type AnalysisRequest } from '../src/lib/contracts';
import { REGISTRY_VERSION } from '../src/lib/categories';
import { fetchOverpass } from '../src/server/overpass';
import { normalize } from '../src/server/normalize';
import { integrityHash } from '../src/server/cache';
async function main(){
 await mkdir('data/snapshots',{recursive:true});let failures=0;
 for(const cityId of Object.keys(cities) as CityId[]){
  const request:AnalysisRequest={schemaVersion:SCHEMA_VERSION,registryVersion:REGISTRY_VERSION,scope:{cityId,center:cities[cityId].center,radiusMeters:1000},categoryId:'cafe',adjacentCategoryIds:[]};
  try{const response=normalize(request,await fetchOverpass(request));if(response.status!=='complete')throw new Error('Partial capture rejected');
   await writeFile(`data/snapshots/${cityId}-cafe-1000.json`,JSON.stringify({fileIntegrityHash:integrityHash(response),response},null,2)+'\n');
   console.log(cityId,response.directMappedCount,response.provenance.fetchedAt,response.competitors.slice(0,3).map(c=>({name:c.name,url:c.sourceUrl,evidence:c.evidence})));
  }catch(e){failures++;console.error(cityId,e instanceof Error?e.message:e);}
  await new Promise(resolve=>setTimeout(resolve,5000));
 }
 if(failures)process.exitCode=1;
}
void main();

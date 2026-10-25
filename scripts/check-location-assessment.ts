import {loadEnvConfig} from '@next/env';
loadEnvConfig(process.cwd());
async function main(){
 const {adviseLocation}=await import('../src/server/location-advisor');
 const result=await adviseLocation({description:'A neighborhood supermarket',analysis:{schemaVersion:'1',registryVersion:'2',scope:{cityId:'nyc',center:{lat:40.7308,lon:-73.9973},radiusMeters:1000},categoryId:'supermarket',adjacentCategoryIds:[]}});
 console.log(JSON.stringify({status:result.status,center:result.candidates[0].center,mappedCompetitors:result.candidates[0].competition,potentialComplements:result.candidates[0].complements,transitFeatures:result.candidates[0].transit,assessment:result.recommendation,fetchedAt:result.fetchedAt,sourceExamples:result.candidates[0].sources.length,warnings:result.warnings}));
}
main().catch(()=>{console.error('Selected-location live check unavailable. No secrets or provider bodies printed.');process.exitCode=1;});

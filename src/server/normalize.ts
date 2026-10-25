import { z } from 'zod';
import { matchingEvidence } from '../lib/categories';
import { distance } from '../lib/cities';
import { extractDetails } from '../lib/details';
import { canonicalize, positionSchema, responseSchema, type AnalysisRequest, type AnalysisResponse } from '../lib/contracts';
import { ENDPOINT, MAX_RECORDS } from './overpass';
const elementSchema=z.object({type:z.enum(['node','way','relation']),id:z.number().int().positive().max(Number.MAX_SAFE_INTEGER),lat:z.number().optional(),lon:z.number().optional(),center:positionSchema.optional(),tags:z.record(z.string(),z.string()).optional()}).passthrough();
export function normalize(input:AnalysisRequest, raw:{elements:unknown[];fetchedAt:string;osmBaseTimestamp:string|null;queryHash:string}):AnalysisResponse {
 const request=canonicalize(input),competitors:AnalysisResponse['competitors']=[],seen=new Set<string>();let excluded=0,invalid=0;
 const truncated=raw.elements.length>MAX_RECORDS;
 for(const item of raw.elements.slice(0,MAX_RECORDS)) {
  const parsed=elementSchema.safeParse(item);if(!parsed.success){excluded++;invalid++;continue;}
  const e=parsed.data,key=`${e.type}/${e.id}`;
  if(seen.has(key)){excluded++;continue;}seen.add(key);
  const tags=e.tags??{}, ids=[request.categoryId,...request.adjacentCategoryIds];
  const categoryId=ids.find(id=>matchingEvidence(id,tags));
  if(!categoryId){excluded++;continue;}
  const p=positionSchema.safeParse(e.type==='node'?{lat:e.lat,lon:e.lon}:e.center);
  if(!p.success){excluded++;invalid++;continue;}
  const details=extractDetails(tags);const d=distance(request.scope.center,p.data);if(d>request.scope.radiusMeters){excluded++;continue;}
  competitors.push({sourceType:e.type,sourceId:e.id,sourceUrl:`https://www.openstreetmap.org/${key}`,name:tags.name?.trim().slice(0,500)||null,coordinates:p.data,positionKind:e.type==='node'?'node':'representative-center',categoryId,relation:categoryId===request.categoryId?'direct':'adjacent',evidence:matchingEvidence(categoryId,tags)!,distanceMeters:d,...(details?{details}:{})});
 }
 competitors.sort((a,b)=>a.distanceMeters-b.distanceMeters || a.sourceId-b.sourceId);
 const partial=truncated||invalid>0,direct=competitors.filter(c=>c.relation==='direct').length;
 return responseSchema.parse({request,status:partial?'partial':'complete',truncated,competitors,directMappedCount:partial?null:direct,adjacentMappedCount:partial?null:competitors.length-direct,directMappedDensity:partial?null:direct/(Math.PI*(request.scope.radiusMeters/1000)**2),provenance:{provider:'OpenStreetMap / Overpass',fetchedAt:raw.fetchedAt,osmBaseTimestamp:raw.osmBaseTimestamp,upstreamEndpoint:ENDPOINT,queryHash:raw.queryHash,cacheState:'live',attribution:'© OpenStreetMap contributors',licenseLink:'https://www.openstreetmap.org/copyright',coverage:'unknown',excludedRecordCount:excluded},warnings:[...(truncated?['Upstream record limit reached. Results are partial; aggregates are unavailable.']:[]),...(invalid?['Invalid upstream records or positions were excluded. Results are partial.']:[]),'Coverage is unknown. Counts describe mapped features, not all businesses. Distinct OSM objects may represent the same business.','Way and relation centers are representative positions, not guaranteed entrances.']});
}
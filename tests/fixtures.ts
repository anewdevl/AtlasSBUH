// Synthetic upstream records for automated tests only. Never used by the application.
import { type AnalysisRequest } from '../src/lib/contracts';
import { REGISTRY_VERSION } from '../src/lib/categories';
import { buildQuery,hashQuery } from '../src/server/overpass';
import { normalize } from '../src/server/normalize';
export const request:AnalysisRequest={schemaVersion:'1',registryVersion:REGISTRY_VERSION,scope:{cityId:'nyc',center:{lat:40.7308,lon:-73.9973},radiusMeters:1000},categoryId:'cafe',adjacentCategoryIds:[]};
export const node={type:'node',id:123,lat:40.7308,lon:-73.9973,tags:{amenity:'cafe',name:'Synthetic test café'}};
export const raw=(elements:unknown[]=[node],r=request)=>({elements,fetchedAt:new Date().toISOString(),osmBaseTimestamp:null,queryHash:hashQuery(buildQuery(r))});
export const result=(elements:unknown[]=[node],r=request)=>normalize(r,raw(elements,r));
export const upstream=(elements:unknown[]=[node])=>new Response(JSON.stringify({elements,osm3s:{timestamp_osm_base:new Date().toISOString()}}));

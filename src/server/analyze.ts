import { canonicalize, validateResponse, type AnalysisRequest, type AnalysisResponse } from '../lib/contracts';
import { age,FRESH_MS,STALE_MS,MemoryCache,runtimeCache,readSnapshot } from './cache';
import { fetchOverpass, UpstreamError, hashQuery, buildQuery } from './overpass';
import { normalize } from './normalize';
export class AnalysisUnavailable extends Error {constructor(message:string,public retryAfterSeconds?:number){super(message);}}
type Options={cache?:MemoryCache;snapshot?:(r:AnalysisRequest)=>Promise<AnalysisResponse|undefined>;transport?:typeof fetch;now?:number};
let upstreamCooldownUntil=0;
let activeUpstream=0;
export async function analyze(input:AnalysisRequest,options:Options={}) {
 const request=canonicalize(input),cache=options.cache??runtimeCache,now=options.now??Date.now();
 const compatible=(r:AnalysisResponse|undefined)=>{try{if(!r)return;const valid=validateResponse(r,request);if(valid.provenance.queryHash!==hashQuery(buildQuery(request)))return;return valid;}catch{return;}};
 const runtime=compatible(cache.get(request));
 const serve=(r:AnalysisResponse,state:AnalysisResponse['provenance']['cacheState'])=>validateResponse({...r,provenance:{...r.provenance,cacheState:state},warnings:[...r.warnings,...(state.endsWith('stale')?['Live retrieval failed. Showing an exact stale fallback; check its original retrieval date.']:[])]},request);
 if(runtime&&age(runtime,now)<=FRESH_MS)return serve(runtime,'runtime-fresh');
 const snapshot=compatible(await(options.snapshot??readSnapshot)(request));
 if(snapshot&&age(snapshot,now)<=FRESH_MS)return serve(snapshot,'snapshot-fresh');
 try {
  if(!options.transport&&Date.now()<upstreamCooldownUntil)throw new UpstreamError('Upstream cooldown',Math.ceil((upstreamCooldownUntil-Date.now())/1000));
  if(!options.transport&&activeUpstream>=2)throw new UpstreamError('Local upstream capacity reached',5);
  if(!options.transport)activeUpstream++;
  try{const result=normalize(request,await fetchOverpass(request,options.transport));cache.set(result);return result;}
  finally{if(!options.transport)activeUpstream--;}
 }catch(error){
  const retry=error instanceof UpstreamError?error.retryAfterSeconds:undefined;
  if(!options.transport)upstreamCooldownUntil=Math.max(upstreamCooldownUntil,Date.now()+(retry??10)*1000);
  const fallback=[{value:runtime,state:'runtime-stale' as const},{value:snapshot,state:'snapshot-stale' as const}].filter(x=>x.value&&age(x.value,now)<=STALE_MS).sort((a,b)=>Date.parse(b.value!.provenance.fetchedAt)-Date.parse(a.value!.provenance.fetchedAt))[0];
  if(fallback)return serve(fallback.value!,fallback.state);
  const upstreamMessage=error instanceof UpstreamError
   ? `The OpenStreetMap provider returned ${error.message.toLowerCase()}.`
   : error instanceof Error&&error.name==='AbortError'
    ? 'The OpenStreetMap provider did not respond before the 25-second timeout.'
    : 'Could not connect to the OpenStreetMap provider. Check the server network or choose another supported endpoint.';
  throw new AnalysisUnavailable(`${upstreamMessage} No compatible saved data exists for this exact area yet.`,retry??10);
 }
}

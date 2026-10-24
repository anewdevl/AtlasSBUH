import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { cacheKey, validateResponse, type AnalysisRequest, type AnalysisResponse } from '../lib/contracts';
export const FRESH_MS=24*60*60*1000,STALE_MS=30*FRESH_MS;
export const integrityHash=(response:unknown)=>createHash('sha256').update(JSON.stringify(response)).digest('hex');
export class MemoryCache {
 private entries=new Map<string,AnalysisResponse>();
 get(request:AnalysisRequest){return this.entries.get(cacheKey(request));}
 set(response:AnalysisResponse){if(this.entries.size>=100)this.entries.delete(this.entries.keys().next().value!);this.entries.set(cacheKey(response.request),response);}
}
export const runtimeCache=new MemoryCache();
export function age(response:AnalysisResponse,now=Date.now()){return Math.max(0,now-Date.parse(response.provenance.fetchedAt));}
export async function readSnapshot(request:AnalysisRequest):Promise<AnalysisResponse|undefined> {
 const dir=path.join(process.cwd(),'data','snapshots');
 let files:string[];try{files=await readdir(dir);}catch{return undefined;}
 const candidates:AnalysisResponse[]=[];
 for(const file of files.filter(f=>f.endsWith('.json'))){try{
  const wrapper=JSON.parse(await readFile(path.join(dir,file),'utf8'));
  if(wrapper.fileIntegrityHash!==integrityHash(wrapper.response))continue;
  candidates.push(validateResponse(wrapper.response,request));
 }catch{/* A corrupt or incompatible snapshot is never a fallback. */}}
 return candidates.sort((a,b)=>Date.parse(b.provenance.fetchedAt)-Date.parse(a.provenance.fetchedAt))[0];
}

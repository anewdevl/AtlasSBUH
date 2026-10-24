import { createHash } from 'node:crypto';
import { z } from 'zod';
import { categories } from '../lib/categories';
import { canonicalize, type AnalysisRequest } from '../lib/contracts';
import { OVERPASS_ENDPOINT } from '../lib/providers';
export const ENDPOINT = OVERPASS_ENDPOINT;
export const MAX_RECORDS = 5000;
const MAX_BYTES = 8 * 1024 * 1024;
export class UpstreamError extends Error { constructor(message:string, public retryAfterSeconds?:number) { super(message); } }
export function buildQuery(input:AnalysisRequest) {
 const r=canonicalize(input),{center,radiusMeters}=r.scope;
 const selectors=[r.categoryId,...r.adjacentCategoryIds].flatMap(id=>categories[id].predicates);
 return `[out:json][timeout:20][maxsize:16777216];(${selectors.map(p=>`nwr${p}(around:${radiusMeters},${center.lat},${center.lon});`).join('')});out center ${MAX_RECORDS+1};`;
}
export const hashQuery=(query:string)=>createHash('sha256').update(query).digest('hex');
const envelope=z.object({elements:z.array(z.unknown()),osm3s:z.object({timestamp_osm_base:z.string().optional()}).passthrough().optional(),remark:z.string().optional()}).passthrough();
export async function fetchOverpass(request:AnalysisRequest, transport:typeof fetch=fetch) {
 const query=buildQuery(request), controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),25000);
 try {
  const response=await transport(ENDPOINT,{method:'POST',body:new URLSearchParams({data:query}),headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'ATLAS/0.1 (OpenStreetMap neighborhood analysis)'},signal:controller.signal,cache:'no-store'});
  if(!response.ok) {
   const retry=response.headers.get('Retry-After');
   const seconds=retry ? (/^\d+$/.test(retry)?Number(retry):Math.ceil((Date.parse(retry)-Date.now())/1000)) : undefined;
   throw new UpstreamError(`Upstream HTTP ${response.status}`,Number.isFinite(seconds)?Math.max(1,seconds!):undefined);
  }
  if(Number(response.headers.get('Content-Length'))>MAX_BYTES) throw new UpstreamError('Upstream payload too large');
  if(!response.body) throw new UpstreamError('Missing upstream body');
  const reader=response.body.getReader(),decoder=new TextDecoder();let size=0,text='';
  try { while(true) { const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>MAX_BYTES)throw new UpstreamError('Upstream payload too large');text+=decoder.decode(part.value,{stream:true}); } text+=decoder.decode(); }
  finally { await reader.cancel(); }
  const data=envelope.parse(JSON.parse(text));
  if(data.remark)throw new UpstreamError('Overpass runtime error');
  return {elements:data.elements,osmBaseTimestamp:data.osm3s?.timestamp_osm_base??null,fetchedAt:new Date().toISOString(),queryHash:hashQuery(query)};
 } finally { clearTimeout(timer); }
}

import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import {z} from 'zod';
import {cities,distance} from '../lib/cities';
import {placesRequestSchema,placesResponseSchema,type PlacesRequest} from '../lib/places';
export class PlacesUnavailable extends Error{
 constructor(public code:string,public status=503,public retryAfterSeconds?:number){super(code);}
}
const ledgerSchema=z.object({day:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),used:z.number().int().min(0).max(10000)}).strict();
let pending=Promise.resolve();
export async function reservePlacesRequest(limit:number,now=Date.now(),file=path.join(process.cwd(),'.atlas-local','places-budget.json')){
 const before=pending;let release!:()=>void;pending=new Promise<void>(resolve=>release=resolve);await before;
 try{
  const day=new Date(now).toISOString().slice(0,10);let used=0;
  try{const prior=ledgerSchema.parse(JSON.parse(await readFile(/* turbopackIgnore: true */ file,'utf8')));if(prior.day===day)used=prior.used;else if(prior.day>day)throw new Error('Budget date is ahead.');}
  catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw new PlacesUnavailable('BUDGET_UNAVAILABLE');}
  if(used>=limit)throw new PlacesUnavailable('LOCAL_LIMIT',429,Math.max(1,Math.ceil((Date.parse(`${day}T00:00:00Z`)+86400000-now)/1000)));
  await mkdir(path.dirname(file),{recursive:true});const temporary=`${file}.${process.pid}.tmp`;
  await writeFile(temporary,JSON.stringify({day,used:used+1}),'utf8');await rename(temporary,file);
  return limit-used-1;
 }finally{release();}
}
export function placesDailyLimit(value=process.env.ATLAS_PLACES_DAILY_LIMIT){const n=Number(value??5);return Number.isInteger(n)&&n>=1&&n<=20?n:5;}
export const PLACES_FIELDS='places.id,places.displayName,places.formattedAddress,places.businessStatus,places.primaryType,places.location,places.googleMapsUri,places.attributions';
const rawPlace=z.object({id:z.string().min(1).max(300),displayName:z.object({text:z.string().min(1).max(500)}),formattedAddress:z.string().max(1500).optional(),businessStatus:z.string().max(80).optional(),primaryType:z.string().max(120).optional(),location:z.object({latitude:z.number().min(-90).max(90),longitude:z.number().min(-180).max(180)}),googleMapsUri:z.string().optional(),attributions:z.array(z.object({displayName:z.string().max(500).optional(),uri:z.string().optional()})).max(20).default([])});
const payloadSchema=z.object({places:z.array(rawPlace).max(3).default([])});
function safeHttps(value:string|undefined){if(!value)return null;try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}}
export async function lookupPlaces(raw:PlacesRequest,options:{key?:string;transport?:typeof fetch;signal?:AbortSignal;reserve?:(limit:number)=>Promise<number>;limit?:number}={}){
 const input=placesRequestSchema.parse(raw),key=options.key??process.env.GOOGLE_PLACES_API_KEY;
 if(!key?.trim())throw new PlacesUnavailable('NOT_CONFIGURED');
 options.signal?.throwIfAborted();
 const remainingRequests=await(options.reserve??reservePlacesRequest)(options.limit??placesDailyLimit());
 const signal=AbortSignal.any([options.signal??new AbortController().signal,AbortSignal.timeout(8000)]);
 const response=await(options.transport??fetch)('https://places.googleapis.com/v1/places:searchText',{method:'POST',redirect:'error',cache:'no-store',signal,headers:{'Content-Type':'application/json','X-Goog-Api-Key':key,'X-Goog-FieldMask':PLACES_FIELDS},body:JSON.stringify({textQuery:`${input.name} ${cities[input.analysis.scope.cityId].label}`,pageSize:3,languageCode:'en',locationBias:{circle:{center:{latitude:input.coordinates.lat,longitude:input.coordinates.lon},radius:500}}})});
 if(!response.ok){
  const retry=response.headers.get('retry-after'),seconds=retry&&/^\d+$/.test(retry)?Number(retry):retry?Math.ceil((Date.parse(retry)-Date.now())/1000):undefined;
  if(response.status===429)throw new PlacesUnavailable('DEMO_QUOTA',429,Math.max(60,Math.min(86400,seconds&&Number.isFinite(seconds)?seconds:3600)));
  if([401,403].includes(response.status))throw new PlacesUnavailable('ACCESS_UNAVAILABLE');
  throw new PlacesUnavailable('PROVIDER_UNAVAILABLE');
 }
 if(!response.body)throw new PlacesUnavailable('INVALID_PROVIDER_RESPONSE');
 const reader=response.body.getReader(),decoder=new TextDecoder();let text='',size=0;
 try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>256000)throw new PlacesUnavailable('INVALID_PROVIDER_RESPONSE');text+=decoder.decode(part.value,{stream:true});}text+=decoder.decode();}finally{await reader.cancel();}
 const data=payloadSchema.parse(JSON.parse(text)),ids=new Set<string>();
 const matches=data.places.flatMap(p=>{
  const location={lat:p.location.latitude,lon:p.location.longitude};if(distance(input.coordinates,location)>500||ids.has(p.id))return [];ids.add(p.id);
  const uri=safeHttps(p.googleMapsUri);let mapsUrl:string;
  if(uri&&(new URL(uri).hostname==='maps.google.com'||new URL(uri).hostname==='www.google.com'&&new URL(uri).pathname.startsWith('/maps')))mapsUrl=uri;
  else mapsUrl=`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.displayName.text)}&query_place_id=${encodeURIComponent(p.id)}`;
  return [{id:p.id,name:p.displayName.text,address:p.formattedAddress??null,businessStatus:p.businessStatus??null,primaryType:p.primaryType??null,mapsUrl,attributions:p.attributions.map(a=>({name:a.displayName??'Data provider',uri:safeHttps(a.uri)}))}];
 });
 return placesResponseSchema.parse({request:input,provider:'Google Maps',fetchedAt:new Date().toISOString(),remainingRequests,matches});
}

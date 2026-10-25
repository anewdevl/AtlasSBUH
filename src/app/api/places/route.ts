import {placesRequestSchema} from '../../../lib/places';
import {lookupPlaces,PlacesUnavailable} from '../../../server/places';
export const runtime='nodejs';
export const maxDuration=15;
let active=false,cooldownUntil=0;
const messages:Record<string,string>={INVALID_REQUEST:'Select a named mapped competitor from a valid analysis.',LOOKUP_PAUSED:'Optional lookups are paused briefly to protect the demo quota. Core analysis still works.',NOT_CONFIGURED:'Optional Google Places is not configured yet. Add GOOGLE_PLACES_API_KEY to .env and restart.',LOCAL_LIMIT:'The local Google Places budget is used for today. Core analysis and research still work.',DEMO_QUOTA:'Google demo quota is unavailable. Optional lookups are paused; core analysis still works.',ACCESS_UNAVAILABLE:'The demo key could not access Places API (New). Check the key and its restrictions.',BUDGET_UNAVAILABLE:'The local request-budget file is unavailable. Optional lookup was not sent.'};
function error(status:number,code:string,retryAfterSeconds?:number){return Response.json({code,message:messages[code]??'Optional Google place information is unavailable. Your mapped analysis is unchanged.',...(retryAfterSeconds?{retryAfterSeconds}:{})},{status,headers:{'Cache-Control':'no-store',...(retryAfterSeconds?{'Retry-After':String(retryAfterSeconds)}:{})}});}
export async function POST(request:Request){
 let raw:unknown;
 try{
  const reader=request.body?.getReader();if(!reader)return error(400,'INVALID_REQUEST');let text='',bytes=0;const decoder=new TextDecoder();
  try{while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.length;if(bytes>8192)return error(413,'INVALID_REQUEST');text+=decoder.decode(part.value,{stream:true});}text+=decoder.decode();}finally{await reader.cancel();}raw=JSON.parse(text);
 }catch{return error(400,'INVALID_REQUEST');}
 const parsed=placesRequestSchema.safeParse(raw);if(!parsed.success)return error(422,'INVALID_REQUEST');
 if(active||Date.now()<cooldownUntil)return error(429,'LOOKUP_PAUSED',Math.max(1,Math.ceil((cooldownUntil-Date.now())/1000)));
 active=true;
 try{const data=await lookupPlaces(parsed.data,{signal:request.signal});cooldownUntil=Date.now()+5000;return Response.json(data,{headers:{'Cache-Control':'no-store'}});}
 catch(e){if(e instanceof PlacesUnavailable){if(e.code==='DEMO_QUOTA')cooldownUntil=Date.now()+(e.retryAfterSeconds??3600)*1000;else if(e.code==='ACCESS_UNAVAILABLE')cooldownUntil=Date.now()+600000;return error(e.status,e.code,e.retryAfterSeconds);}return error(503,'UNAVAILABLE');}
 finally{active=false;}
}

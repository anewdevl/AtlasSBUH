import { requestSchema,requestShape } from '../../../lib/contracts';
import { analyze,AnalysisUnavailable } from '../../../server/analyze';
export const runtime='nodejs';
export const maxDuration=60;
const buckets=new Map<string,{count:number;until:number}>();
const error=(status:number,code:string,message:string,retryAfterSeconds?:number)=>Response.json({code,message,...(retryAfterSeconds?{retryAfterSeconds}:{})},{status,headers:{'Cache-Control':'no-store',...(retryAfterSeconds?{'Retry-After':String(retryAfterSeconds)}:{})}});
export async function POST(request:Request){
 const now=Date.now(),ip=request.headers.get('x-forwarded-for')?.split(',')[0].trim()??'local';
 for(const [key,b] of buckets)if(b.until<=now)buckets.delete(key);
 if(buckets.size>=10000&&!buckets.has(ip))return error(429,'RATE_LIMIT','Local request capacity reached.',60);
 const bucket=buckets.get(ip)??{count:0,until:now+60000};bucket.count++;buckets.set(ip,bucket);
 if(bucket.count>12)return error(429,'RATE_LIMIT','Please wait before starting another analysis.',Math.max(1,Math.ceil((bucket.until-now)/1000)));
 let body:unknown;
 try{
  if(Number(request.headers.get('content-length'))>8192)return error(400,'INVALID_REQUEST','Request too large.');
  const reader=request.body?.getReader();if(!reader)return error(400,'INVALID_REQUEST','JSON body required.');
  const decoder=new TextDecoder();let text='',bytes=0;
  try{while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.length;if(bytes>8192)return error(400,'INVALID_REQUEST','Request too large.');text+=decoder.decode(part.value,{stream:true});}text+=decoder.decode();}finally{await reader.cancel();}
  body=JSON.parse(text);
 }catch{return error(400,'INVALID_REQUEST','Valid JSON required.');}
 if(!requestShape.safeParse(body).success)return error(400,'INVALID_REQUEST','Malformed analysis request.');
 const parsed=requestSchema.safeParse(body);
 if(!parsed.success)return error(422,'UNSUPPORTED_REQUEST','Unsupported category, version, radius, adjacent setting, or city scope.');
 try{return Response.json(await analyze(parsed.data),{headers:{'Cache-Control':'no-store'}});}catch(e){return error(503,'UNAVAILABLE',e instanceof AnalysisUnavailable?e.message:'Analysis failed while validating the live provider response.',e instanceof AnalysisUnavailable?e.retryAfterSeconds:undefined);}
}

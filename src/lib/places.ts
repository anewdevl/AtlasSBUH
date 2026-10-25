import {z} from 'zod';
import {requestSchema,positionSchema} from './contracts';
import {distance} from './cities';
export const placesRequestSchema=z.object({analysis:requestSchema,sourceId:z.string().regex(/^(node|way|relation)\/[1-9]\d*$/),name:z.string().trim().min(1).max(500),coordinates:positionSchema}).strict().superRefine((r,ctx)=>{
 if(distance(r.analysis.scope.center,r.coordinates)>r.analysis.scope.radiusMeters)ctx.addIssue({code:'custom',message:'Selected feature must belong to the analysis scope.'});
});
export type PlacesRequest=z.infer<typeof placesRequestSchema>;
const httpsUrl=z.url().max(2000).refine(value=>{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password;});
export const placesResponseSchema=z.object({request:placesRequestSchema,provider:z.literal('Google Maps'),fetchedAt:z.iso.datetime(),remainingRequests:z.number().int().min(0).max(20),matches:z.array(z.object({id:z.string().min(1).max(300),name:z.string().min(1).max(500),address:z.string().max(1500).nullable(),businessStatus:z.string().max(80).nullable(),primaryType:z.string().max(120).nullable(),mapsUrl:httpsUrl,attributions:z.array(z.object({name:z.string().max(500),uri:httpsUrl.nullable()}).strict()).max(20)}).strict()).max(3)}).strict();
export type PlacesResponse=z.infer<typeof placesResponseSchema>;

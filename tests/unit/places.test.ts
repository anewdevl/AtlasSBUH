import {describe,it,expect,vi} from 'vitest';
import {mkdtemp,readFile,writeFile,unlink,rmdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {lookupPlaces,PLACES_FIELDS,placesDailyLimit,reservePlacesRequest} from '../../src/server/places';
import {placesRequestSchema} from '../../src/lib/places';
import {request} from '../fixtures';
const input={analysis:request,sourceId:'node/123',name:'Synthetic café',coordinates:request.scope.center};
const rawPlace={id:'ChIJfixture',displayName:{text:'Synthetic café'},formattedAddress:'Synthetic address',businessStatus:'OPERATIONAL',primaryType:'cafe',location:{latitude:request.scope.center.lat,longitude:request.scope.center.lon},googleMapsUri:'https://maps.google.com/?cid=123',attributions:[{displayName:'Synthetic provider',uri:'https://fixture.example/source'}]};
describe('Optional Google Places',()=>{
 it('makes one bounded request with basic fields and no reviews, photos, pagination or key in results',async()=>{
  const reserve=vi.fn(async()=>4),transport=vi.fn<typeof fetch>(async()=>new Response(JSON.stringify({places:[rawPlace]})));
  const result=await lookupPlaces(input,{key:'secret-test-key',reserve,transport});expect(reserve).toHaveBeenCalledTimes(1);expect(transport).toHaveBeenCalledTimes(1);
  const [url,init]=transport.mock.calls[0];expect(url).toBe('https://places.googleapis.com/v1/places:searchText');expect(new Headers(init?.headers).get('X-Goog-FieldMask')).toBe(PLACES_FIELDS);expect(PLACES_FIELDS).not.toMatch(/reviews|photos|rating|website|\*/);expect(JSON.parse(String(init?.body))).toMatchObject({pageSize:3});expect(JSON.parse(String(init?.body))).not.toHaveProperty('pageToken');expect(result.matches[0].name).toBe('Synthetic café');expect(result.remainingRequests).toBe(4);expect(JSON.stringify(result)).not.toContain('secret-test-key');
 });
 it('does not consume requests for missing configuration or an invalid scope',async()=>{
  const reserve=vi.fn(async()=>4),transport=vi.fn<typeof fetch>();await expect(lookupPlaces(input,{key:'',reserve,transport})).rejects.toMatchObject({code:'NOT_CONFIGURED'});await expect(lookupPlaces({...input,coordinates:{lat:40.9,lon:-73.9973}},{key:'test',reserve,transport})).rejects.toThrow();expect(reserve).not.toHaveBeenCalled();expect(transport).not.toHaveBeenCalled();
 });
 it('filters distant and duplicate candidate IDs, sanitizes links and preserves provider attribution',async()=>{
  const transport:typeof fetch=async()=>new Response(JSON.stringify({places:[{...rawPlace,googleMapsUri:'https://evil.example/maps',attributions:[{displayName:'Provider',uri:'javascript:bad'}]},rawPlace,{...rawPlace,id:'far',location:{latitude:41,longitude:-74}}]}));
  const result=await lookupPlaces(input,{key:'test',reserve:async()=>3,transport});expect(result.matches).toHaveLength(1);expect(result.matches[0].mapsUrl).toContain('https://www.google.com/maps/search/');expect(result.matches[0].attributions).toEqual([{name:'Provider',uri:null}]);
 });
 it('never retries provider failures and passes Retry-After without exposing provider bodies',async()=>{
  const transport=vi.fn<typeof fetch>(async()=>new Response('secret-provider-body',{status:429,headers:{'Retry-After':'120'}}));await expect(lookupPlaces(input,{key:'test',reserve:async()=>4,transport})).rejects.toMatchObject({code:'DEMO_QUOTA',status:429,retryAfterSeconds:120});expect(transport).toHaveBeenCalledTimes(1);
 });
 it('treats empty as no candidates, rejects malformed payloads, and uses no default fake listings',async()=>{
  const options={key:'test',reserve:async()=>4};expect((await lookupPlaces(input,{...options,transport:async()=>new Response('{}')})).matches).toEqual([]);await expect(lookupPlaces(input,{...options,transport:async()=>new Response('{')})).rejects.toThrow();await expect(lookupPlaces(input,{...options,transport:async()=>new Response(JSON.stringify({places:[{id:'bad'}]}))})).rejects.toThrow();
 });
 it('persists and serializes the daily local budget, resets only on a later UTC day, and stores no place data',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'atlas-places-')),file=path.join(dir,'budget.json'),now=Date.parse('2026-10-24T20:00:00Z');
  try{
   const attempts=await Promise.allSettled([reservePlacesRequest(2,now,file),reservePlacesRequest(2,now,file),reservePlacesRequest(2,now,file)]);expect(attempts.filter(a=>a.status==='fulfilled')).toHaveLength(2);expect(JSON.parse(await readFile(file,'utf8'))).toEqual({day:'2026-10-24',used:2});await expect(reservePlacesRequest(2,now,file)).rejects.toMatchObject({code:'LOCAL_LIMIT'});expect(await reservePlacesRequest(2,now+86400000,file)).toBe(1);
   await writeFile(file,'invalid');await expect(reservePlacesRequest(2,now+86400000,file)).rejects.toMatchObject({code:'BUDGET_UNAVAILABLE'});
  }finally{await unlink(file);await rmdir(dir);}
 });
 it('bounds configuration and validates selected features before transport',()=>{
  expect(placesDailyLimit('5')).toBe(5);expect(placesDailyLimit('21')).toBe(5);expect(placesDailyLimit('0')).toBe(5);expect(placesRequestSchema.safeParse({...input,sourceId:'invented'}).success).toBe(false);
 });
});

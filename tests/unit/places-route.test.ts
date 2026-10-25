import {beforeEach,describe,it,expect,vi} from 'vitest';
import {request} from '../fixtures';
vi.mock('../../src/server/places',async importOriginal=>({...await importOriginal<typeof import('../../src/server/places')>(),lookupPlaces:vi.fn()}));
import {lookupPlaces,PlacesUnavailable} from '../../src/server/places';
const input={analysis:request,sourceId:'node/123',name:'Synthetic café',coordinates:request.scope.center};
const req=(body:unknown)=>new Request('http://localhost/api/places',{method:'POST',body:JSON.stringify(body)});
beforeEach(()=>{vi.resetModules();vi.mocked(lookupPlaces).mockReset();});
describe('Optional Places route',()=>{
 it('rejects invalid and oversized requests before provider calls',async()=>{
  const {POST}=await import('../../src/app/api/places/route');expect((await POST(req({...input,sourceId:'invalid'}))).status).toBe(422);expect((await POST(req({name:'x'.repeat(9000)}))).status).toBe(413);expect(lookupPlaces).not.toHaveBeenCalled();
 });
 it('does not expose provider errors or key values',async()=>{
  vi.mocked(lookupPlaces).mockRejectedValue(new Error('secret-test-key'));const {POST}=await import('../../src/app/api/places/route');const response=await POST(req(input));expect(response.status).toBe(503);expect(await response.text()).not.toContain('secret-test-key');expect(response.headers.get('Cache-Control')).toBe('no-store');
 });
 it('honors provider cooldown without sending another lookup',async()=>{
  vi.mocked(lookupPlaces).mockRejectedValue(new PlacesUnavailable('DEMO_QUOTA',429,120));const {POST}=await import('../../src/app/api/places/route');const first=await POST(req(input));expect(first.status).toBe(429);expect(first.headers.get('Retry-After')).toBe('120');expect((await POST(req(input))).status).toBe(429);expect(lookupPlaces).toHaveBeenCalledTimes(1);
 });
});

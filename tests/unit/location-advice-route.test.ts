import { beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from '../fixtures';
vi.mock('../../src/server/location-advisor', () => ({ adviseLocation: vi.fn() }));
import { adviseLocation } from '../../src/server/location-advisor';
const req = (body: unknown) => new Request('http://localhost/api/location-advice', { method: 'POST', body: JSON.stringify(body) });
beforeEach(() => { vi.resetModules(); vi.mocked(adviseLocation).mockReset(); });
describe('Location advice route', () => {
 it('rejects invalid scopes and oversized bodies without provider work', async () => {
  const { POST } = await import('../../src/app/api/location-advice/route');
  expect((await POST(req({ analysis: { ...request, categoryId: 'invented' } }))).status).toBe(400);
  expect((await POST(req({ description: 'x'.repeat(5000) }))).status).toBe(413);
  expect(adviseLocation).not.toHaveBeenCalled();
 });
 it('sanitizes provider failures and rate limits immediate repeats', async () => {
  const { POST } = await import('../../src/app/api/location-advice/route');
  vi.mocked(adviseLocation).mockRejectedValue(new Error('secret-provider-details'));
  const res = await POST(req({ analysis: request })); expect(res.status).toBe(503);
  expect(await res.text()).not.toContain('secret-provider-details');
  expect((await POST(req({ analysis: request }))).status).toBe(429);
 });
});

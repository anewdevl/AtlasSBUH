import { afterEach, expect, it, vi } from 'vitest';
import { POST } from '../../src/app/api/research/route';
import { reportSchema } from '../../src/lib/research-contracts';

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const body = { description: 'Software company', scope: { cityId: 'nyc', center: { lat: 40.7308, lon: -73.9973 }, radiusMeters: 1000 } };
it('rejects invalid and oversized research input before provider access', async () => {
  expect((await POST(new Request('http://localhost/api/research', { method: 'POST', body: '{' }))).status).toBe(400);
  expect((await POST(new Request('http://localhost/api/research', {method:'POST',body:JSON.stringify({...body,includeMaps:true})}))).status).toBe(400);
  expect((await POST(new Request('http://localhost/api/research', { method: 'POST', body: 'x'.repeat(5000) }))).status).toBe(413);
  expect((await POST(new Request('http://localhost/api/research', { method: 'POST', body: JSON.stringify({ ...body, apiKey: 'untrusted' }) }))).status).toBe(400);
});
it('streams honest stage failures and a validated unavailable report without leaking credentials', async () => {
  vi.stubEnv('NVIDIA_API_KEY', ''); vi.stubEnv('TAVILY_API_KEY', '');
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  const response = await POST(new Request('http://localhost/api/research', { method: 'POST', body: JSON.stringify(body) }));
  expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('no-store');
  const text = await response.text(), events = text.trim().split('\n').map(line => JSON.parse(line));
  expect(events.some(e => e.type === 'stage' && e.stage.stage === 'verification')).toBe(true);
  const report = reportSchema.parse(events.find(e => e.type === 'report').report);
  expect(report.status).toBe('unavailable'); expect(report.findings).toEqual([]); expect(fetch).not.toHaveBeenCalled();
  expect((await POST(new Request('http://localhost/api/research', { method: 'POST', body: JSON.stringify(body) }))).status).toBe(429);
});

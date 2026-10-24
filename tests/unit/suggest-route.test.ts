import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../../src/app/api/suggest/route';

afterEach(() => vi.unstubAllEnvs());

describe('POST /api/suggest', () => {
  it('rejects malformed and oversized descriptions before contacting NVIDIA', async () => {
    const malformed = await POST(new Request('http://localhost/api/suggest', { method: 'POST', body: '{' }));
    expect(malformed.status).toBe(400);
    const oversized = await POST(new Request('http://localhost/api/suggest', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ description: 'x'.repeat(201) }) }));
    expect(oversized.status).toBe(400);
  });

  it('reports optional AI configuration without exposing key material', async () => {
    vi.stubEnv('NVIDIA_API_KEY', '');
    const response = await POST(new Request('http://localhost/api/suggest', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ description: 'technology company office' }) }));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining('NVIDIA_API_KEY') });
  });
});

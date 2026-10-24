import { afterEach, describe, expect, it, vi } from 'vitest';
import { suggestCategory } from '../../src/server/ai-category';

afterEach(() => vi.unstubAllGlobals());

describe('NVIDIA NIM category suggestions', () => {
  it('sends a bounded classification request and validates the category response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: '{"categoryId":"cafe","explanation":"A coffee shop is a mapped café."}' } }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(suggestCategory('A coffee shop', 'test-key')).resolves.toEqual({ categoryId: 'cafe', explanation: 'A coffee shop is a mapped café.' });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://integrate.api.nvidia.com/v1/chat/completions');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer test-key');
    expect(JSON.parse(String(init.body)).model).toBe('openai/gpt-oss-20b');
  });

  it('preserves unsupported businesses as null and rejects unexpected model output', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: '```json\n{"categoryId":null,"explanation":"A software office is not in the mapped categories."}\n```' } }] }), { status: 200 })));
    await expect(suggestCategory('Fintech company office', 'test-key')).resolves.toMatchObject({ categoryId: null });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: '{"categoryId":"office","explanation":"Unsupported."}' } }] }), { status: 200 })));
    await expect(suggestCategory('Office', 'test-key')).rejects.toThrow();
  });
});

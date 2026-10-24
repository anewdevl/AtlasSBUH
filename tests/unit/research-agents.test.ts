import { describe, expect, it, vi } from 'vitest';
import { orderVerified, researchAgents } from '../../src/server/research-agents';
import { readDiscoveredPages, researchConfig, webSearch } from '../../src/server/research-providers';
import { research } from '../../src/server/research';
import type { Evidence, ResearchRequest } from '../../src/lib/research-contracts';

const config = researchConfig({ NVIDIA_API_KEY: 'agent-test-nvidia', TAVILY_API_KEY: 'agent-test-tavily' });
const request: ResearchRequest = { description: 'A coffee shop', scope: { cityId: 'nyc', center: { lat: 40.7308, lon: -73.9973 }, radiusMeters: 1000 }, includeMaps: false };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const signal = () => new AbortController().signal;
const source: Evidence = { id: 'web-fixture', url: 'https://fixture.example/menu', title: 'Menu', provider: 'tavily', excerpt: 'A search excerpt.', contentKind: 'search-excerpt', retrievedAt: new Date().toISOString(), coordinates: null, placeId: null };

describe('five-agent permissions and handoffs', () => {
  it('defines five distinct roles and restricts the writer to verified record ordering', () => {
    expect(Object.keys(researchAgents)).toHaveLength(5);
    expect(researchAgents.writer.tools).toEqual(['order_verified_records']);
    expect(orderVerified([{ id: 'a' }, { id: 'b' }], ['b', 'a'])).toEqual([{ id: 'b' }, { id: 'a' }]);
    for (const ids of [['a'], ['a', 'a'], ['a', 'invented']]) expect(() => orderVerified([{ id: 'a' }, { id: 'b' }], ids)).toThrow();
  });
  it('distinguishes empty results from results rejected as unusable', async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ results: [] })).mockResolvedValueOnce(json({ results: [{ url: 'http://fixture.example', title: 'Unsafe', content: 'Content' }] }));
    await expect(webSearch('coffee', config, signal(), transport)).rejects.toMatchObject({ code: 'no_results' });
    await expect(webSearch('coffee', config, signal(), transport)).rejects.toMatchObject({ code: 'unusable_sources' });
  });
  it('reads discovered URLs only and ignores an extraction result for an unrequested URL', async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(json({ results: [{ url: source.url, raw_content: 'Actual public menu: espresso $4.' }, { url: 'https://invented.example', raw_content: 'Invented' }] }));
    const pages = await readDiscoveredPages([source], config, signal(), transport);
    expect(pages).toHaveLength(1); expect(pages[0]).toMatchObject({ id: source.id, excerpt: 'Actual public menu: espresso $4.', contentKind: 'page' });
    expect(JSON.parse(String(transport.mock.calls[0][1]?.body)).urls).toEqual([source.url]);
    expect(transport.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
  });
  it('keeps search excerpts for failed page reads and does not send local or numeric URLs to extraction', async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(json({ results: [], failed_results: [{ url: source.url }] }));
    expect(await readDiscoveredPages([source], config, signal(), transport)).toEqual([source]);
    transport.mockClear();
    const privateSources = ['https://127.0.0.1/a', 'https://localhost/a', 'https://host.internal/a', 'https://[::1]/a'].map(url => ({ ...source, url }));
    expect(await readDiscoveredPages(privateSources, config, signal(), transport)).toEqual(privateSources);
    expect(transport).not.toHaveBeenCalled();
  });
  it('retries empty discovery exactly once, then explains the cause without fabricating downstream output', async () => {
    const transport = vi.fn<typeof fetch>(async input => String(input).includes('nvidia') ? json({ choices: [{ message: { content: JSON.stringify({ queries: ['coffee local menu'] }) } }] }) : json({ results: [] }));
    const report = await research(request, { config, transport });
    expect(transport.mock.calls.filter(([url]) => String(url).endsWith('/search'))).toHaveLength(2);
    expect(report.stages.find(s => s.stage === 'web')).toMatchObject({ status: 'unavailable', message: expect.stringContaining('no_results') });
    expect(report.findings).toEqual([]); expect(report.insights).toEqual([]); expect(report.status).toBe('unavailable');
    expect(report.agentRuns.map(r => r.role)).toEqual(['researcher']);
  });
  it('does not retry credential failures as if they were empty search results', async () => {
    const transport = vi.fn<typeof fetch>(async input => String(input).includes('nvidia') ? json({ choices: [{ message: { content: JSON.stringify({ queries: ['coffee'] }) } }] }) : json({}, 401));
    const report = await research(request, { config, transport });
    expect(transport.mock.calls.filter(([url]) => String(url).endsWith('/search'))).toHaveLength(1);
    expect(report.warnings.join(' ')).toContain('credentials');
  });
});

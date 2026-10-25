import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { research, groundedFindings, isContactOnly, supportsObservationKind } from '../../src/server/research';
import { nim, researchConfig, type Config } from '../../src/server/research-providers';
import { z } from 'zod';
import { evidenceSchema, reportSchema, researchRequestSchema, type Finding, type ResearchRequest } from '../../src/lib/research-contracts';
import { normalize } from '../../src/server/normalize';
import { buildQuery, hashQuery } from '../../src/server/overpass';
import type { AnalysisRequest } from '../../src/lib/contracts';

const request: ResearchRequest = { description: 'Specialty coffee shop', scope: { cityId: 'nyc', center: { lat: 40.7308, lon: -73.9973 }, radiusMeters: 1000 } };
const url = 'https://fixture.example/menu';
const sourceId = `web-${createHash('sha256').update(url).digest('hex').slice(0, 16)}`;
const quote = 'Synthetic Coffee lists espresso at $4 on its New York menu.';
const finding: Finding = { id: 'f1', claim: 'The retrieved menu lists espresso at $4.', kind: 'price', business: 'Synthetic Coffee', relation: 'direct', evidence: [{ sourceId, quote }], geographicRelevance: 'New York address; exact radius membership unverified.', limitations: ['Menu date unknown; confirm price locally.'], reviewSampleSize: null, reviewDates: null };
const impact={id:'impact1',business:'Synthetic Coffee',effect:'competition',yourOffering:'coffee',competitorOffering:'espresso',findingIds:['f1']};
const assessment={verdict:'recommended',reasoning:'Worth investigating with a differentiated coffee offering, given the sourced competitor offering.',findingIds:['f1'],risks:['Rent and demand are unknown.']};
const config = (): Config => researchConfig({ NVIDIA_API_KEY: 'synthetic-nvidia-secret', TAVILY_API_KEY: 'synthetic-tavily-secret' });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
function transport(options: { findings?: Finding[]; reject?: boolean; verifyFails?: boolean; truncated?: boolean; echoSecret?: boolean; targetedFail?: boolean; excerpt?: string; writerInvalid?: boolean; pageFails?: boolean; qualificationBusiness?: string; sourceTitle?: string; impacts?:unknown[]; assessment?:unknown; assessmentRejected?:boolean } = {}) {
  let searches = 0;
  return vi.fn<typeof fetch>(async (input, init) => {
    const endpoint = String(input), body = JSON.parse(String(init?.body));
    if (endpoint.endsWith('/extract')) return json({ results: options.pageFails ? [] : [{ url, raw_content: options.excerpt ?? quote }] });
    if (endpoint.includes('tavily')) { searches++; return options.targetedFail && searches > 1 ? json({}, 503) : json({ results: [{ url, title: options.sourceTitle ?? 'Synthetic menu', content: options.excerpt ?? quote, raw_content: options.excerpt ?? quote }] }); }
    if (endpoint.includes('googleapis')) throw new Error('Google must not be called by research');
    const system = body.messages[0].content as string;
    let result: unknown;
    if (system.includes('planning agent')) result = { queries: ['coffee menus New York'] };
    else if (system.includes('source qualification agent')) result = { sources: [{ sourceId, business: options.qualificationBusiness ?? 'Synthetic Coffee', kind: 'official-business' }] };
    else if (system.includes('competitor discovery agent')) result = { businesses: [{ name: 'Synthetic Coffee', sourceId, quoteId: `${sourceId}-q0` }] };
    else if (system.includes('extraction agent')) result = { findings: (options.findings ?? [finding]).map(f => ({ sourceId: f.evidence[0].sourceId, quoteId: f.evidence[0].quote === quote ? `${f.evidence[0].sourceId}-q0` : 'invented-quote-id', business: f.business, kind: f.kind, relation: f.relation })), unknowns: [options.echoSecret ? config().nvidiaKey! : 'Sample and dates are unknown.'] };
    else if (system.includes('business impact assessment agent')) result = { impacts: options.impacts??[impact], assessment:options.assessment??assessment };
    else if (system.includes('report preparation agent')) result = { findingIds: [options.writerInvalid ? 'invented' : 'f1'], insightIds: ['i1'] };
    else {
      if (options.verifyFails) return json({}, 503);
      result = { findings: (options.findings ?? [finding]).map(f => ({ id: f.id, supported: !options.reject, reason: options.reject ? 'Contradicts retrieved menu.' : 'Matches source with scope caveat.' })), insights: [{ id: 'i1', supported: !options.reject, reason: 'Explicit hypothesis with validation.' }],assessmentSupported:!options.reject&&!options.assessmentRejected };
    }
    return json({ choices: [{ finish_reason: options.truncated && system.includes('extraction agent') ? 'length' : 'stop', message: { content: JSON.stringify(result) } }] });
  });
}
describe('bounded evidence research', () => {
  it('researches named candidates inside the radius and preserves the full ranked shortlist', async () => {
    const osmRequest: AnalysisRequest = { schemaVersion: '1', registryVersion: '2', scope: request.scope, categoryId: 'cafe', adjacentCategoryIds: [] };
    const cached = normalize(osmRequest, { elements: [{ type: 'node', id: 1, lat: 40.7308, lon: -73.9973, tags: { amenity: 'cafe', name: 'Synthetic Coffee' } }], fetchedAt: new Date().toISOString(), osmBaseTimestamp: null, queryHash: hashQuery(buildQuery(osmRequest)) });
    const fetch = transport();
    const report = await research({ ...request, osmRequest, localOnly: true }, { config: config(), transport: fetch, osmLookup: async () => cached });
    expect(report.shortlist).toHaveLength(1); expect(report.shortlist[0]).toMatchObject({ name: 'Synthetic Coffee', distanceMeters: 0 });
    expect(report.findings).toHaveLength(1); expect(report.agentRuns.map(r => r.role)).toEqual(['researcher', 'extractor', 'analyst', 'verifier']);
    const searches = fetch.mock.calls.filter(([url]) => String(url).endsWith('/search'));
    expect(searches).toHaveLength(1); expect(JSON.parse(String(searches[0][1]?.body)).query.toLowerCase()).toContain('"synthetic coffee"');
  });
  it('rejects a qualifier decision assigning a source to an unlisted business', async () => {
    const osmRequest: AnalysisRequest = {schemaVersion:'1',registryVersion:'2',scope:request.scope,categoryId:'cafe',adjacentCategoryIds:[]};
    const cached = normalize(osmRequest,{elements:[{type:'node',id:1,lat:40.7308,lon:-73.9973,tags:{amenity:'cafe',name:'Synthetic Coffee'}}],fetchedAt:new Date().toISOString(),osmBaseTimestamp:null,queryHash:hashQuery(buildQuery(osmRequest))});
    const report = await research({...request,osmRequest,localOnly:true},{config:config(),transport:transport({qualificationBusiness:'Unrelated Restaurant'}),osmLookup:async()=>cached});
    expect(report.evidence).toEqual([]); expect(report.findings).toEqual([]); expect(report.insights).toEqual([]);
  });
  it('rejects a same-name restaurant before extraction for a clothing request and keeps the specialty', async () => {
    const osmRequest: AnalysisRequest = {schemaVersion:'1',registryVersion:'2',scope:request.scope,categoryId:'clothing',adjacentCategoryIds:[]};
    const cached = normalize(osmRequest,{elements:[{type:'node',id:1,lat:40.7308,lon:-73.9973,tags:{shop:'clothes',name:'Synthetic Coffee'}}],fetchedAt:new Date().toISOString(),osmBaseTimestamp:null,queryHash:hashQuery(buildQuery(osmRequest))});
    const upstream = transport({sourceTitle:'Synthetic Coffee Restaurant | Menu + Delivery'});
    const report = await research({...request,description:'desi clothing store',osmRequest,localOnly:true},{config:config(),transport:upstream,osmLookup:async()=>cached});
    expect(report.evidence).toEqual([]); expect(report.findings).toEqual([]);
    expect(report.unknowns.join(' ')).toContain('desi');
    const query=JSON.parse(String(upstream.mock.calls.find(([url])=>String(url).endsWith('/search'))![1]?.body)).query;
    expect(query).toContain('Clothing shop'); expect(query).not.toContain('menu');
  });
  it('does not turn identity-only observations into business opportunity insights', async () => {
    const report=await research(request,{config:config(),transport:transport({findings:[{...finding,kind:'competitor'}]})});
    expect(report.findings).toHaveLength(1); expect(report.insights).toEqual([]);
    expect(report.agentRuns.some(r=>r.role==='analyst')).toBe(false);
  });
  it('rechecks category evidence after reading a page instead of trusting its search excerpt', async () => {
    const osmRequest: AnalysisRequest={schemaVersion:'1',registryVersion:'2',scope:request.scope,categoryId:'cafe',adjacentCategoryIds:[]};
    const cached=normalize(osmRequest,{elements:[{type:'node',id:1,lat:40.7308,lon:-73.9973,tags:{amenity:'cafe',name:'Synthetic Coffee'}}],fetchedAt:new Date().toISOString(),osmBaseTimestamp:null,queryHash:hashQuery(buildQuery(osmRequest))});
    const upstream=transport();const intercepted:typeof fetch=(input,init)=>String(input).endsWith('/extract')?Promise.resolve(json({results:[{url,raw_content:'Synthetic Coffee is a software company building cloud services.'}]})):upstream(input,init);
    const report=await research({...request,osmRequest,localOnly:true},{config:config(),transport:intercepted,osmLookup:async()=>cached});
    expect(report.evidence).toEqual([]);expect(report.findings).toEqual([]);expect(report.agentRuns.some(r=>r.role==='extractor')).toBe(false);
  });
  it('ignores retired Gemini credentials and never calls Google during research', async () => {
    const cfg=researchConfig({NVIDIA_API_KEY:'synthetic-nvidia-secret',TAVILY_API_KEY:'synthetic-tavily-secret',GEMINI_MAPS_API_KEY:'retired-primary',GEMINI_MAPS_API_KEY_FALLBACK:'retired-fallback'});
    expect(cfg).not.toHaveProperty('mapsKeys');
    const upstream=transport();const report=await research(request,{config:cfg,transport:upstream});
    expect(report.findings).toHaveLength(1);expect(report.stages.map(s=>s.stage)).not.toContain('maps');
    expect(upstream.mock.calls.every(([url])=>['api.tavily.com','integrate.api.nvidia.com'].includes(new URL(String(url)).hostname))).toBe(true);
    expect(researchRequestSchema.safeParse({...request,includeMaps:true}).success).toBe(false);
  });
  it('allows the LLM to recommend against opening rather than forcing one verdict',async()=>{
    const report=await research(request,{config:config(),transport:transport({assessment:{...assessment,verdict:'not-recommended',reasoning:'The sourced overlap makes differentiation uncertain for this proposal.'}})});
    expect(report.assessment?.verdict).toBe('not-recommended');expect(report.impacts[0].competitorOffering).toBe('espresso');
  });
  it('rejects invented competitor offerings even when the cited finding ID exists',async()=>{
    const report=await research(request,{config:config(),transport:transport({impacts:[{...impact,competitorOffering:'desi bridal clothing'}]})});
    expect(report.findings).toHaveLength(1);expect(report.impacts).toEqual([]);expect(report.assessment).toBeNull();
  });
  it('withholds an opening judgment that invents sales or demand even with real citations',async()=>{
    for(const reasoning of ['You will gain 500 customers.','This has high demand.']){
      const report=await research(request,{config:config(),transport:transport({assessment:{...assessment,reasoning}})});
      expect(report.assessment).toBeNull();expect(report.impacts).toHaveLength(1);
    }
  });
  it('withholds a verdict rejected by evidence review while preserving supported business comparisons',async()=>{
    const report=await research(request,{config:config(),transport:transport({assessmentRejected:true})});
    expect(report.assessment).toBeNull();expect(report.impacts).toHaveLength(1);expect(report.findings).toHaveLength(1);expect(report.status).toBe('partial');
  });
  it('does not substitute city-wide web results when local candidates are unavailable', async () => {
    const osmRequest: AnalysisRequest = { schemaVersion: '1', registryVersion: '2', scope: request.scope, categoryId: 'cafe', adjacentCategoryIds: [] };
    const fetch = vi.fn<typeof globalThis.fetch>();
    const report = await research({ ...request, osmRequest, localOnly: true }, { config: config(), transport: fetch, osmLookup: async () => undefined });
    expect(report.shortlist).toEqual([]); expect(report.status).toBe('unavailable'); expect(fetch).not.toHaveBeenCalled();
  });
  it('requires a quoted monetary amount for prices and excludes review headings and pricing disclaimers from feedback', () => {
    expect(supportsObservationKind('price', 'Signature coffee')).toBe(false);
    expect(supportsObservationKind('price', 'Espresso $4.50')).toBe(true);expect(supportsObservationKind('price','Free Shipping on US Orders $50+')).toBe(false);expect(supportsObservationKind('offering','Subscribe to our newsletter')).toBe(false);
    expect(supportsObservationKind('location', 'IRVING FARM COFFEE')).toBe(false);
    expect(supportsObservationKind('location', 'Located at 123 Broadway, New York.')).toBe(true);
    expect(supportsObservationKind('price', 'Reviewers note coffee costs around $6.')).toBe(false);
    expect(supportsObservationKind('price', 'The ice coffee is about $4 plus tip.')).toBe(false);
    expect(supportsObservationKind('feedback', 'Reviews for Synthetic Coffee')).toBe(false);
    expect(supportsObservationKind('feedback', 'Prices may be lower in-store.')).toBe(false);
    expect(supportsObservationKind('feedback', 'Switch to pickup')).toBe(false);
    expect(supportsObservationKind('feedback', 'The coffee tasted great but service was slow.')).toBe(true);
  });
  it('rejects bare contact details and navigation as review material', () => {
    expect(isContactOnly('hello@fixture.example')).toBe(true); expect(isContactOnly('+1 (212) 555-0123')).toBe(true);
    expect(isContactOnly('Subscribe to our newsletter')).toBe(true); expect(isContactOnly('The coffee tasted great but service was slow.')).toBe(false);
  });
  it('withholds a contact email selected by the model as customer feedback', async () => {
    const report = await research(request, { config: config(), transport: transport({ excerpt: 'hello@fixture.example', findings: [{ ...finding, kind: 'feedback' }] }) });
    expect(report.findings).toEqual([]); expect(report.insights).toEqual([]); expect(report.status).toBe('partial');
  });
  it('parses NVIDIA structured tool arguments and rejects unexpected function names', async () => {
    const response = (name: string) => json({ choices: [{ finish_reason: 'tool_calls', message: { content: null, tool_calls: [{ type: 'function', function: { name, arguments: '{"queries":["coffee NYC"]}' } }] } }] });
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(response('submit_report')).mockResolvedValueOnce(response('unexpected'));
    const schema = z.object({ queries: z.array(z.string()).max(2) }).strict();
    await expect(nim('planning', {}, schema, config(), new AbortController().signal, fetch)).resolves.toEqual({ queries: ['coffee NYC'] });
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body)).tool_choice.function.name).toBe('submit_report');
    await expect(nim('planning', {}, schema, config(), new AbortController().signal, fetch)).rejects.toThrow();
  });
  it('completes sourced research through actual retrieval adapter contracts', async () => {
    const fetch = transport(), progress: string[] = [];
    const report = await research(request, { config: config(), transport: fetch, onStage: s => progress.push(`${s.stage}:${s.status}`) });
    expect(report.status).toBe('complete'); expect(report.findings).toHaveLength(1); expect(report.findings[0]).toMatchObject({ claim: quote, evidence: finding.evidence, business: finding.business }); expect(report.insights).toHaveLength(1);
    expect(report.evidence[0].excerpt).toBe(quote); expect(report.evidence[0].retrievedAt).toMatch(/^\d{4}-/);
    expect(progress).toContain('verification:running'); expect(fetch).toHaveBeenCalledTimes(9);
    expect(report.agentRuns.map(r => r.role)).toEqual(['researcher', 'researcher', 'extractor', 'analyst', 'verifier']);
    expect(fetch.mock.calls.filter(([url]) => String(url).includes('googleapis'))).toHaveLength(0);
    expect(fetch.mock.calls.filter(([url]) => String(url).includes('tavily')).map(([, init]) => JSON.parse(String(init?.body)).query)).toEqual(expect.arrayContaining(['"Synthetic Coffee" New York official website menu offerings prices', '"Synthetic Coffee" New York customer reviews experience complaints service']));
    expect(JSON.parse(String(fetch.mock.calls.find(([url]) => String(url).includes('nvidia.com'))![1]?.body))).toMatchObject({ model: 'nvidia/nemotron-3.5-lightning-30b-a3b', chat_template_kwargs: { enable_thinking: false } });
    expect(reportSchema.safeParse(report).success).toBe(true);
    expect(JSON.stringify(report)).not.toContain(config().nvidiaKey);
    const search = fetch.mock.calls.find(([url]) => String(url).includes('tavily'))!;
    expect(JSON.parse(String(search[1]?.body))).toMatchObject({ include_raw_content: 'text', include_answer: false });
  });
  it('rejects missing evidence and invented quotes before synthesis', async () => {
    const invented = { ...finding, evidence: [{ sourceId, quote: 'Invented review quote about queues.' }] };
    const report = await research(request, { config: config(), transport: transport({ findings: [invented] }) });
    expect(report.status).toBe('partial'); expect(report.findings).toEqual([]); expect(report.insights).toEqual([]);
    expect(groundedFindings([{ ...finding, evidence: [{ sourceId: 'missing', quote }] }], report.evidence)).toEqual([]);
  });
  it('does not send a separate free-writing report request', async () => {
    const upstream=transport();const report=await research(request,{config:config(),transport:upstream});
    expect(report.agentRuns.some(r=>String(r.role)==='writer')).toBe(false);expect(report.assessment?.verdict).toBe('recommended');expect(report.impacts).toHaveLength(1);
  });
  it('reports failed page reads while retaining supported search excerpts', async () => {
    const report = await research(request, { config: config(), transport: transport({ pageFails: true }) });
    expect(report.findings).toHaveLength(1); expect(report.warnings.join(' ')).toContain('read 0 of 1'); expect(report.status).toBe('partial');
  });
  it('deduplicates repeated excerpt selections and marks omitted duplicate findings partial', async () => {
    const report = await research(request, { config: config(), transport: transport({ findings: [finding, { ...finding, id: 'f2' }] }) });
    expect(report.findings).toHaveLength(1); expect(report.status).toBe('partial'); expect(report.warnings.join(' ')).toContain('rejected');
  });
  it('retains discovery findings when the individual-business search fails', async () => {
    const report = await research(request, { config: config(), transport: transport({ targetedFail: true }) });
    expect(report.status).toBe('partial'); expect(report.findings).toHaveLength(1);
    expect(report.warnings.join(' ')).toContain('Individual business research was partly unavailable');
  });
  it('reserves verification time by skipping insights after slow retrieval/extraction', async () => {
    vi.useFakeTimers();
    try {
      const upstream = transport();
      const fetch = vi.fn<typeof globalThis.fetch>((input, init) => {
        if (String(input).includes('nvidia.com') && String(init?.body).includes('web and review extraction agent')) vi.advanceTimersByTime(60000);
        return upstream(input, init);
      });
      const report = await research(request, { config: config(), transport: fetch });
      expect(report.findings).toHaveLength(1); expect(report.insights).toEqual([]);
      expect(report.stages.find(s => s.stage === 'insights')).toMatchObject({ status: 'partial', message: expect.stringContaining('reserved') });
      expect(report.stages.find(s => s.stage === 'verification')?.status).toBe('complete');
    } finally { vi.useRealTimers(); }
  });
  it('withholds truncated NVIDIA extraction even if the partial JSON parses', async () => {
    const report = await research(request, { config: config(), transport: transport({ truncated: true }) });
    expect(report.status).toBe('partial'); expect(report.evidence).toHaveLength(1); expect(report.findings).toEqual([]); expect(report.insights).toEqual([]);
  });
  it('qualifies feedback with unknown sample size as the retrieved excerpt, not a recurring theme', async () => {
    const feedback: Finding = { ...finding, kind: 'feedback', claim: 'Many customers repeatedly praise service.' };
    const opinion = 'Synthetic Coffee had friendly service and excellent coffee.';
    const report = await research(request, { config: config(), transport: transport({ findings: [feedback], excerpt: opinion }) });
    expect(report.findings[0].claim).toBe(`Retrieved commentary excerpt: ${opinion}`);
    expect(report.findings[0].limitations.join(' ')).toContain('does not establish a recurring customer theme');
  });
  it('preserves dated validated OSM context without adding external businesses to counts', async () => {
    const osmRequest: AnalysisRequest = { schemaVersion: '1', registryVersion: '2', scope: request.scope, categoryId: 'cafe', adjacentCategoryIds: [] };
    const fetchedAt = new Date(Date.now() - 3600000).toISOString();
    const cached = normalize(osmRequest, { elements: [], fetchedAt, osmBaseTimestamp: null, queryHash: hashQuery(buildQuery(osmRequest)) });
    const report = await research({ ...request, osmRequest }, { config: config(), transport: transport(), osmLookup: async () => cached });
    expect(report.findings).toHaveLength(1); expect(report.osmContext).toMatchObject({ fetchedAt, directMappedCount: 0, coverage: 'unknown' });
    expect(reportSchema.safeParse({ ...report, osmContext: { ...report.osmContext, status: 'partial', directMappedCount: 5 } }).success).toBe(false);
  });
  it('caps total HTTP requests and retains sources when the budget runs out', async () => {
    const fetch = transport();
    const report = await research(request, { config: { ...config(), requests: 2 }, transport: fetch });
    expect(fetch).toHaveBeenCalledTimes(2); expect(report.evidence).toHaveLength(1); expect(report.status).toBe('partial'); expect(report.findings).toEqual([]);
  });
  it('redacts credential echoes from provider-generated report content', async () => {
    const fetch = transport({ echoSecret: true });
    const report = await research(request, { config: config(), transport: fetch });
    expect(report.unknowns).toContain('[redacted]'); expect(JSON.stringify(report)).not.toContain(config().nvidiaKey);
  });
  it('removes contradictory claims and dependent insights', async () => {
    const report = await research(request, { config: config(), transport: transport({ reject: true }) });
    expect(report.findings).toEqual([]); expect(report.insights).toEqual([]); expect(report.status).toBe('partial'); expect(report.warnings.join(' ')).toContain('removed');
  });
  it('withholds generated claims on verification failure but keeps retrieved evidence', async () => {
    const report = await research(request, { config: config(), transport: transport({ verifyFails: true }) });
    expect(report.evidence).toHaveLength(1); expect(report.findings).toEqual([]); expect(report.insights).toEqual([]); expect(report.status).toBe('partial');
  });
  it('supports software research without requiring an OSM category or call', async () => {
    const fetch = transport();
    const report = await research({ ...request, description: 'Software analytics company' }, { config: config(), transport: fetch });
    expect(report.request.description).toContain('Software'); expect(fetch.mock.calls.some(([url]) => /overpass|analyze/.test(String(url)))).toBe(false);
    expect(researchRequestSchema.safeParse({ ...request, categoryId: 'software' }).success).toBe(false);
  });
  it('returns unavailable with missing optional credentials and performs no network calls', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    const report = await research(request, { config: researchConfig({}), transport: fetch });
    expect(report.status).toBe('unavailable'); expect(fetch).not.toHaveBeenCalled();
  });
  it('rejects malformed scope, credentials and report evidence references', () => {
    expect(researchRequestSchema.safeParse({ ...request, scope: { ...request.scope, center: { lat: 0, lon: 0 } } }).success).toBe(false);
    expect(evidenceSchema.safeParse({ id: 'x', url: 'javascript:alert(1)' }).success).toBe(false);
    expect(config().tokens).toBeLessThanOrEqual(4000);
    expect(researchConfig({ ATLAS_RESEARCH_MODEL: 'openai/gpt-oss-20b' }).model).toBe('openai/gpt-oss-20b');
  });

});

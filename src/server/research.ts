import { z } from 'zod';
import { analyze } from './analyze';
import { businessNames, businessSourceAllowed, normalizedName, shortlistBusinesses, type ShortlistedBusiness } from '../lib/business-shortlist';
import { cities } from '../lib/cities';
import { findingSchema, insightSchema, reportSchema, researchRequestSchema, stages, type Evidence, type Finding, type ResearchRequest, type ResearchReport, type Stage } from '../lib/research-contracts';
import { mapsResearch, ProviderFailure, readDiscoveredPages, researchConfig, webSearch, type Config, type Transport } from './research-providers';
import { agentRunner, editorialSchema, orderVerified, searchPlanSchema, type AgentRun } from './research-agents';
import { validateResponse, type AnalysisRequest, type AnalysisResponse } from '../lib/contracts';
import { age, readSnapshot, runtimeCache, STALE_MS } from './cache';
import { buildQuery, hashQuery } from './overpass';

const extractionFindingSchema = z.object({ sourceId: z.string(), quoteId: z.string(), business: z.string().nullable(), kind: findingSchema.shape.kind, relation: findingSchema.shape.relation }).strict();
const extractionSchema = z.object({ findings: z.array(extractionFindingSchema).max(6), unknowns: z.array(z.string().min(1).max(2000)).max(10) }).strict();
const discoverySchema = z.object({ businesses: z.array(z.object({ name: z.string().min(1).max(150), sourceId: z.string(), quoteId: z.string() }).strict()).max(1) }).strict();
const sourceQualificationSchema = z.object({ sources: z.array(z.object({ sourceId: z.string(), business: z.string().optional(), kind: z.enum(['official-business', 'business-listing', 'business-reviews', 'reject']) }).strict()).max(8) }).strict();

export function isContactOnly(text: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text.trim()) || /^(?:https?:\/\/|www\.)\S+$/i.test(text.trim()) || /^[+\d()\s.-]{7,}$/.test(text.trim()) || /^(?:contact us|sign up|subscribe|privacy policy|terms of use)\b/i.test(text.trim());
}

export function supportsObservationKind(kind: Finding['kind'], text: string) {
  if (isContactOnly(text)) return false;
  if (kind === 'location') return /\d/.test(text) && /\b(?:street|st|avenue|ave|road|rd|broadway|lane|ln|drive|dr|square|sq|boulevard|blvd|way|suite|floor|unit|postal|postcode)\b/i.test(text);
  if (kind === 'price') return !/\b(?:reviewers?|reviewed|paid|I paid|per person|plus tip|about|around|approximately)\b/i.test(text) && /(?:[$£€¥₹]\s*\d|\d[\d,.]*\s*(?:USD|GBP|EUR|AED|SGD|dollars?|pounds?|euros?)\b)/i.test(text);
  if (kind === 'feedback') return text.trim().split(/\s+/).length >= 3 && !/^(?:reviews?\s+(?:for|of)\b|reviews?\s*[.:]?$|write a review|no reviews?\b|be the first to review|prices may|prices and availability|prices? (?:may|can) vary|all rights reserved)/i.test(text.trim()) && /\b(?:love[ds]?|hate[ds]?|liked?|disliked?|enjoy(?:ed)?|delicious|tast(?:e|es|ed|y)|friendly|rude|slow|quick|fast|excellent|amazing|terrible|overpriced|disappoint(?:ed|ing)|recommend(?:ed)?|wait(?:ed|ing)?|queue|helpful|unhelpful|fresh|stale|best|worst|good|bad|quality|service|experience|value|flavou?r)\b/i.test(text);
  return true;
}
const synthesisSchema = z.object({ insights: z.array(insightSchema).max(3) }).strict();
const reviewSchema = z.object({ findings: z.array(z.object({ id: z.string(), supported: z.boolean(), reason: z.string().min(1).max(2000) }).strict()).max(24), insights: z.array(z.object({ id: z.string(), supported: z.boolean(), reason: z.string().min(1).max(2000) }).strict()).max(8) }).strict();

export function numberedQuotes(source: Evidence, description: string) {
  const terms = description.toLowerCase().split(/\W+/).filter(t => t.length > 3);
  return source.excerpt.split('\n').flatMap(line => line.split(/(?<=[.!?])\s+(?=[A-Z])/)).map((line, index) => ({ id: `${source.id}-q${index}`, text: line.trim().slice(0, 240), index }))
    .filter(q => q.text.length >= 12)
    .map(q => ({ ...q, score: terms.reduce((n, term) => n + Number(q.text.toLowerCase().includes(term)), 0) + (/[$£€]|review|queue|pickup|service/i.test(q.text) ? 2 : 0) }))
    .sort((a, b) => b.score - a.score || a.index - b.index).slice(0, 12).map(({ id, text }) => ({ id, text }));
}

export function groundedFindings(findings: Finding[], evidence: Evidence[]) {
  const seen = new Set<string>();
  return findings.filter(f => {
    if (seen.has(f.id)) return false; seen.add(f.id);
    return f.evidence.every(ref => {
      const source = evidence.find(e => e.id === ref.sourceId);
      return source && ref.quote.trim().length >= 12 && source.excerpt.includes(ref.quote);
    });
  }).map(f => f.kind === 'feedback' && f.reviewSampleSize === null ? {
    ...f, claim: `Retrieved commentary excerpt: ${f.evidence[0].quote}`,
    limitations: [...new Set([...f.limitations, 'Review sample size is unknown; this excerpt does not establish a recurring customer theme.', 'Author/review provenance is unconfirmed; commentary may be editorial or business-authored.'])].slice(0, 8),
  } : f);
}

export async function research(input: ResearchRequest, options: { config?: Config; transport?: Transport; signal?: AbortSignal; onStage?: (stage: Stage) => void; osmLookup?: (r: AnalysisRequest) => Promise<AnalysisResponse | undefined> } = {}): Promise<ResearchReport> {
  const request = researchRequestSchema.parse(input), config = options.config ?? researchConfig(), upstream = options.transport ?? fetch;
  let requestCount = 0;
  const transport: Transport = (url, init) => {
    if (requestCount >= config.requests) throw new ProviderFailure('budget');
    requestCount++; return upstream(url, init);
  };
  const signal = AbortSignal.any([AbortSignal.timeout(config.timeoutMs), ...(options.signal ? [options.signal] : [])]);
  const startedMs = Date.now(), startedAt = new Date(startedMs).toISOString(), warnings: string[] = [], unknowns: string[] = [];
  const agentRuns: AgentRun[] = [];
  const runAgent = agentRunner(config, signal, transport, run => agentRuns.push(run));
  const state = new Map<Stage['stage'], Stage>();
  const update = (stage: Stage['stage'], status: Stage['status'], message: string) => { const s = { stage, status, message }; state.set(stage, s); options.onStage?.(s); };
  const failed = (stage: Stage['stage'], error: unknown) => {
    const code = error instanceof ProviderFailure ? error.code : signal.aborted ? 'deadline' : 'invalid or unavailable response';
    const retry = error instanceof ProviderFailure && error.retryAfterSeconds ? ` Retry after at least ${error.retryAfterSeconds} seconds.` : '';
    update(stage, 'unavailable', `${stage}: ${code}.${retry}`); warnings.push(`${stage}: ${code}.${retry}`);
  };
  let evidence: Evidence[] = [], findings: Finding[] = [], insights: ResearchReport['insights'] = [];
  let osmContext: ResearchReport['osmContext'] = null;
  let shortlist: ShortlistedBusiness[] = [];
  update('planning', 'running', 'Loading mapped businesses inside the selected radius.');
  if (request.osmRequest) {
    try {
      const cached = await (options.osmLookup ?? (async r => request.localOnly ? analyze(r, { transport: (url, init) => transport(url, { ...init, signal: AbortSignal.any([signal, ...(init?.signal ? [init.signal] : [])]) }) }) : runtimeCache.get(r) ?? await readSnapshot(r)))(request.osmRequest);
      if (cached) {
        const valid = validateResponse(cached, request.osmRequest);
        if (age(valid) <= STALE_MS && valid.provenance.queryHash === hashQuery(buildQuery(valid.request))) {
          shortlist = shortlistBusinesses(valid, request.description);
          osmContext = { request: valid.request, fetchedAt: valid.provenance.fetchedAt, status: valid.status, directMappedCount: valid.directMappedCount, adjacentMappedCount: valid.adjacentMappedCount, coverage: 'unknown' };
        }
      }
      if (!osmContext) warnings.push('No compatible dated OSM cache is available; run map analysis separately.');
    } catch { warnings.push('OSM cache validation failed; research continues independently.'); }
  }
  update('planning', 'running', 'Validating business description and geographic scope.');
  let queries = [`${request.description} ${cities[request.scope.cityId].label} competitors`];
  if (request.localOnly) {
    const distinct = shortlist.filter((b, index, all) => all.findIndex(x => normalizedName(x.name) === normalizedName(b.name)) === index).slice(0, 3);
    queries = distinct.map(b => `"${businessNames(b.name).at(-1)}" ${cities[request.scope.cityId].label} official website menu`);
    update('planning', shortlist.length ? 'complete' : 'unavailable', shortlist.length ? `Ranked ${shortlist.length} named mapped features: 80% relevance, 20% proximity. Researching the top ${distinct.length} distinct business names.` : 'No named mapped candidates available for this category and radius. Try map analysis or adjust the area; no city-wide substitutes are used.');
  } else try {
    const plan = await runAgent('researcher', 'planning', { description: request.description, goals: request.goals, city: cities[request.scope.cityId].label }, searchPlanSchema);
    queries = plan.queries.map(q => `${q} ${cities[request.scope.cityId].label}`);
    update('planning', 'complete', 'Search researcher prepared a focused discovery query.');
  } catch (e) { failed('planning', e); warnings.push('Search planning unavailable; using the business description and city directly.'); }

  // Two independent branches; sequential search queries keep total upstream concurrency <= 2.
  const webTask = async () => {
      update('web', 'running', 'Researching competitors and customer feedback.');
      let failures = 0;
      for (const query of queries) {
        try { evidence.push(...await webSearch(query, config, signal, transport)); }
        catch (e) {
          if (!request.localOnly && e instanceof ProviderFailure && ['no_results', 'unusable_sources'].includes(e.code)) {
            update('web', 'running', `Search returned ${e.code}; trying one broader city search.`);
            try { evidence.push(...await webSearch(`${request.description} ${cities[request.scope.cityId].label}`, config, signal, transport)); }
            catch (retryError) { failures++; failed('web', retryError); }
          } else { failures++; failed('web', e); }
          if (!request.localOnly) break;
        }
      }
      evidence = [...new Map(evidence.map(e => [e.id, e])).values()];
      let web = evidence.filter(e => e.provider === 'tavily');
      if (request.localOnly) {
        const eligible = web.filter(e => businessSourceAllowed(e, shortlist.slice(0, 20).map(b => b.name)));
        if (eligible.length < web.length) warnings.push(`${web.length - eligible.length} news, roundup or unrelated sources excluded from business research.`);
        // Round-robin sources across the best candidates so one business cannot consume every slot.
        const selected: Evidence[] = [];
        for (let round = 0; round < 2; round++) for (const candidate of shortlist.filter((b, i, all) => all.findIndex(x => normalizedName(x.name) === normalizedName(b.name)) === i).slice(0, 3)) {
          const matches = eligible.filter(e => businessSourceAllowed(e, [candidate.name]));
          const source = matches[round]; if (source && !selected.some(e => e.id === source.id)) selected.push(source);
        }
        web = selected.slice(0, config.sources);
        evidence = [...evidence.filter(e => e.provider !== 'tavily'), ...web];
      } else web = web.slice(0, config.sources);
      if (!web.length) { if (!failures) update('web', 'partial', 'No usable web sources found; absence is not evidence of no competitors.'); return; }
      try {
        const documentsFor = (sources: Evidence[]) => sources.map(({ excerpt, ...source }) => ({ ...source, quotes: numberedQuotes({ ...source, excerpt }, request.description) }));
        const researchedBusinesses: string[] = request.localOnly ? [...new Set(shortlist.slice(0, 20).map(b => b.name))] : [];
        const sourceKinds = new Map<string, string>();
        if (request.localOnly) {
          update('web', 'running', 'Researcher is checking that each source describes a shortlisted business.');
          const qualification = await runAgent('researcher', 'source qualification', { businesses: researchedBusinesses, documents: documentsFor(web), instructions: 'Classify every supplied source. Accept only an official business website/location/menu, dedicated business directory listing, or dedicated business review page for a supplied name. Reject news, editorial roundups, blogs, generic directories, software-vendor case studies, tours, and unrelated businesses. A passing mention is insufficient. Return sourceId, exact listed business name, and kind. Do not infer physical branch identity from a brand page.' }, sourceQualificationSchema);
          web = web.filter(e => {
            const decisions = qualification.sources.filter(s => s.sourceId === e.id);
            if (decisions.length === 1) sourceKinds.set(e.id, decisions[0].kind);
            return decisions.length === 1 && decisions[0].kind !== 'reject' && businessSourceAllowed(e, researchedBusinesses);
          });
          evidence = [...evidence.filter(e => e.provider !== 'tavily'), ...web];
          if (!web.length) { update('web', 'partial', 'No business-specific web sources passed qualification. The mapped shortlist is still available.'); return; }
          evidence = [...evidence.filter(e => e.provider !== 'tavily'), ...web];
        }
        if (!request.localOnly) try {
          const discoveryDocuments = documentsFor(web);
          const discovered = await runAgent('researcher', 'competitor discovery', { request, documents: discoveryDocuments, instructions: 'Select one relevant named business for focused website and review research. If the request names a particular business, prioritize that exact identity. Each name must occur verbatim in its source excerpt; cite an existing sourceId and quoteId containing the name. Return its name as a plain string. Do not invent identities. Exact radius membership remains unknown.' }, discoverySchema);
          const seenNames = new Set<string>();
          for (const candidate of discovered.businesses) {
            const source = web.find(e => e.id === candidate.sourceId);
            const selectedQuote = discoveryDocuments.find(e => e.id === candidate.sourceId)?.quotes.find(q => q.id === candidate.quoteId);
            const name = candidate.name.toLowerCase();
            if (!source || !selectedQuote || !source.excerpt.toLowerCase().includes(name) || seenNames.has(name)) continue;
            seenNames.add(name);
            researchedBusinesses.push(candidate.name);
            update('web', 'running', `Researching ${candidate.name}: website, offerings, prices and accessible customer feedback.`);
            const detailQueries = [`"${candidate.name}" ${cities[request.scope.cityId].label} official website menu offerings prices`, `"${candidate.name}" ${cities[request.scope.cityId].label} customer reviews experience complaints service`];
            for (const query of detailQueries) {
              try {
                const details = await webSearch(query, { ...config, sources: Math.min(3, config.sources) }, signal, transport);
                web = [...new Map([...web, ...details].map(e => [e.id, e])).values()].slice(-config.sources);
              } catch { failures++; warnings.push('Individual business research was partly unavailable; available discovery sources are retained.'); break; }
            }
          }
          if (!seenNames.size) warnings.push('No business identity could be confirmed for individual follow-up; findings use the available discovery sources.');
        } catch { failures++; warnings.push('Individual competitor discovery was unavailable; continuing with retrieved sources.'); }
        update('web', 'running', 'Website extractor is reading up to three discovered pages.');
        try { web = await readDiscoveredPages(web, config, signal, transport, (requested, read) => {
          if (read < requested) { failures++; warnings.push(`Website extraction read ${read} of ${requested} requested pages; available search excerpts retained for the others.`); }
        }); }
        catch (e) { failures++; warnings.push(`Page reading: ${e instanceof ProviderFailure ? e.code : 'invalid or unavailable response'}. Search excerpts retained.`); }
        evidence = [...evidence.filter(e => e.provider !== 'tavily'), ...web];
        const documents = documentsFor(web);
        const extracted = await runAgent('extractor', 'web and review extraction', { request, researchedBusinesses, documents, localOnly: request.localOnly, sourceRules: 'Use only official business/location/menu pages or a dedicated business listing/review page. Exclude news, blogs, roundups, software vendors, tours, generic directories and unrelated branches. Never transfer chain-wide reviews to a specific branch. Balance observations across businesses and prioritize offerings and prices over repetitive praise.',
          instructions: 'Select at most 6 useful source excerpts. Prioritize the individually researchedBusinesses and their own websites/contact/menu pages; include identity/address, offerings, public prices and accessible feedback when available. Other businesses may supply clearly labeled context. Return only sourceId, quoteId, business (plain name string or null), kind and relation for each finding. Use existing IDs from documents. Do not write or paraphrase quotes; code copies the exact selected text. Set business only when that name appears in the source. Price opinions belong under feedback, not publicly listed prices. Do not infer review counts, recurring themes, demand or exact radius membership. Put missing evidence in unknowns. Never force a price/review finding when none was retrieved.' }, extractionSchema);
        const seenQuotes = new Set<string>();
        const resolved: Finding[] = extracted.findings.flatMap(f => {
          const source = web.find(e => e.id === f.sourceId), quote = documents.find(e => e.id === f.sourceId)?.quotes.find(q => q.id === f.quoteId);
          const identity = `${f.sourceId}:${quote?.text}`;
          if (!source || !quote || seenQuotes.has(identity) || !supportsObservationKind(f.kind, quote.text)) return [];
          if (request.localOnly && f.kind === 'price' && sourceKinds.get(source.id) !== 'official-business') return [];
          seenQuotes.add(identity);
          const matched = request.localOnly && f.business ? shortlist.find(b => businessNames(b.name).some(alias => ` ${normalizedName(f.business!)} `.includes(` ${alias} `))) : undefined;
          const business = matched && businessSourceAllowed({ ...source, excerpt: quote.text }, [matched.name]) ? matched.name : f.business && `${source.title}\n${quote.text}`.toLowerCase().includes(f.business.toLowerCase()) ? f.business : null;
          if (request.localOnly && (!business || !shortlist.some(b => normalizedName(b.name) === normalizedName(business)) || !businessSourceAllowed(source, [business]))) return [];
          return [findingSchema.parse({ id: `f${extracted.findings.indexOf(f) + 1}`, claim: quote.text, kind: f.kind, relation: f.relation, business,
            evidence: [{ sourceId: source.id, quote: quote.text }], geographicRelevance: request.localOnly ? 'Business name matches a mapped candidate in the radius. This web page may refer to another branch or the whole brand; web claims require branch confirmation.' : `Retrieved for ${cities[request.scope.cityId].label}; exact location, branch identity and radius membership require confirmation.`,
            limitations: ['Source assertion, not independently established business quality. Confirm current details and branch identity.', ...(business ? [] : ['Business identity could not be matched to a name in this source.'])], reviewSampleSize: null, reviewDates: null })];
        });
        findings.push(...groundedFindings(resolved, web)); unknowns.push(...extracted.unknowns);
        const removed = findings.length !== extracted.findings.length;
        if (removed) warnings.push('Unsupported excerpt selections, duplicate observations or contact/navigation text were rejected.');
        update('web', failures || removed || !findings.length ? 'partial' : 'complete', 'Retrieved web evidence processed; coverage remains unknown.');
      } catch (e) { failed('web', e); }
    };
  const mapsTask = async () => {
      if (!request.includeMaps) { update('maps', 'skipped', 'Google Maps research was not requested.'); return; }
      update('maps', 'running', 'Gathering location context using Google Maps.');
      try {
        const maps = await mapsResearch(request, config, signal, transport); evidence.push(...maps);
        update('maps', maps.length ? 'complete' : 'partial', maps.length ? 'Cited Google Maps context retrieved; exact radius membership is unverified.' : 'No cited Maps context returned.');
      } catch (e) { failed('maps', e); }
    };
  if (config.concurrency === 1) { await webTask(); await mapsTask(); }
  else await Promise.all([webTask(), mapsTask()]);
  evidence = [...new Map(evidence.map(e => [e.id, e])).values()].slice(0, 16);
  findings = groundedFindings(findings, evidence);
  // Maps text remains visibly attributed provider context, not a fabricated OSM feature or coordinate.
  update('insights', 'running', 'Developing business insights.');
  if (findings.length && config.timeoutMs - (Date.now() - startedMs) < Math.min(45000, config.timeoutMs * 0.45)) {
    update('insights', 'partial', 'The remaining time is reserved for checking source observations; insights were not generated.');
    warnings.push('Slow provider responses reduced this run to source observations; business insights were skipped to reserve verification time.');
  } else if (findings.length) {
    try {
      const proposed = await runAgent('analyst', 'business insights', { request, findings, osmContext, mapContext: evidence.filter(e => e.provider === 'google-maps'), instructions: 'Return at most 3 concise insights, with one short sentence for each field. Use ONLY the supplied finding IDs as support; OSM node/way IDs are never finding IDs. Never introduce numerical prices, sales estimates, competitor offerings or baselines that are absent from supplied findings. Findings with unknown review provenance are commentary, possibly business-authored; never describe them as evidence of customer behaviour or recurring customer sentiment. Contact details are not reviews. Insights are interpretations, hypotheses or experiments, never observed facts. OSM context is a separate dated mapped-feature count, never a competitor census. Do not infer demand or profitability from competitor counts. State conflicting evidence and validation needed.' }, synthesisSchema);
      insights = proposed.insights.filter((i, index, all) => all.findIndex(x => x.id === i.id) === index && i.findingIds.every(id => findings.some(f => f.id === id)));
      update('insights', insights.length === proposed.insights.length && insights.length ? 'complete' : 'partial', 'Business hypotheses prepared for evidence review.');
    } catch (e) { failed('insights', e); }
  } else update('insights', 'unavailable', 'Insufficient supported findings for business insights.');
  update('verification', 'running', 'Checking supporting evidence.');
  if (findings.length) {
    try {
      const citedEvidence = evidence.flatMap(({ excerpt: _excerpt, ...source }) => {
        const quotes = findings.flatMap(f => f.evidence.filter(ref => ref.sourceId === source.id).map(ref => ref.quote));
        return quotes.length ? [{ ...source, quotes: [...new Set(quotes)] }] : [];
      });
      const review = await runAgent('verifier', 'evidence verification', { request, evidence: citedEvidence, findings, insights, osmContext, sourceRules: 'Reject news, roundups, software-vendor material and generic editorial content. Accept only actual business pages or dedicated business listings/reviews. Web name matches do not prove branch identity. Do not attach brand-wide reviews to a local branch.',
        reviewTargets: { findingIds: findings.map(f => f.id), insightIds: insights.map(i => i.id) },
        instructions: 'Return EXACTLY the top-level keys findings and insights, containing id, supported (boolean), reason decisions for every review target. Findings are explicitly labeled SOURCE OBSERVATIONS, not independently established business quality. A verbatim quote with valid identity/citation and stated limitations IS supported as a source observation. One reviewer opinion is supported as an individual excerpt without sample count or date; reject only if it is generalized into a recurring/representative theme or treated as a fact it does not establish. Do not require independent corroboration, sales, footfall or survey data merely to display a quoted source assertion. Source marketing claims must remain source assertions, never independent rankings. Reject invented facts, mismatched business identities, precise geography without evidence, subjective price opinions labeled as actual menu prices, and contradictions. Insights are interpretations/hypotheses/experiments: an explicitly uncertain suggested local validation step does not need proven demand or causality. Reject insights that state unsupported factual premises or promise outcomes. Return a decision for every finding and insight ID; omit none.' }, reviewSchema);
      const accepted = (rows: typeof review.findings, id: string) => rows.filter(r => r.id === id).length === 1 && rows.find(r => r.id === id)?.supported === true;
      const before = findings.length + insights.length;
      findings = groundedFindings(findings.filter(f => accepted(review.findings, f.id)), evidence);
      insights = insights.filter(i => accepted(review.insights, i.id) && i.findingIds.every(id => findings.some(f => f.id === id)));
      const rejected = before - findings.length - insights.length;
      if (rejected) warnings.push(`${rejected} unsupported or weakly supported findings/insights removed by verification.`);
      update('verification', rejected || !findings.length ? 'partial' : 'complete', 'Evidence references and exact quotes checked in code; claim support reviewed by NVIDIA.');
    } catch (e) {
      failed('verification', e); findings = []; insights = [];
      warnings.push('Unreviewed generated claims withheld. Retrieved sources remain inspectable.');
    }
  } else update('verification', 'unavailable', 'No extracted findings to verify; sources remain unverified context.');
  update('reporting', 'running', 'Report editor is preparing verified observations and experiments.');
  if (findings.length && !signal.aborted && requestCount < config.requests) {
    try {
      const ordered = await runAgent('writer', 'report preparation', { goals: request.goals, findings, insights }, editorialSchema);
      const orderedFindings = orderVerified(findings, ordered.findingIds);
      const orderedInsights = orderVerified(insights, ordered.insightIds);
      findings = orderedFindings; insights = orderedInsights;
      update('reporting', 'complete', 'Report editor arranged verified records; citations and limitations are preserved.');
    } catch (e) { failed('reporting', e); warnings.push('Report editing unavailable; verified records are presented in their original order.'); }
  } else update('reporting', findings.length ? 'partial' : 'unavailable', findings.length ? 'Report editing skipped at the run limit; verified records retained.' : 'No verified observations available to prepare a report.');
  unknowns.push('Web search is not an exhaustive competitor census. Exact radius membership and duplicate identities require local validation.', 'Reviews reflect only accessible retrieved samples. Missing prices, review dates or sample sizes remain unknown.', osmContext ? 'OSM context retains its original date and mapped-feature meaning; external businesses never change these counts.' : 'OSM map analysis is separate; no validated OSM context is included in this report.');
  unknowns.push(request.localOnly ? 'The shortlist includes named mapped features in the chosen category and radius. Coverage is unknown; duplicate OSM objects may represent one business. Only the top three distinct names receive web enrichment. Relevance uses category and text matches, not measured business quality.' : 'This bounded run investigates one named business in depth; it does not research every competitor in the selected area.');
  const identities = new Map<string, Set<string>>();
  for (const f of findings) if (f.business) {
    const name = f.business.toLowerCase().trim();
    const ids = identities.get(name) ?? new Set<string>(); f.evidence.forEach(e => ids.add(e.sourceId)); identities.set(name, ids);
  }
  if ([...identities.values()].some(ids => ids.size > 1)) unknowns.push('Matching business names occur across sources. These are candidate identity matches, not confirmed duplicate businesses; source records remain separate.');
  const stageList = stages.map(s => state.get(s)!);
  const status = !evidence.length ? (shortlist.length ? 'partial' : 'unavailable') : findings.length && stageList.every(s => ['complete', 'skipped'].includes(s.status)) ? 'complete' : 'partial';
  const report = { request, status, startedAt, evidence, findings, insights, stages: stageList, warnings, unknowns, osmContext, agentRuns, shortlist };
  // A provider may echo input; strip credential values before any report can leave the server.
  let serialized = JSON.stringify(report);
  for (const key of [config.nvidiaKey, config.tavilyKey, ...config.mapsKeys.map(k => k.key)]) if (key) serialized = serialized.split(key).join('[redacted]');
  return reportSchema.parse(JSON.parse(serialized));
}

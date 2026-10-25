import { z } from 'zod';
import { analyze } from './analyze';
import { businessNames, businessSourceAllowed, normalizedName, shortlistBusinesses, businessQualifiers, localBusinessQuery, sourceCategoryAllowed, type ShortlistedBusiness } from '../lib/business-shortlist';
import { cities } from '../lib/cities';
import { categories } from '../lib/categories';
import {groundedImpacts,impactExplanation,assessmentHasUnsupportedFacts} from '../lib/business-impact';
import { findingSchema, impactSchema, assessmentSchema, reportSchema, researchRequestSchema, stages, type Evidence, type Finding, type ResearchRequest, type ResearchReport, type Stage } from '../lib/research-contracts';
import { ProviderFailure, readDiscoveredPages, researchConfig, webSearch, type Config, type Transport } from './research-providers';
import { agentRunner, searchPlanSchema, type AgentRun } from './research-agents';
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
  if(['offering','price'].includes(kind)&&/\b(?:free shipping|shipping on|shipping over|minimum order|delivery fee|delivery charge|sign up|subscribe|cookie policy|privacy policy|terms of use)\b/i.test(text))return false;
  if(kind==='offering')return text.trim().split(/\s+/).length>=3&&/\b(?:offers?|serves?|sells?|speciali[sz]es?|provides?|features?|coffee|espresso|latte|pastries|bread|breakfast|clothing|apparel|fashion|garments|footwear|books|software|haircuts?|fitness|groceries|flowers|dental|medical|legal|accounting|repairs?|rooms|workspace|services?|products?)\b/i.test(text);
  if (kind === 'price') return !/\b(?:reviewers?|reviewed|paid|I paid|per person|plus tip|about|around|approximately)\b/i.test(text) && /(?:[$£€¥₹]\s*\d|\d[\d,.]*\s*(?:USD|GBP|EUR|AED|SGD|dollars?|pounds?|euros?)\b)/i.test(text);
  if (kind === 'feedback') return text.trim().split(/\s+/).length >= 3 && !/^(?:reviews?\s+(?:for|of)\b|reviews?\s*[.:]?$|write a review|no reviews?\b|be the first to review|prices may|prices and availability|prices? (?:may|can) vary|all rights reserved)/i.test(text.trim()) && /\b(?:love[ds]?|hate[ds]?|liked?|disliked?|enjoy(?:ed)?|delicious|tast(?:e|es|ed|y)|friendly|rude|slow|quick|fast|excellent|amazing|terrible|overpriced|disappoint(?:ed|ing)|recommend(?:ed)?|wait(?:ed|ing)?|queue|helpful|unhelpful|fresh|stale|best|worst|good|bad|quality|service|experience|value|flavou?r)\b/i.test(text);
  return true;
}
const synthesisSchema = z.object({ impacts:z.array(impactSchema).max(3), assessment:assessmentSchema }).strict();
const reviewSchema = z.object({ findings: z.array(z.object({ id: z.string(), supported: z.boolean(), reason: z.string().min(1).max(2000) }).strict()).max(24), insights: z.array(z.object({ id: z.string(), supported: z.boolean(), reason: z.string().min(1).max(2000) }).strict()).max(8), assessmentSupported:z.boolean().default(false),assessmentReason:z.string().max(1000).default('') }).strict();

export function numberedQuotes(source: Evidence, description: string) {
  const terms = description.toLowerCase().split(/\W+/).filter(t => t.length > 3);
  return source.excerpt.split('\n').flatMap(line => line.split(/(?<=[.!?])\s+(?=[A-Z])/)).map((line, index) => ({ id: `${source.id}-q${index}`, text: line.trim().slice(0, 240), index }))
    .filter(q => q.text.length >= 12)
    .map(q => ({ ...q, score: terms.reduce((n, term) => n + Number(q.text.toLowerCase().includes(term)), 0) + (/\b(?:offers?|serves?|sells?|provides?|speciali[sz]es?|espresso|latte|pastries|clothing|apparel|software|haircut|fitness|products?|services?)\b/i.test(q.text) ? 4 : 0) - (/free shipping|subscribe|privacy|cookie|sign up/i.test(q.text)?10:0) }))
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
  const retrievalAgent=agentRunner(config,signal,transport,run=>agentRuns.push(run));
  const reasoningAgent=agentRunner({...config,model:config.judgmentModel},signal,transport,run=>agentRuns.push(run));
  const runAgent:typeof retrievalAgent=(role,task,input,schema)=>(role==='analyst'||role==='verifier'?reasoningAgent:retrievalAgent)(role,task,input,schema);
  const state = new Map<Stage['stage'], Stage>();
  const update = (stage: Stage['stage'], status: Stage['status'], message: string) => { const s = { stage, status, message }; state.set(stage, s); options.onStage?.(s); };
  const failed = (stage: Stage['stage'], error: unknown) => {
    const code = error instanceof ProviderFailure ? error.code : signal.aborted ? 'deadline' : 'invalid or unavailable response';
    const retry = error instanceof ProviderFailure && error.retryAfterSeconds ? ` Retry after at least ${error.retryAfterSeconds} seconds.` : '';
    update(stage, 'unavailable', `${stage}: ${code}.${retry}`); warnings.push(`${stage}: ${code}.${retry}`);
  };
  let evidence: Evidence[] = [], findings: Finding[] = [], insights: ResearchReport['insights'] = [];
  let impacts:ResearchReport['impacts']=[],assessment:ResearchReport['assessment']=null;
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
    queries = distinct.map(b => localBusinessQuery(businessNames(b.name).at(-1)!, b.categoryId, cities[request.scope.cityId].label, request.description));
    const qualifiers = businessQualifiers(request.description, request.osmRequest!.categoryId);
    if (qualifiers.length) unknowns.push(`Business specialty requirements (${qualifiers.join(', ')}) are not established by the broad mapped category. These features are potential alternatives, not verified specialty competitors.`);
    update('planning', shortlist.length ? 'complete' : 'unavailable', shortlist.length ? `Ranked ${shortlist.length} named mapped features: Ordered by mapped category, explicit specialty text and distance; this is not a confidence score. Researching the top ${distinct.length} distinct business names.` : 'No named mapped candidates available for this category and radius. Try map analysis or adjust the area; no city-wide substitutes are used.');
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
        const eligible = web.filter(e => sourceCategoryAllowed(e, request.osmRequest!.categoryId) && businessSourceAllowed(e, shortlist.slice(0, 20).map(b => b.name)));
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
        const sourceBusinesses = new Map<string, string>();
        if (request.localOnly) {
          update('web', 'running', 'Researcher is checking that each source describes a shortlisted business.');
          const qualificationContract=sourceQualificationSchema.extend({sources:z.array(z.object({sourceId:z.enum(web.map(e=>e.id) as [string,...string[]]),business:z.enum(researchedBusinesses as [string,...string[]]).nullable(),kind:z.enum(['official-business','business-listing','business-reviews','reject'])}).strict()).max(8)});
          const qualification = await runAgent('researcher', 'source qualification', { businessDescription: request.description, mappedCategory: categories[request.osmRequest!.categoryId].label, businesses: researchedBusinesses, documents: web.map(e=>({id:e.id,url:e.url,title:e.title,excerpt:e.excerpt.slice(0,3000)})), instructions: 'Classify every supplied source. Accept only an official business website/location/menu, dedicated business directory listing, or dedicated business review page for a supplied name. Reject news, editorial roundups, blogs, generic directories, software-vendor case studies, tours, and unrelated businesses. A passing mention is insufficient. Reject a same-name business in a different industry. A generic clothing shop does not establish desi or South Asian offerings. Return sourceId equal to the document id, NOT a quote id. Choose business ONLY from the supplied exact business-name enum; never add an address, branch, parentheses or descriptive suffix. Use null for a rejected source. Return kind and do not infer physical branch identity from a brand page.' }, qualificationContract).catch(error=>{evidence=evidence.filter(e=>e.provider!=='tavily');throw error;});
          web = web.filter(e => {
            const decisions = qualification.sources.filter(s => s.sourceId === e.id);
            if (decisions.length === 1) { sourceKinds.set(e.id, decisions[0].kind); if (decisions[0].business) sourceBusinesses.set(e.id, decisions[0].business); }
            return decisions.length === 1 && decisions[0].kind !== 'reject' && Boolean(decisions[0].business && researchedBusinesses.some(name => normalizedName(name) === normalizedName(decisions[0].business!))) && businessSourceAllowed(e, [decisions[0].business!]) && sourceCategoryAllowed(e, request.osmRequest!.categoryId);
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
        if (request.localOnly) web = web.filter(e => sourceCategoryAllowed(e, request.osmRequest!.categoryId) && businessSourceAllowed(e, [sourceBusinesses.get(e.id) ?? '']));
        evidence = [...evidence.filter(e => e.provider !== 'tavily'), ...web];
        if (!web.length) { update('web', 'partial', 'No sources retained category and business identity evidence after page extraction.'); return; }
        const documents = documentsFor(web);
        const extractionContract=extractionSchema.extend({findings:z.array(extractionFindingSchema.extend({sourceId:z.enum(web.map(e=>e.id) as [string,...string[]]),quoteId:z.enum(documents.flatMap(e=>e.quotes.map(q=>q.id)) as [string,...string[]]),business:researchedBusinesses.length?z.enum(researchedBusinesses as [string,...string[]]).nullable():z.string().nullable()})).max(6)});
        const extracted = await runAgent('extractor', 'web and review extraction', { request, researchedBusinesses, documents, localOnly: request.localOnly, sourceRules: 'Use only official business/location/menu pages or a dedicated business listing/review page. Exclude news, blogs, roundups, software vendors, tours, generic directories and unrelated branches. Never transfer chain-wide reviews to a specific branch. Balance observations across businesses and prioritize actual products/services. Exclude shipping promotions, discount thresholds, contact details and navigation headings.',
          instructions: 'Select at most 6 useful source excerpts, prioritizing at least one concrete product/service offering per researched business when available. Do not select shipping, generic promotions or contact/navigation text as products or prices. Prioritize the individually researchedBusinesses and their own websites/contact/menu pages; prioritize concrete products and services so their overlap with the user proposal can be assessed; identity/address is supporting context only. Other businesses may supply clearly labeled context. Return only sourceId, quoteId, business (plain name string or null), kind and relation for each finding. Use existing IDs from documents. Do not write or paraphrase quotes; code copies the exact selected text. Set business only when that name appears in the source. Price opinions belong under feedback, not publicly listed prices. Do not infer review counts, recurring themes, demand or exact radius membership. Put missing evidence in unknowns. Never force a price/review finding when none was retrieved.' }, extractionContract);
        const seenQuotes = new Set<string>();
        const resolved: Finding[] = extracted.findings.flatMap(f => {
          const source = web.find(e => e.id === f.sourceId), quote = documents.find(e => e.id === f.sourceId)?.quotes.find(q => q.id === f.quoteId);
          const identity = `${f.sourceId}:${quote?.text}`;
          if (!source || !quote || seenQuotes.has(identity) || !supportsObservationKind(f.kind, quote.text)) return [];
          const nameOffset=f.business?quote.text.toLowerCase().indexOf(f.business.toLowerCase()):-1;
          const offeringText=nameOffset>=0?quote.text.slice(0,nameOffset)+quote.text.slice(nameOffset+f.business!.length):quote.text;
          const kind=f.kind==='competitor'&&supportsObservationKind('offering',offeringText)?'offering':f.kind;
          if (request.localOnly && kind === 'price' && sourceKinds.get(source.id) !== 'official-business') return [];
          seenQuotes.add(identity);
          const matched = request.localOnly && f.business ? shortlist.find(b => businessNames(b.name).some(alias => ` ${normalizedName(f.business!)} `.includes(` ${alias} `))) : undefined;
          const business = matched && businessSourceAllowed({ ...source, excerpt: quote.text }, [matched.name]) ? matched.name : f.business && `${source.title}\n${quote.text}`.toLowerCase().includes(f.business.toLowerCase()) ? f.business : null;
          if (request.localOnly && (!business || normalizedName(sourceBusinesses.get(source.id) ?? '') !== normalizedName(business) || !shortlist.some(b => normalizedName(b.name) === normalizedName(business)) || !businessSourceAllowed(source, [business]))) return [];
          return [findingSchema.parse({ id: `f${extracted.findings.indexOf(f) + 1}`, claim: quote.text, kind, relation: request.localOnly ? 'context' : f.relation, business,
            evidence: [{ sourceId: source.id, quote: quote.text }], geographicRelevance: request.localOnly ? 'Business name matches a mapped candidate in the radius. This web page may refer to another branch or the whole brand; web claims require branch confirmation.' : `Retrieved for ${cities[request.scope.cityId].label}; exact location, branch identity and radius membership require confirmation.`,
            limitations: ['Source assertion, not independently established business quality. Confirm current details and branch identity.', ...(business ? [] : ['Business identity could not be matched to a name in this source.'])], reviewSampleSize: null, reviewDates: null })];
        });
        findings.push(...groundedFindings(resolved, web)); unknowns.push(...extracted.unknowns);
        const removed = findings.length !== extracted.findings.length;
        if (removed) warnings.push('Unsupported excerpt selections, duplicate observations or contact/navigation text were rejected.');
        update('web', failures || removed || !findings.length ? 'partial' : 'complete', 'Retrieved web evidence processed; coverage remains unknown.');
      } catch (e) { failed('web', e); }
    };
  await webTask();
  evidence = [...new Map(evidence.map(e => [e.id, e])).values()].slice(0, 16);
  findings = groundedFindings(findings, evidence);
  update('insights', 'running', 'Assessing how the sourced businesses could affect yours.');
  if(findings.length&&config.timeoutMs-(Date.now()-startedMs)<20000){
   update('insights','partial','The remaining time is reserved for checking source observations; the opening judgment was not generated.');
  }else if(findings.some(f=>f.business&&['offering','price'].includes(f.kind))){
   try{
    const offeringFindings=findings.filter(f=>f.business&&['offering','price'].includes(f.kind));
    const impactContract=synthesisSchema.extend({assessment:assessmentSchema.extend({verdict:z.enum(['recommended','not-recommended']),reasoning:z.string().trim().min(1).max(600)}),impacts:z.array(impactSchema.extend({business:z.enum([...new Set(offeringFindings.map(f=>f.business!))] as [string,...string[]]),yourOffering:z.enum([request.description]),competitorOffering:z.enum([...new Set(offeringFindings.flatMap(f=>f.evidence.map(e=>e.quote)))] as [string,...string[]]),findingIds:z.array(z.enum(offeringFindings.map(f=>f.id) as [string,...string[]])).min(1).max(4)})).max(3)});
    const proposed=await runAgent('analyst','business impact assessment',{request,findings,instructions:'Give a practical preliminary screening decision: would you recommend exploring this site further for this business, or recommend against it on competitive-positioning grounds? This is an opinion under disclosed assumptions, not a financial-feasibility certification. Compare each sourced business with the EXACT user business description. Return up to 3 impacts and one opening assessment. Impacts select an existing business name and findingIds; yourOffering must be an exact substring of the user description, competitorOffering an exact substring of a cited quote. Choose competition only for overlapping offerings; complement is an uncertain crossover hypothesis, limited-overlap means different evidenced offerings, unclear when unsupported. Never equate a broad map category with specialty competition. Choose recommended or not-recommended using these sourced offerings and their competitive implications. A useful offering comparison is already available; do not abstain merely because information is incomplete. This is your provisional judgment, not a forecast. Explain it in one short sentence, under 40 words, without numerical counts, distances or sales estimates; cite existing findingIds and list up to 3 concrete missing-evidence risks. Do not invent rent, demand, footfall, customer preferences, reputation, sales, profitability or prices. No address-only insights. Assess competitive positioning, not proven profitability. When sourced offerings permit a meaningful comparison, give your best Recommended or Not recommended judgment, even if provisional. Missing rent, demand, footfall or exact branch confirmation belong in risks and do not by themselves require insufficient-evidence. State uncertainty in risks, while still giving your best screening judgment. A different specialty may support a conditional differentiation hypothesis, but never proves an empty niche or absence of competitors. Do not call the user description too narrow to assess: use it as the proposal being judged. Choose full offering text verbatim from the allowed enums; never paraphrase those fields. The supplied findings are a small evidence sample, NOT all competitors. Never infer that only one business exists or that competitors are absent from the number of retrieved findings. Do not output generic business plans or experiments.'},impactContract);
    impacts=groundedImpacts(proposed.impacts,findings,request);
    insights=impacts.map((i,index)=>({id:`i${index+1}`,kind:'interpretation' as const,recommendation:`${i.business}: ${impactExplanation(i,request)}`,findingIds:i.findingIds,reasoning:`Your proposal: ${i.yourOffering}. Sourced offering: ${i.competitorOffering}.`,uncertainty:'Branch identity and actual customer or sales impact are unverified.',validation:'Confirm this offering at the local branch.'}));
    const judgment=proposed.assessment;
    if(!assessmentHasUnsupportedFacts(judgment,findings)&&judgment.findingIds.every(id=>findings.some(f=>f.id===id))&&judgment.findingIds.some(id=>impacts.some(i=>i.findingIds.includes(id))))assessment=judgment;
    update('insights',assessment&&impacts.length===proposed.impacts.length?'complete':'partial','Business effects and a provisional opening judgment prepared for evidence review.');
   }catch(e){failed('insights',e);}
  }else update('insights','unavailable','No supported business offerings are available to assess competitive effects.');
  update('verification', 'running', 'Checking supporting evidence.');
  if (findings.length) {
    try {
      const citedEvidence = evidence.flatMap(({ excerpt: _excerpt, ...source }) => {
        const quotes = findings.flatMap(f => f.evidence.filter(ref => ref.sourceId === source.id).map(ref => ref.quote));
        return quotes.length ? [{ ...source, quotes: [...new Set(quotes)] }] : [];
      });
      const review = await runAgent('verifier', 'evidence verification', { request, evidence: citedEvidence, findings, insights, assessment, impacts, sourceRules: 'Reject news, roundups, software-vendor material and generic editorial content. Accept only actual business pages or dedicated business listings/reviews. Web name matches do not prove branch identity. Do not attach brand-wide reviews to a local branch.',
        reviewTargets: { findingIds: findings.map(f => f.id), insightIds: insights.map(i => i.id) },
        instructions: 'Return EXACTLY the top-level keys findings, insights, assessmentSupported (boolean) and assessmentReason (a short explanation of approval or the exact unsupported factual premise), containing id, supported (boolean), reason decisions for every review target. Findings are explicitly labeled SOURCE OBSERVATIONS, not independently established business quality. A verbatim quote with valid identity/citation and stated limitations IS supported as a source observation. One reviewer opinion is supported as an individual excerpt without sample count or date; reject only if it is generalized into a recurring/representative theme or treated as a fact it does not establish. Do not require independent corroboration, sales, footfall or survey data merely to display a quoted source assertion. Source marketing claims must remain source assertions, never independent rankings. Reject invented facts, mismatched business identities, precise geography without evidence, subjective price opinions labeled as actual menu prices, and contradictions. Insights are interpretations/hypotheses/experiments: an explicitly uncertain suggested local validation step does not need proven demand or causality. Reject insights that state unsupported factual premises or promise outcomes. Assess the opening judgment as a provisional opinion, not a proven outcome: assessmentSupported must be false if the reasoning invents a factual premise, ignores the specialty, relies only on map counts, or cites unrelated offerings. Recommended/Not recommended is a conditional opinion on competitive positioning, not proof that a business will succeed. The verdict means explore further versus pass based on preliminary competitive positioning, not permission to sign a lease. Approve a plausible conditional judgment grounded in the cited offering comparisons; do not reject it merely because rent, demand, footfall or exact branch identity remain unknown and are disclosed as risks. Reject actual unsupported factual premises, not ordinary uncertainty. Return a decision for every finding and insight ID; omit none.' }, reviewSchema);
      if(!review.assessmentSupported&&assessment&&impacts.length&&requestCount+2<=config.requests&&!signal.aborted&&config.timeoutMs-(Date.now()-startedMs)>15000){
       try{
        const acceptedFindings=findings.filter(f=>review.findings.filter(r=>r.id===f.id&&r.supported).length===1);
        const revised=await runAgent('analyst','revise opening judgment',{request,original:assessment,review:review.assessmentReason,findings:acceptedFindings,impacts,instructions:'Revise the judgment once to remove unsupported premises. Give Recommended or Not recommended as a preliminary competitive-positioning opinion, not proof of profitability. Explain in one short complete sentence. General clothing does NOT establish direct desi competition; a different documented style does NOT prove an empty niche. Describe broad competition as possible and differentiation as conditional. Do not assert absent competitors, exact local branch identity, unmeasured demand, rent, footfall, market size or sales. Use only existing accepted findingIds and list unknowns as risks. You may change the verdict if correcting the premise changes your judgment.'},assessmentSchema.extend({verdict:z.enum(['recommended','not-recommended'])}));
        if(!assessmentHasUnsupportedFacts(revised,acceptedFindings)&&revised.findingIds.length&&revised.findingIds.every(id=>acceptedFindings.some(f=>f.id===id))&&revised.findingIds.some(id=>impacts.some(i=>i.findingIds.includes(id)))){
         const checked=await runAgent('verifier','opening judgment fact check',{request,findings:acceptedFindings,impacts,assessment:revised,instructions:'Check factual premises, not whether success is proven. A conditional Recommended or Not recommended screening opinion may be approved with disclosed unknowns. Reject invented actual demand, rent, sales, absence of competitors or proven specialty overlap. Broad retail competition and conditional differentiation may inform an opinion if stated as possibilities. Return assessmentSupported and a short reason.'},z.object({assessmentSupported:z.boolean(),reason:z.string().min(1).max(1000)}).strict());
         if(checked.assessmentSupported){assessment=revised;review.assessmentSupported=true;review.assessmentReason=checked.reason;}
        }
       }catch{warnings.push('The opening judgment could not be revised within this run; supported comparisons are retained.');}
      }
      const accepted = (rows: typeof review.findings, id: string) => rows.filter(r => r.id === id).length === 1 && rows.find(r => r.id === id)?.supported === true;
      const hadAssessment=Boolean(assessment);
      const before = findings.length + insights.length;
      findings = groundedFindings(findings.filter(f => accepted(review.findings, f.id)), evidence);
      insights = insights.filter(i => accepted(review.insights, i.id) && i.findingIds.every(id => findings.some(f => f.id === id)) && i.findingIds.some(id => findings.some(f => f.id === id && ['offering', 'price', 'feedback'].includes(f.kind))));
      impacts=impacts.filter((impact,index)=>insights.some(i=>i.id===`i${index+1}`)&&groundedImpacts([impact],findings,request).length===1);
      if(!review.assessmentSupported||!assessment||assessment.findingIds.some(id=>!findings.some(f=>f.id===id))||(assessment.verdict!=='insufficient-evidence'&&!assessment.findingIds.some(id=>impacts.some(i=>i.findingIds.includes(id)))))assessment=null;
      if(hadAssessment&&!assessment)warnings.push('Opening assessment withheld because its supporting claims did not pass review.');
      const rejected = before - findings.length - insights.length;
      if (rejected) warnings.push(`${rejected} unsupported or weakly supported findings/insights removed by verification.`);
      update('verification', rejected || !findings.length || hadAssessment&&!assessment ? 'partial' : 'complete', 'Evidence references and exact quotes checked in code; claim support reviewed by NVIDIA.');
    } catch (e) {
      failed('verification', e); findings = []; insights = []; impacts=[];assessment=null;
      warnings.push('Unreviewed generated claims withheld. Retrieved sources remain inspectable.');
    }
  } else update('verification', 'unavailable', 'No extracted findings to verify; sources remain unverified context.');
  update('reporting', 'complete', 'Evidence-backed business effects and the reviewed judgment are ready.');
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
  const report = { request, status, startedAt, evidence, findings, insights, impacts, assessment, stages: stageList, warnings, unknowns, osmContext, agentRuns, shortlist };
  // A provider may echo input; strip credential values before any report can leave the server.
  let serialized = JSON.stringify(report);
  for (const key of [config.nvidiaKey, config.tavilyKey]) if (key) serialized = serialized.split(key).join('[redacted]');
  return reportSchema.parse(JSON.parse(serialized));
}

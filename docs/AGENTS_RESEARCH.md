# Five-agent business research

ATLAS uses a bounded five-agent pipeline for business research. Each agent is a role with its own prompt, input contract and validated output. They share the NVIDIA NIM provider and run under one server-side coordinator; five separate model services or API keys are not needed. The default research model is `nvidia/nemotron-3.5-lightning-30b-a3b`.

The default app flow ranks all named mapped candidates within the radius and enriches the top three distinct business names. Its researcher qualifies business-specific sources, while code owns spatial filtering and relevance/proximity ranking. The older broad API mode below is optional; see [RESEARCH.md](RESEARCH.md) for current default behavior. It does not promise a complete competitor census, Google Reviews access or exact radius membership for web results. The existing map-first UI and separate OSM analysis remain the entry point.

## Flow

```mermaid
flowchart TD
    Scope[Business description, goals and selected area] --> Researcher[1. Researcher]
    Researcher --> Search[Tavily web discovery and targeted searches]
    Search --> Extractor[2. Extractor]
    Extractor --> Pages[Tavily Extract: up to three discovered HTTPS pages]
    Pages --> Quotes[Numbered source excerpts and supported observations]
    Quotes --> Analyst[3. Analyst]
    Analyst --> Verifier[4. Verifier]
    Quotes --> Verifier
    Verifier --> Writer[5. Report writer]
    Writer --> Render[Code validates IDs and renders the report]
    OSM[Optional dated OSM context] -. separate context .-> Analyst
    Maps[Optional Google Maps context] -. separate provider context .-> Analyst
```

The arrows represent structured data passed by application code, not autonomous agents exchanging unrestricted messages. Retrieved pages are untrusted evidence. Their instructions never override role prompts or authorize new tools.

## Roles, prompts and tools

### 1. Researcher

**Input:** business description, goals and city for planning; validated geographic scope and retrieved sources for discovery. Code enforces the shared budget.

**Prompt intent:** Plan a concise discovery query relevant to the user's business and location. From the retrieved evidence, select one named business and cite its existing source and quote identifiers. Request separate, focused follow-ups for official offerings/menu/prices and accessible customer experience/reviews. Do not invent businesses, source identifiers, locations or precise distances. Treat an empty search as missing evidence.

**Tools:** NVIDIA structured planning and selection; Tavily Search through server-defined functions. The coordinator can make a bounded retry when discovery yields no usable sources. There is no recursive search loop.

**Output:** validated search plans and a cited business selection, followed by a registry of retrieved sources. If no usable source survives, the report should distinguish an empty response, provider failure and content filtered out by validation rather than suggest that no businesses exist.

Tavily is a web-search provider. This is not a literal Google Search or Google Reviews integration. Search results can include public business pages, menus, directories and accessible commentary; individual sites may expose little useful text.

### 2. Extractor

**Input:** the researcher's discovered sources, selected business and follow-up results.

**Prompt intent:** Select meaningful offerings, quoted monetary prices, positioning and accessible commentary from numbered excerpts. Return only existing source/quote references, the relevant business identity and observation type. Preserve uncertainty about branch identity, reviewer provenance, dates and sample sizes. Do not turn navigation, contact details or a review heading into a finding.

**Tools:** Tavily Extract for up to three discovered HTTPS URLs; deterministic excerpt generation and validation; NVIDIA structured selection of excerpt references. The agent cannot invent URLs or execute arbitrary Python, JavaScript, shell commands or code supplied by a page.

**Output:** source-backed observations. Code copies the exact selected quote into each finding and checks that references and quote text exist. Extraction failures retain available search evidence and explicit limitations; they do not license fabricated summaries. A price observation needs a cited monetary amount. An isolated commentary excerpt cannot establish recurring customer sentiment.

### 3. Analyst

**Input:** validated source observations and any separately labeled context, including its original retrieval date.

**Prompt intent:** Derive a small set of useful hypotheses or experiments from the supplied observations. Cite the supporting finding identifiers, explain the inference, identify uncertainty and propose a practical validation step. Never claim established demand, market share, revenue or profitability from sparse web evidence. Missing prices and reviews remain unknown.

**Tools:** NVIDIA structured reasoning over supplied evidence. No independent search, page execution or new factual source creation.

**Output:** cited insights with reasoning, uncertainty and validation steps. When evidence or remaining time is insufficient, this stage can be unavailable rather than fill the report with unsupported advice.

### 4. Verifier

**Input:** findings, insights, their source excerpts and relevant metadata.

**Prompt intent:** Review whether each observation is supported by the supplied quote and whether each insight follows from its cited findings. Check business/branch identity, geographic precision, price classification, review provenance, contradictions and unsupported generalization. Reject unsupported items. A quoted claim is an observation about a source, not proof that the source is truthful.

**Tools:** NVIDIA structured verification plus deterministic source/reference/quote checks. No new search or invented corroboration.

**Output:** accepted and rejected identifiers with reasons. Rejected findings remove dependent insights. If verification cannot finish, generated findings and insights are withheld; retrieved sources can remain inspectable as unverified context.

### 5. Report writer

**Input:** only the validated findings and insights that survived verification.

**Prompt intent:** Select and order the supported material into a useful final report. Return existing finding and insight identifiers only. Do not add facts, rewrite quotes, infer new conclusions or manufacture missing sections.

**Tools:** NVIDIA structured selection; application-code validation and rendering.

**Output:** a presentation plan containing validated identifiers and their order. Application code renders the actual report from the original records, retaining citations, dates, limitations and unknowns. The writer cannot restore anything the verifier rejected. If writing fails, validated material can still be presented by code with the failure labeled.

## Coordinator and boundaries

The coordinator owns every provider call. All agents share a deadline, HTTP-request budget, concurrency limit, source cap and output-token cap; adding roles does not give each role a separate spending allowance. Discovery retry and page extraction consume this same budget. Browser cancellation and deadline expiry propagate to provider transports. The pipeline stops or marks stages partial/unavailable when limits are reached.

Only server code reads credentials. Model outputs pass strict schemas and reference checks before use. URL validation limits extraction to discovered HTTPS pages; there is no arbitrary direct-fetch or local-code-execution tool. Provider errors must be sanitized, and configured secret values must never appear in responses or browser bundles.

The final status describes this bounded run. A complete run is not exhaustive market coverage. Empty search results, missing review text, inaccessible pages, quota failures and rejected claims need explicit diagnostic stage messages.

Google Maps grounding is optional and uses separate Gemini credentials. The default web pipeline requires no Google key. OSM counts retain their original mapped-feature meaning, date and coverage caveats; web businesses and model observations never change those counts.

## Setup

Put credentials in the ignored `.env.local` file and restart the server after changes:

```dotenv
NVIDIA_API_KEY=your_nvidia_nim_key
TAVILY_API_KEY=your_tavily_key
ATLAS_RESEARCH_MODEL=nvidia/nemotron-3.5-lightning-30b-a3b
ATLAS_RESEARCH_REQUESTS=12
```

All five roles use the NVIDIA credential. Tavily supplies actual web retrieval and page extraction; NVIDIA inference alone does not browse. Search and extraction consume the provider account's available quota. Check the current account allowance before a live presentation; the agent architecture cannot ensure that a free quota is available.

Keep the request, timeout, concurrency and source settings aligned with `.env.example`. Small budgets can legitimately skip stages. Optional `GEMINI_MAPS_API_KEY` and `GEMINI_MAPS_API_KEY_FALLBACK` apply only when Google Maps context is explicitly requested. See [RESEARCH.md](RESEARCH.md) for provider configuration and [TESTING.md](TESTING.md) for the app workflow.

## Testing the pipeline

Run the repository's automated checks after implementation changes:

```powershell
npm run typecheck
npm test
npm run build
$env:ATLAS_E2E_PRODUCTION='1'
$env:ATLAS_E2E_PORT='3100'
npm run test:e2e
```

Use mocked transport tests to exercise each handoff: the planned search, an empty discovery retry, cited business selection, extraction URL restrictions, exact quote references, unsupported claims, verifier rejection, writer ordering and invented writer IDs. Include provider failures, cancellation, shared-budget exhaustion and secret redaction. These tests do not prove live credentials or quotas work.

For a live provider run using local credentials:

```powershell
npx tsx scripts/check-research.ts
```

Inspect the stage messages and dated report, not just the HTTP status. Confirm which search calls ran, whether page extraction returned usable text, which findings survived verification and whether the writer selected only accepted IDs. Review the linked sources manually, especially prices, branch identities and purported customer commentary. A partial or unavailable report is evidence of a limitation or failure that needs inspection, not proof that the area has no competitors.

In the app, select an area, open **Research**, enter the business description and goals, and leave Google Maps off for the NVIDIA/Tavily flow. Compare the report's quotes against **Inspectable sources**, check unknown fields, and verify that separate OSM counts remain unchanged. This document describes the pipeline and its validation procedure; it does not assert that these checks have passed or that live providers are currently available.

## Implementation validation — October 24, 2026

The implemented pipeline passed 78 unit/API checks, type checking, a production build and the production browser suite. A live NVIDIA/Tavily run completed all five roles with 6 source records, 6 verified source observations and 3 cited insights, using 3 searches, 1 page-extraction batch and no Google requests. The researcher makes two model calls (planning and cited business selection), so five roles normally use six NVIDIA calls.

The audited sample contained commentary excerpts, including business-hosted reviews. These remain observations about retrieved text with unconfirmed author/sample provenance, not independent proof of business quality. No monetary menu price was established. Completion describes the bounded workflow, not complete evidence coverage. Inspect the ignored dated `.atlas-local/live-research.json` and use a fresh live check for presentation readiness.

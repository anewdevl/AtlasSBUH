'use client';
import { useEffect, useRef, useState } from 'react';
import { reportSchema, stageSchema, type ResearchReport, type Stage, type ResearchRequest } from '../lib/research-contracts';
import BusinessShortlist from './BusinessShortlist';
import { categories } from '../lib/categories';
import { cities } from '../lib/cities';
import type { AnalysisRequest } from '../lib/contracts';

export default function ResearchPanel({ scope, osmRequest, description, setDescription }: { description: string; setDescription: (value: string) => void; scope: ResearchRequest['scope']; osmRequest?: AnalysisRequest }) {
  const [goals, setGoals] = useState(''), [includeMaps, setMaps] = useState(false);
  const [report, setReport] = useState<ResearchReport | null>(null), [progress, setProgress] = useState<Stage[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const control = useRef<AbortController | null>(null), generation = useRef(0);
  const scopeKey = JSON.stringify(scope);
  function invalidate() { generation.current++; control.current?.abort(); setReport(null); setProgress([]); setBusy(false); setError(''); }
  useEffect(() => { invalidate(); return () => { generation.current++; control.current?.abort(); }; }, [scopeKey, JSON.stringify(osmRequest), description]);
  async function run() {
    invalidate(); const id = generation.current, controller = new AbortController(); control.current = controller;
    setBusy(true); const deadline = setTimeout(() => controller.abort(), 115000);
    let received = false;
    try {
      const response = await fetch('/api/research', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description, goals, scope, includeMaps, osmRequest, localOnly: Boolean(osmRequest) }), signal: controller.signal });
      if (!response.ok) { const body = await response.json(); throw new Error(body.error || 'Research unavailable.'); }
      if (!response.body) throw new Error('Research stream unavailable.');
      const reader = response.body.getReader(), decoder = new TextDecoder(); let pending = '';
      try {
        while (true) {
          const { value, done } = await reader.read(); pending += decoder.decode(value, { stream: !done });
          if (pending.length > 5000000) throw new Error('Research response too large.');
          let index: number;
          while ((index = pending.indexOf('\n')) !== -1) {
            const line = pending.slice(0, index); pending = pending.slice(index + 1); if (!line.trim()) continue;
            const event = JSON.parse(line); if (generation.current !== id) return;
            if (event.type === 'stage') { const stage = stageSchema.parse(event.stage); setProgress(old => [...old.filter(s => s.stage !== stage.stage), stage]); }
            if (event.type === 'report') {
              const result = reportSchema.parse(event.report);
              if (JSON.stringify(result.request) !== JSON.stringify({ description, scope, goals, includeMaps })) {
                // Zod trims strings; compare values rather than allowing a mismatched scope.
                if (JSON.stringify(result.request.scope) !== scopeKey || result.request.description !== description.trim() || result.request.includeMaps !== includeMaps || result.request.goals !== goals.trim()) throw new Error('Research scope mismatch.');
              }
              setReport(result); received = true;
            }
            if (event.type === 'error') throw new Error(event.error);
          }
          if (done) break;
        }
      } finally { reader.releaseLock(); }
      if (!received) throw new Error('Research ended before a report was available.');
    } catch (e) { if (generation.current === id) setError(e instanceof Error && e.name !== 'AbortError' ? e.message : 'Research timed out or was cancelled.'); }
    finally { clearTimeout(deadline); if (generation.current === id) setBusy(false); }
  }
  const citations = (ids: string[]) => ids.map(id => { const e = report?.evidence.find(e => e.id === id); return e && <a key={id} href={`#research-source-${id}`}>{e.title} ↗ </a>; });
  return <section className="research-panel" aria-label="Business research">
    <div className="eyebrow">WEB RESEARCH · NVIDIA + TAVILY</div><h2>Research your business idea</h2>
    <p>Shortlist mapped businesses inside your radius, ranked primarily by relevance. Research checks business-specific websites for the top three distinct names and rejects news and general roundups. NVIDIA and Tavily provide the web research; no Google key is needed.</p>
    <p>Selected scope: {cities[scope.cityId].label} · {scope.center.lat.toFixed(4)}, {scope.center.lon.toFixed(4)} · {scope.radiusMeters} m requested radius. Shortlist distances use mapped coordinates. Web pages may describe a whole brand or another branch.</p>
    {osmRequest && <p><strong>Confirmed category: {categories[osmRequest.categoryId].label}</strong>. Change this in Search to control which mapped businesses are considered.</p>}
    <form onSubmit={e => { e.preventDefault(); void run(); }}>
      <label htmlFor="research-description">Business description</label>
      <textarea id="research-description" required minLength={3} maxLength={500} value={description} onChange={e => { invalidate(); setDescription(e.target.value); }} placeholder="A specialty coffee shop with fast morning pickup" />
      <label htmlFor="research-goals">Business goals (optional)</label><input id="research-goals" maxLength={500} value={goals} onChange={e => { invalidate(); setGoals(e.target.value); }} />
      <details><summary>Optional Google Maps context</summary><label className="research-check"><input type="checkbox" checked={includeMaps} onChange={e => { invalidate(); setMaps(e.target.checked); }} />Include Google Maps location context (requires configured credentials)</label><p>Off by default. Web research works independently when Google is unavailable.</p></details>
      <button type="submit" disabled={busy || description.trim().length < 3}>{busy ? 'Research in progress…' : 'Research this business'}</button>
      {busy && <button type="button" onClick={invalidate}>Cancel research</button>}
    </form>
    <ol className="research-stages" aria-live="polite">{progress.map(s => <li key={s.stage}>{s.message} <small>({s.status})</small></li>)}</ol>
    {error && <p role="alert">{error}</p>}
    {report && <div aria-label="Research report"><h3>Research report · {report.status}</h3><p>Started {new Date(report.startedAt).toLocaleString()}. “Complete” describes this bounded run, not exhaustive market coverage.</p>
      {!!report.shortlist.length && <BusinessShortlist report={report}/>}
      {report.osmContext && <div><h3>Separate OSM context</h3><p>{report.osmContext.directMappedCount ?? 'Unknown'} direct mapped features · {report.osmContext.adjacentMappedCount ?? 'Unknown'} adjacent mapped features · {report.osmContext.status}. Retrieved {report.osmContext.fetchedAt}. Coverage unknown. External sources are excluded from these counts.</p><a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors · ODbL</a></div>}
      <h3>Competitors, offerings and customer feedback</h3>{!report.findings.length && <p>No verified findings available. This does not mean there are no competitors.</p>}
      {!report.findings.some(f => f.kind === 'price') && <p>No cited monetary price passed the evidence checks. Confirm current menu prices directly.</p>}
      {!report.findings.some(f => f.kind === 'feedback') && <p>No usable review text passed the evidence checks. Customer ratings and sentiment remain unknown.</p>}
      {!report.shortlist.length && report.findings.map(f => <article key={f.id}><h4>{f.business || f.kind} · {f.relation}</h4><p><strong>Source observation:</strong> {f.claim}</p><p>{f.geographicRelevance}</p>{f.evidence.map((ref, index) => <div key={index}><blockquote>{ref.quote}</blockquote>{citations([ref.sourceId])}</div>)}{f.kind === 'feedback' && <p>Retrieved review sample: {f.reviewSampleSize ?? 'unknown'} · Dates: {f.reviewDates ?? 'unknown'}. Not a representative survey.</p>}<p>Limitations: {f.limitations.join(' ')}</p></article>)}
      <h3>Location context</h3>{!report.evidence.some(e => e.provider === 'google-maps') && <p>Google Maps context unavailable or not requested.</p>}
      {report.evidence.filter(e => e.provider === 'google-maps').map(e => <article key={e.id}><p>Provider-generated location context; exact business matches and radius membership remain unverified.</p><p>{e.excerpt}</p><a href={e.url} target="_blank" rel="noopener noreferrer"><span translate="no">Google Maps</span> · {e.title}</a>{e.placeId && <p>Place ID: {e.placeId}</p>}<p>Retrieved {e.retrievedAt}</p></article>)}
      <h3>Business insights and experiments</h3>{!report.insights.length && <p>Insufficient verified evidence for insights.</p>}{report.insights.map(i => <article key={i.id}><h4>{i.kind}: {i.recommendation}</h4><p>{i.reasoning}</p><p>Uncertainty: {i.uncertainty}</p><p>Validate next: {i.validation}</p>{citations([...new Set(report.findings.filter(f => i.findingIds.includes(f.id)).flatMap(f => f.evidence.map(e => e.sourceId)))])}</article>)}
      <h3>Unknowns and limitations</h3><ul>{[...report.warnings, ...report.unknowns].map((w, i) => <li key={i}>{w}</li>)}</ul>
      {!!report.agentRuns.length && <details><summary>Agent activity</summary><ol>{report.agentRuns.map((run, index) => <li key={index}><strong>{run.role}</strong> · {run.task} · {run.status} · {(run.durationMs / 1000).toFixed(1)} s<p>Model: {run.model}. Allowed tools: {run.tools.join(', ')}.</p></li>)}</ol></details>}
      <h3>Inspectable sources</h3>{report.evidence.map(e => <details key={e.id} id={`research-source-${e.id}`}><summary>{e.title} · {e.provider}</summary><a href={e.url} target="_blank" rel="noopener noreferrer">{e.title}</a><p>Retrieved {e.retrievedAt} · {e.contentKind}</p><blockquote>{e.excerpt}</blockquote></details>)}
    </div>}
  </section>;
}

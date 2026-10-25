'use client';
import { useEffect, useRef, useState } from 'react';
import { reportSchema, stageSchema, type ResearchReport, type Stage, type ResearchRequest } from '../lib/research-contracts';
import BusinessShortlist from './BusinessShortlist';
import ReportDownloads from './ReportDownloads';
import { categories } from '../lib/categories';
import { cities } from '../lib/cities';
import type { AnalysisRequest } from '../lib/contracts';

export default function ResearchPanel({ scope, osmRequest, description, setDescription, prepare, onReport, locationLabel, revision, confirmed }: { description: string; setDescription: (value: string) => void; scope: ResearchRequest['scope']; osmRequest?: AnalysisRequest; prepare: () => Promise<AnalysisRequest>; onReport: (report: ResearchReport | null) => void; locationLabel: string; revision:number; confirmed:boolean }) {
  const [goals, setGoals] = useState(''), [includeMaps, setMaps] = useState(false);
  const [report, setReport] = useState<ResearchReport | null>(null), [progress, setProgress] = useState<Stage[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const control = useRef<AbortController | null>(null), generation = useRef(0);
  const publish=useRef(onReport);publish.current=onReport;
  const scopeKey = JSON.stringify(scope);
  function invalidate() { generation.current++; control.current?.abort(); setReport(null); publish.current(null); setProgress([]); setBusy(false); setError(''); }
  useEffect(() => { invalidate(); return () => { generation.current++; control.current?.abort(); }; }, [revision]);
  async function run() {
    invalidate(); const id = generation.current, controller = new AbortController(); control.current = controller;
    setBusy(true); const deadline = setTimeout(() => controller.abort(), 115000);
    let received = false;
    try {
      const confirmed=await prepare(); if(generation.current!==id)return;
      const input={ description, goals, scope:confirmed.scope, includeMaps, osmRequest:confirmed, localOnly:true };
      const response = await fetch('/api/research', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal: controller.signal });
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
              if(JSON.stringify(result.request.osmRequest)!==JSON.stringify(confirmed))throw new Error('Research business type mismatch.');
              setReport(result); publish.current(result); received = true;
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
    <div className="eyebrow">BUSINESS / RESEARCH</div><h2>Understand this location.</h2>
    <p className="muted">Generate a concise review of nearby businesses, their offerings, and opportunities to investigate. Expand the evidence behind each observation.</p>
    <div className="selected-location"><span className="eyebrow">SELECTED LOCATION</span><strong>{locationLabel}</strong><span>{cities[scope.cityId].label} · {scope.radiusMeters} m radius</span></div>
    {osmRequest && <p className="micro">{confirmed?`Mapped type: ${categories[osmRequest.categoryId].label}.`:'Your business type will be interpreted when you generate insights.'}</p>}
    <form onSubmit={e => { e.preventDefault(); void run(); }}>
      <label htmlFor="research-description">Business description</label>
      <textarea id="research-description" required minLength={3} maxLength={500} value={description} onChange={e => { invalidate(); setDescription(e.target.value); }} placeholder="A specialty coffee shop with fast morning pickup" />
      <label htmlFor="research-goals">Business goals (optional)</label><input id="research-goals" maxLength={500} value={goals} onChange={e => { invalidate(); setGoals(e.target.value); }} />
      <details><summary>Optional Google Maps context</summary><label className="research-check"><input type="checkbox" checked={includeMaps} onChange={e => { invalidate(); setMaps(e.target.checked); }} />Include Google Maps location context (requires configured credentials)</label><p>Off by default. Web research works independently when Google is unavailable.</p></details>
      <button type="submit" disabled={busy || description.trim().length < 3}>{busy ? 'Research in progress…' : 'Generate insights'}</button>
      {busy && <button type="button" onClick={invalidate}>Cancel research</button>}
    </form>
    <ol className="research-stages" aria-live="polite">{progress.map(s => <li key={s.stage}>{s.message} <small>({s.status})</small></li>)}</ol>
    {error && <p role="alert">{error}</p>}
    {report && <div aria-label="Research report"><h3>Research report · {report.status}</h3><ReportDownloads report={report} locationLabel={locationLabel}/><div className="research-summary"><strong>{report.findings.length} supported observations</strong><span>{report.insights.length} next steps · {report.evidence.length} retrieved sources</span><span>{report.insights[0]?.recommendation ?? (report.findings.length ? 'Source observations are ready to inspect below.' : 'Evidence was limited. Explore the mapped shortlist and unknowns below.')}</span></div><p>Started {new Date(report.startedAt).toLocaleString()}. “Complete” describes this bounded run, not exhaustive market coverage.</p>
      <h3>Business insights and experiments</h3>{!report.insights.length && <p>Insufficient verified evidence for insights.</p>}{report.insights.map(i => <article key={i.id}><h4>{i.kind}: {i.recommendation}</h4><details><summary>Reasoning & evidence</summary><p>{i.reasoning}</p><p>Uncertainty: {i.uncertainty}</p><p>Validate next: {i.validation}</p>{citations([...new Set(report.findings.filter(f => i.findingIds.includes(f.id)).flatMap(f => f.evidence.map(e => e.sourceId)))])}</details></article>)}
      {!!report.shortlist.length && <BusinessShortlist report={report}/>}
      {report.osmContext && <div><h3>Mapped area context</h3><p>{report.osmContext.directMappedCount ?? 'Unknown'} direct mapped features · {report.osmContext.adjacentMappedCount ?? 'Unknown'} adjacent mapped features · {report.osmContext.status}. Retrieved {report.osmContext.fetchedAt}. Coverage unknown. External sources are excluded from these counts.</p><a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors · ODbL</a></div>}
      <h3>Competitors, offerings and customer feedback</h3>{!report.findings.length && <p>No verified findings available. This does not mean there are no competitors.</p>}
      {!report.findings.some(f => f.kind === 'price') && <p>No cited monetary price passed the evidence checks. Confirm current menu prices directly.</p>}
      {!report.findings.some(f => f.kind === 'feedback') && <p>No usable review text passed the evidence checks. Customer ratings and sentiment remain unknown.</p>}
      {!report.shortlist.length && report.findings.map(f => <article key={f.id}><h4>{f.business || f.kind} · {f.relation}</h4><p><strong>Source observation:</strong> {f.claim}</p><p>{f.geographicRelevance}</p>{f.evidence.map((ref, index) => <div key={index}><blockquote>{ref.quote}</blockquote>{citations([ref.sourceId])}</div>)}{f.kind === 'feedback' && <p>Retrieved review sample: {f.reviewSampleSize ?? 'unknown'} · Dates: {f.reviewDates ?? 'unknown'}. Not a representative survey.</p>}<p>Limitations: {f.limitations.join(' ')}</p></article>)}
      <details><summary>Additional location context</summary>{!report.evidence.some(e => e.provider === 'google-maps') && <p>Google Maps context unavailable or not requested.</p>}
      {report.evidence.filter(e => e.provider === 'google-maps').map(e => <article key={e.id}><p>Provider-generated location context; exact business matches and radius membership remain unverified.</p><p>{e.excerpt}</p><a href={e.url} target="_blank" rel="noopener noreferrer"><span translate="no">Google Maps</span> · {e.title}</a>{e.placeId && <p>Place ID: {e.placeId}</p>}<p>Retrieved {e.retrievedAt}</p></article>)}
      </details>
      <details><summary>Unknowns and limitations</summary><ul>{[...report.warnings, ...report.unknowns].map((w, i) => <li key={i}>{w}</li>)}</ul></details>
      {!!report.agentRuns.length && <details><summary>Agent activity</summary><ol>{report.agentRuns.map((run, index) => <li key={index}><strong>{run.role}</strong> · {run.task} · {run.status} · {(run.durationMs / 1000).toFixed(1)} s<p>Model: {run.model}. Allowed tools: {run.tools.join(', ')}.</p></li>)}</ol></details>}
      <h3>Inspectable sources</h3>{report.evidence.map(e => <details key={e.id} id={`research-source-${e.id}`}><summary>{e.title} · {e.provider}</summary><a href={e.url} target="_blank" rel="noopener noreferrer">{e.title}</a><p>Retrieved {e.retrievedAt} · {e.contentKind}</p><blockquote>{e.excerpt}</blockquote></details>)}
    </div>}
  </section>;
}

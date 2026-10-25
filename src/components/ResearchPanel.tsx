'use client';
import { useEffect, useRef, useState } from 'react';
import { reportSchema, stageSchema, type ResearchReport, type Stage, type ResearchRequest } from '../lib/research-contracts';
import BusinessShortlist from './BusinessShortlist';
import MapPreviewDrawer from './MapPreviewDrawer';
import type {MapPreviewInput} from '../lib/map-preview';
import {impactExplanation,openingDecision} from '../lib/business-impact';
import ReportDownloads from './ReportDownloads';
import { categories } from '../lib/categories';
import { cities } from '../lib/cities';
import type { AnalysisRequest } from '../lib/contracts';

export default function ResearchPanel({ scope, osmRequest, description, setDescription, prepare, onReport, locationLabel, revision, confirmed }: { description: string; setDescription: (value: string) => void; scope: ResearchRequest['scope']; osmRequest?: AnalysisRequest; prepare: () => Promise<AnalysisRequest>; onReport: (report: ResearchReport | null) => void; locationLabel: string; revision:number; confirmed:boolean }) {
  const [goals, setGoals] = useState('');
  const [map,setMap]=useState<MapPreviewInput|null>(null);
  const [report, setReport] = useState<ResearchReport | null>(null), [progress, setProgress] = useState<Stage[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const control = useRef<AbortController | null>(null), generation = useRef(0);
  const publish=useRef(onReport);publish.current=onReport;
  const scopeKey = JSON.stringify(scope);
  function invalidate() { setMap(null); generation.current++; control.current?.abort(); setReport(null); publish.current(null); setProgress([]); setBusy(false); setError(''); }
  useEffect(() => { invalidate(); return () => { generation.current++; control.current?.abort(); }; }, [revision]);
  async function run() {
    invalidate(); const id = generation.current, controller = new AbortController(); control.current = controller;
    setBusy(true); const deadline = setTimeout(() => controller.abort(), 115000);
    let received = false;
    try {
      const confirmed=await prepare(); if(generation.current!==id)return;
      const input={ description, goals, scope:confirmed.scope, osmRequest:confirmed, localOnly:true };
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
              if (JSON.stringify(result.request) !== JSON.stringify({ description, scope, goals })) {
                // Zod trims strings; compare values rather than allowing a mismatched scope.
                if (JSON.stringify(result.request.scope) !== scopeKey || result.request.description !== description.trim() || result.request.goals !== goals.trim()) throw new Error('Research scope mismatch.');
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
  return <section className="research-panel" aria-label="Business research">{map&&<MapPreviewDrawer input={map} onClose={()=>setMap(null)}/>}
    <div className="eyebrow">BUSINESS / RESEARCH</div><h2>How would nearby businesses affect yours?</h2>
    <p className="muted">Compare nearby offerings with your business and get an AI judgment on opening here. Supporting quotes stay expandable.</p>
    <div className="selected-location"><span className="eyebrow">SELECTED LOCATION</span><strong>{locationLabel}</strong><span>{cities[scope.cityId].label} · {scope.radiusMeters} m radius</span></div>
    {osmRequest && <p className="micro">{confirmed?`Current map category: ${categories[osmRequest.categoryId].label}. Research interprets your full description before retrieving its shortlist.`:'Your business type will be interpreted when you generate insights.'}</p>}
    <form onSubmit={e => { e.preventDefault(); void run(); }}>
      <label htmlFor="research-description">Business description</label>
      <textarea id="research-description" required minLength={3} maxLength={500} value={description} onChange={e => { invalidate(); setDescription(e.target.value); }} placeholder="A specialty coffee shop with fast morning pickup" />
      <label htmlFor="research-goals">Business goals (optional)</label><input id="research-goals" maxLength={500} value={goals} onChange={e => { invalidate(); setGoals(e.target.value); }} />
      <button type="submit" disabled={busy || description.trim().length < 3}>{busy ? 'Research in progress…' : 'Generate insights'}</button>
      {busy && <button type="button" onClick={invalidate}>Cancel research</button>}
    </form>
    <details open={busy}><summary>{busy?'Research progress':'Research details'}</summary><ol className="research-stages" aria-live="polite">{progress.map(s => <li key={s.stage}>{s.message} <small>({s.status})</small></li>)}</ol></details>
    {error && <p role="alert">{error}</p>}
    {report && <div aria-label="Research report"><h3>Research report · {report.status}</h3><div className={`opening-assessment ${openingDecision(report.assessment).verdict}`}><span className="eyebrow">LOCATION RECOMMENDATION</span><h2>{openingDecision(report.assessment).label}</h2><p>{openingDecision(report.assessment).reasoning}</p>{report.assessment&&<details><summary>Why & what is still unknown</summary>{citations([...new Set(report.findings.filter(f=>report.assessment!.findingIds.includes(f.id)).flatMap(f=>f.evidence.map(e=>e.sourceId)))])}<ul>{report.assessment.risks.map((risk,index)=><li key={index}>{risk}</li>)}</ul></details>}<p className="micro">AI judgment based on this bounded research, not a profit forecast or verified property assessment.</p></div><ReportDownloads report={report} locationLabel={locationLabel}/><div className="research-summary"><strong>{report.impacts.length} businesses assessed</strong><span>{report.findings.length} source observations · {report.evidence.length} retrieved sources</span></div><p>Started {new Date(report.startedAt).toLocaleString()}. “Complete” describes this bounded run, not exhaustive market coverage.</p>
      <h3>How nearby businesses could affect yours</h3>{!report.impacts.length&&<p>No supported business-effect comparison is available. Mapped businesses remain available below; their presence alone does not establish an effect.</p>}{report.impacts.map(i=><article className="business-impact-card" key={i.id}><h4>{i.business}</h4><strong>{i.effect==='competition'?'Potential competition':i.effect==='complement'?'Possible complement':i.effect==='limited-overlap'?'Different offering':'Effect unclear'}</strong><p>{impactExplanation(i,report.request)}</p><details><summary>Supporting offering & evidence</summary><p>Your proposal: {i.yourOffering}</p><blockquote>{i.competitorOffering}</blockquote>{citations([...new Set(report.findings.filter(f=>i.findingIds.includes(f.id)).flatMap(f=>f.evidence.map(e=>e.sourceId)))])}</details><button className="secondary" onClick={()=>setMap({name:i.business,city:cities[scope.cityId].label})}>Mini map for {i.business}</button></article>)}
      {!!report.shortlist.length && <BusinessShortlist report={report}/>}
      {report.osmContext && <div><h3>Mapped area context</h3><p>{report.osmContext.directMappedCount ?? 'Unknown'} mapped features in the selected category (specialty unverified) · {report.osmContext.adjacentMappedCount ?? 'Unknown'} adjacent mapped features · {report.osmContext.status}. Retrieved {report.osmContext.fetchedAt}. Coverage unknown. External sources are excluded from these counts.</p><a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors · ODbL</a></div>}
      <h3>Competitors, offerings and customer feedback</h3>{!report.findings.length && <p>No verified findings available. This does not mean there are no competitors.</p>}
      {!report.shortlist.length && report.findings.map(f => <article key={f.id}><h4>{f.business || f.kind} · {f.relation}</h4>{f.business&&<button className="secondary" onClick={()=>setMap({name:f.business,city:cities[scope.cityId].label})}>Mini map for {f.business}</button>}<p><strong>Source observation:</strong> {f.claim}</p><p>{f.geographicRelevance}</p>{f.evidence.map((ref, index) => <div key={index}><blockquote>{ref.quote}</blockquote>{citations([ref.sourceId])}</div>)}{f.kind === 'feedback' && <p>Retrieved review sample: {f.reviewSampleSize ?? 'unknown'} · Dates: {f.reviewDates ?? 'unknown'}. Not a representative survey.</p>}<p>Limitations: {f.limitations.join(' ')}</p></article>)}
      <details><summary>Unknowns and limitations</summary><ul>{[...report.warnings, ...report.unknowns].map((w, i) => <li key={i}>{w}</li>)}</ul></details>
      {!!report.agentRuns.length && <details><summary>Agent activity</summary><ol>{report.agentRuns.map((run, index) => <li key={index}><strong>{run.role}</strong> · {run.task} · {run.status} · {(run.durationMs / 1000).toFixed(1)} s<p>Model: {run.model}. Allowed tools: {run.tools.join(', ')}.</p></li>)}</ol></details>}
      <h3>Inspectable sources</h3>{report.evidence.map(e => <details key={e.id} id={`research-source-${e.id}`}><summary>{e.title} · {e.provider}</summary><a href={e.url} target="_blank" rel="noopener noreferrer">{e.title}</a><p>Retrieved {e.retrievedAt} · {e.contentKind}</p><blockquote>{e.excerpt}</blockquote></details>)}
    </div>}
  </section>;
}

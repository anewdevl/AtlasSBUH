'use client';
import { useEffect, useRef, useState } from 'react';
import type { AnalysisRequest } from '../lib/contracts';
import { categories } from '../lib/categories';
import { checks, locationAdviceSchema, type LocationAdvice } from '../lib/location-advisor';
import type { Position } from '../lib/cities';

export default function LocationAdvisor({ request, description, onSelect }: { request: AnalysisRequest; description: string; onSelect: (center: Position) => void }) {
 const [report, setReport] = useState<LocationAdvice | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
 const control = useRef<AbortController | null>(null), generation = useRef(0);
 const key = JSON.stringify({ analysis: request, description });
 function clear() { generation.current++; control.current?.abort(); setReport(null); setBusy(false); setError(''); }
 useEffect(() => { clear(); return () => { generation.current++; control.current?.abort(); }; }, [key]);
 async function run() {
  clear(); const id = generation.current, controller = new AbortController(); control.current = controller;
  setBusy(true); const deadline = setTimeout(() => controller.abort(), 65000);
  try {
   const response = await fetch('/api/location-advice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: key, signal: controller.signal });
   const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Location comparison unavailable.');
   const parsed = locationAdviceSchema.parse(data);
   if (JSON.stringify(parsed.request.analysis) !== JSON.stringify(request) || parsed.request.description !== description.trim()) throw new Error('Location comparison scope mismatch.');
   if (id === generation.current) setReport(parsed);
  } catch (e) { if (id === generation.current) setError(e instanceof Error && e.name !== 'AbortError' ? e.message : 'Location comparison timed out. Try again.'); }
  finally { clearTimeout(deadline); if (id === generation.current) setBusy(false); }
 }
 const recommended = report?.candidates.find(c => c.id === report.recommendation?.recommendedId);
 return <section className="research-panel location-advisor" aria-label="Location advisor">
  <div className="eyebrow">LOCATION ADVISOR · NVIDIA + OSM</div><h2>Where should you investigate?</h2>
  <p>Compare the selected area with two nearby alternatives for <strong>{categories[request.categoryId].label}</strong>. Each uses the same {request.scope.radiusMeters} m radius. Alternatives start north and east, with south and west used at city edges.</p>
  <p>Complementary activity 45% · transit 35% · lower mapped competition 20%. This is a provisional screening tool; it cannot establish demand or profitability.</p>
  <button type="button" disabled={busy} onClick={run}>{busy ? 'Comparing nearby areas…' : 'Find an area to investigate'}</button>
  {busy && <button type="button" onClick={clear}>Cancel comparison</button>}
  {error && <p role="alert">{error}</p>}
  {report && <div aria-live="polite">
   <h3>{recommended ? `Investigate ${recommended.label.toLowerCase()} first` : 'No supported location recommendation'}</h3>
   <p>{recommended ? 'Highest measured score among these sampled areas, accepted provisionally by the location agent.' : report.status === 'agent-unavailable' ? 'The location agent could not complete its review. Measured areas are still shown below.' : 'The available evidence does not support choosing one area.'}</p>
   <p className="micro">Retrieved {new Date(report.fetchedAt).toLocaleString()} · NVIDIA {report.model}. Coverage unknown.</p>
   <p>Complementary types for this business: {report.complementCategories.join(', ')}.</p>
   <div className="area-cards">{[...report.candidates].sort((a, b) => (b.score ?? -1) - (a.score ?? -1)).map(c => <article className="area-card" key={c.id}>
    <div className="area-card-title"><h3>{c.label}</h3><strong>{c.score === null ? 'Unscored' : `${c.score}/100`}</strong></div>
    <p className="micro">{c.center.lat.toFixed(4)}, {c.center.lon.toFixed(4)} · {request.scope.radiusMeters} m radius</p>
    <dl><div><dt>Mapped competitors</dt><dd>{c.competition}</dd></div><div><dt>Complementary features</dt><dd>{c.complements}</dd></div><div><dt>Transit features</dt><dd>{c.transit}</dd></div></dl>
    <button type="button" className="secondary" onClick={() => onSelect(c.center)}>Explore {c.label.toLowerCase()}</button>
    <details><summary>Inspect source examples</summary><ul>{c.sources.map(s => <li key={s.id}><a href={`https://www.openstreetmap.org/${s.id}`} target="_blank" rel="noreferrer">{s.name}</a> · {s.metric}</li>)}</ul><p className="micro">Up to four source examples per metric. Counts use every valid matching feature.</p></details>
   </article>)}</div>
   <h3>Before choosing premises</h3><ul>{(report.recommendation?.checks ?? ['rent', 'footfall', 'competitors', 'permits'] as const).map(c => <li key={c}>{checks[c]}</li>)}</ul>
   <details><summary>Assumptions and retrieval details</summary><ul>{report.warnings.map(w => <li key={w}>{w}</li>)}</ul><p>OSM base date: {report.osmBaseTimestamp ?? 'Unknown'}</p><p>Query hash: {report.queryHash}</p><pre>{report.query}</pre></details>
   <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors · ODbL</a>
  </div>}
 </section>;
}

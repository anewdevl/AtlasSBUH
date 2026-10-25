'use client';
import {useState} from 'react';
import MapPreviewDrawer from './MapPreviewDrawer';
import {cities} from '../lib/cities';
import type {MapPreviewInput} from '../lib/map-preview';
import type { ResearchReport } from '../lib/research-contracts';
import { normalizedName, candidateQualification } from '../lib/business-shortlist';
import { categories } from '../lib/categories';

export default function BusinessShortlist({ report }: { report: ResearchReport }) {
  const entries = report.shortlist;
  const [map,setMap]=useState<MapPreviewInput|null>(null);
  function card(b: typeof entries[number], index: number) {
    const observations = report.findings.filter(f => f.business && normalizedName(f.business) === normalizedName(b.name));
    return <article key={b.id} className="shortlist-card"><div className="shortlist-title"><span className="shortlist-rank">{index + 1}</span><div><h4>{b.name}</h4><p>{categories[b.categoryId].label} · {Math.round(b.distanceMeters)} m straight-line distance</p></div></div><p>{candidateQualification(b, report.request.description)}</p><p>{b.matchReason}</p><p className="micro">{b.positionKind === 'representative-center' ? 'Mapped building/area center; entrance may differ.' : 'Mapped point.'} <a href={b.sourceUrl} target="_blank" rel="noopener noreferrer">Map evidence ↗</a></p>
      <button className="secondary" onClick={()=>setMap({name:b.name,coordinates:b.coordinates,city:cities[report.request.scope.cityId].label})}>Mini map for {b.name}</button>
      {observations.length ? <details><summary>{observations.length} supported web observations · branch match unconfirmed</summary>{observations.map(f => <div key={f.id} className="shortlist-observation"><strong>{f.kind === 'feedback' ? 'Retrieved commentary' : f.kind}</strong>{f.evidence.map((ref, i) => <div key={i}><blockquote>{ref.quote}</blockquote><a href={`#research-source-${ref.sourceId}`}>{report.evidence.find(e => e.id === ref.sourceId)?.title ?? 'Source'}</a></div>)}</div>)}<p className="micro">Web material can describe the whole brand or another branch. Commentary is not a representative customer survey.</p></details> : <p className="micro">Mapped candidate; no verified web details in this run.</p>}
    </article>;
  }
  return <section aria-label="Ranked local shortlist">{map&&<MapPreviewDrawer input={map} onClose={()=>setMap(null)}/>}<h3>Your local shortlist</h3><div className="research-summary"><strong>{entries.length} named mapped features</strong><span>Within {report.request.scope.radiusMeters} m · Category, specialty text and distance ordering</span><span>{report.findings.length} checked web observations · {report.insights.length} proposed next steps</span></div><p>These are broad mapped category candidates, not a verified specialty competitor count. Ordering is a heuristic, not confidence, quality or business suitability. Web research covers up to three distinct names; map coverage and duplicate identities remain uncertain.</p>{entries.slice(0, 3).map(card)}{entries.length > 3 && <details><summary>Show all {entries.length} mapped candidates</summary>{entries.slice(3).map((b, i) => card(b, i + 3))}</details>}</section>;
}

'use client';
import { type AnalysisResponse } from '../lib/contracts';
import { cities } from '../lib/cities';
import { categories } from '../lib/categories';
export default function ResultsPanel({result,onPin,onSave}:{result:AnalysisResponse;onPin:()=>void;onSave:()=>void}){
 const p=result.provenance;
 return <section className="results" aria-label="Analysis results"><div className="section-heading"><div><div className="eyebrow">02 / MAPPED EVIDENCE</div><h2>{categories[result.request.categoryId].label} · {cities[result.request.scope.cityId].label}</h2></div><span className={`badge ${result.status==='partial'?'warning':''}`}>{result.status==='complete'?'Complete retrieval':'Partial retrieval'}</span></div>
  <div className="metrics"><div><strong>{result.directMappedCount??'—'}</strong><span>Direct mapped features</span></div><div><strong>{result.adjacentMappedCount??'—'}</strong><span>Adjacent mapped features</span></div><div><strong>{result.directMappedDensity?.toFixed(1)??'—'}</strong><span>Direct features / km²</span></div></div>
  <div className="result-actions"><button className="secondary" onClick={onPin}>Pin for comparison</button><button className="secondary" onClick={onSave}>Save in this browser</button></div>
  <p className="micro">Retrieved {new Date(p.fetchedAt).toLocaleString()} · {p.cacheState} · Coverage unknown</p>
  {result.warnings.map(w=><p className="notice" key={w}>{w}</p>)}
  {result.competitors.length===0&&<div className="empty-result">{result.status==='complete'?'No matching mapped features in this exact area. This is a valid empty result, not evidence that no businesses exist.':'No usable features in this partial result. Counts are unavailable.'}</div>}
  <div className="evidence-list">{result.competitors.map(c=><details key={`${c.sourceType}/${c.sourceId}`} className="feature"><summary><span className={`feature-dot ${c.relation}`}/><span className="feature-name">{c.name??'Unnamed mapped feature'}<small>{categories[c.categoryId].label} · {c.relation}</small></span><span className="feature-distance">{Math.round(c.distanceMeters)} m</span></summary><div className="feature-detail"><a href={c.sourceUrl} target="_blank" rel="noreferrer">{c.sourceType}/{c.sourceId} ↗</a><p>{c.positionKind} · {c.coordinates.lat}, {c.coordinates.lon}</p>{Object.entries(c.evidence).map(([key,value])=><code key={key}>{key}={value}</code>)}</div></details>)}</div>
  <details className="provenance"><summary>Source & retrieval details</summary><dl><dt>Provider</dt><dd>{p.provider}</dd><dt>OSM base timestamp</dt><dd>{p.osmBaseTimestamp??'Not supplied'}</dd><dt>Endpoint</dt><dd>{p.upstreamEndpoint}</dd><dt>Query SHA-256</dt><dd>{p.queryHash}</dd><dt>Excluded records</dt><dd>{p.excludedRecordCount}</dd><dt>Canonical center</dt><dd>{result.request.scope.center.lat}, {result.request.scope.center.lon}</dd></dl></details>
  <a className="attribution" href={p.licenseLink}>{p.attribution} · ODbL</a>
 </section>;
}

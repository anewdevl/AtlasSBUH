'use client';
import { useEffect,useRef } from 'react';
import { type AnalysisResponse } from '../lib/contracts';
import { cities } from '../lib/cities';
import { categories } from '../lib/categories';
import { competitorId,defaultCompetitorFilters,type Competitor,type CompetitorFilters } from '../lib/competitor-view';
export default function ResultsPanel({result,onPin,hasPinnedArea,onSave,selectedId,onSelect,competitors,filters,onFilters}:{result:AnalysisResponse;onPin:()=>void;hasPinnedArea:boolean;onSave:()=>void;selectedId:string|null;onSelect:(id:string)=>void;competitors:Competitor[];filters:CompetitorFilters;onFilters:(filters:CompetitorFilters)=>void}){
 const p=result.provenance;
 const selectedRow=useRef<HTMLButtonElement>(null);
 useEffect(()=>{selectedRow.current?.scrollIntoView({block:'nearest'});},[selectedId]);
 return <section className="results" aria-label="Analysis results"><div className="section-heading"><div><div className="eyebrow">02 / MAPPED EVIDENCE</div><h2>{categories[result.request.categoryId].label} · {cities[result.request.scope.cityId].label}</h2></div><span className={`badge ${result.status==='partial'?'warning':''}`}>{result.status==='complete'?'Complete retrieval':'Partial retrieval'}</span></div>
  <div className="metrics"><div><strong>{result.directMappedCount??'—'}</strong><span>Direct mapped features</span></div><div><strong>{result.adjacentMappedCount??'—'}</strong><span>Adjacent mapped features</span></div><div><strong>{result.directMappedDensity?.toFixed(1)??'—'}</strong><span>Direct features / km²</span></div></div>
  <div className="result-actions"><button className="secondary" onClick={onPin}>{hasPinnedArea?'Compare with pinned area':'Pin for comparison'}</button><button className="secondary" onClick={onSave}>Save in this browser</button></div>
  <p className="micro">Retrieved {new Date(p.fetchedAt).toLocaleString()} · {p.cacheState} · Coverage unknown</p>
  {result.warnings.map(w=><p className="notice" key={w}>{w}</p>)}
  {result.competitors.length===0&&<div className="empty-result">{result.status==='complete'?'No matching mapped features in this exact area. This is a valid empty result, not evidence that no businesses exist.':'No usable features in this partial result. Counts are unavailable.'}</div>}
  {result.competitors.length>0&&<div className="competitor-filters">
   <label htmlFor="competitor-search">Search competitors</label><input id="competitor-search" type="search" value={filters.query} placeholder="Search by business name…" onChange={e=>onFilters({...filters,query:e.target.value})}/>
   <div className="filter-fields"><label>Relationship<select aria-label="Filter competitors by relationship" value={filters.relation} onChange={e=>onFilters({...filters,relation:e.target.value as CompetitorFilters['relation']})}><option value="all">All features</option><option value="direct">Direct only</option><option value="adjacent">Adjacent only</option></select></label><label>Distance<select aria-label="Sort competitors by distance" value={filters.sort} onChange={e=>onFilters({...filters,sort:e.target.value as CompetitorFilters['sort']})}><option value="nearest">Nearest first</option><option value="farthest">Farthest first</option></select></label></div>
   <p className="filter-count" role="status">Showing {competitors.length} of {result.competitors.length} retrieved features</p><p className="micro">Filters apply to the list and map. Metrics above describe the full analysis.</p>
   {(filters.query||filters.relation!=='all'||filters.sort!=='nearest')&&<button className="text-button" onClick={()=>onFilters(defaultCompetitorFilters)}>Reset filters</button>}
  </div>}
  {result.competitors.length>0&&competitors.length===0&&<div className="empty-result">No competitors match these filters. Reset filters to see the retrieved features.</div>}
  <div className="evidence-list">{competitors.map(c=><button type="button" key={competitorId(c)} ref={selectedId===competitorId(c)?selectedRow:null} className="feature" aria-pressed={selectedId===competitorId(c)} onClick={()=>onSelect(competitorId(c))}><span className={`feature-dot ${c.relation}`}/><span className="feature-name">{c.name??'Unnamed mapped feature'}<small>{categories[c.categoryId].label} · {c.relation}</small></span><span className="feature-distance">{Math.round(c.distanceMeters)} m ↗</span></button>)}</div>
  <details className="provenance"><summary>Source & retrieval details</summary><dl><dt>Provider</dt><dd>{p.provider}</dd><dt>OSM base timestamp</dt><dd>{p.osmBaseTimestamp??'Not supplied'}</dd><dt>Endpoint</dt><dd>{p.upstreamEndpoint}</dd><dt>Query SHA-256</dt><dd>{p.queryHash}</dd><dt>Excluded records</dt><dd>{p.excludedRecordCount}</dd><dt>Canonical center</dt><dd>{result.request.scope.center.lat}, {result.request.scope.center.lon}</dd></dl></details>
  <a className="attribution" href={p.licenseLink}>{p.attribution} · ODbL</a>
 </section>;
}

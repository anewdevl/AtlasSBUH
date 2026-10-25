'use client';
import { compare } from '../lib/compare';
import { cities } from '../lib/cities';
import type { AnalysisResponse } from '../lib/contracts';
export default function ComparePanel({a,b,onClear}:{a:AnalysisResponse;b:AnalysisResponse|null;onClear:()=>void}){
 const comparison=compare(a,b);
 const sameArea=b&&a.request.scope.cityId===b.request.scope.cityId&&a.request.scope.center.lat===b.request.scope.center.lat&&a.request.scope.center.lon===b.request.scope.center.lon;
 return <section className="comparison" aria-label="Area comparison"><div className="section-heading"><div><div className="eyebrow">03 / SIDE BY SIDE</div><h2>Compare the context.</h2></div><button className="text-button" onClick={onClear}>Clear pin</button></div><p className="muted">Pinned: {cities[a.request.scope.cityId].label} · {a.request.scope.center.lat}, {a.request.scope.center.lon}. Analyze another area with the same settings.</p>
 {!comparison.comparable?<p role="status">{comparison.reason}</p>:sameArea?<p role="status">Your first area is pinned. Choose another location in Search and analyze it, then select Compare with pinned area. Clear pin to replace your first area.</p>:<><div className="compare-grid">{[comparison.a,comparison.b].map((r,i)=><div key={i}><span className="eyebrow">{i===0?'PINNED AREA':'CURRENT AREA'}</span><h3>{cities[r.request.scope.cityId].label}</h3><p className="micro">{r.request.scope.center.lat}, {r.request.scope.center.lon}</p><strong>{r.directMappedCount}</strong><p>direct mapped features</p><p>{r.adjacentMappedCount} adjacent · {r.directMappedDensity!.toFixed(1)} direct / km²</p><p className="micro">{new Date(r.provenance.fetchedAt).toLocaleString()}<br/>{r.provenance.cacheState}</p></div>)}</div><p className="micro">Equal search radius; potentially different mapping coverage and retrieval dates. These measures do not establish demand or recommend a winner.</p></>}
 </section>;
}

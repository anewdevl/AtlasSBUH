'use client';
import { useEffect,useRef } from 'react';
import { categories } from '../lib/categories';
import type { AnalysisResponse } from '../lib/contracts';
type Props={competitor:AnalysisResponse['competitors'][number];provenance:AnalysisResponse['provenance'];onClose:()=>void};
export default function CompetitorDetail({competitor:c,provenance:p,onClose}:Props){
 const close=useRef<HTMLButtonElement>(null),dismiss=useRef(onClose);dismiss.current=onClose;
 useEffect(()=>{const trigger=document.activeElement as HTMLElement|null;close.current?.focus();const escape=(e:KeyboardEvent)=>{if(e.key==='Escape')dismiss.current();};document.addEventListener('keydown',escape);return()=>{document.removeEventListener('keydown',escape);if(trigger?.isConnected)trigger.focus();};},[]);
 return <section className="competitor-detail" aria-label="Competitor details">
  <div className="detail-top"><span className="eyebrow">MAPPED BUSINESS</span><button ref={close} className="icon-button" aria-label="Close competitor details" onClick={onClose}>×</button></div>
  <span className={`relation-label ${c.relation}`}><i className={`feature-dot ${c.relation}`}/>{c.relation} competitor</span>
  <h2>{c.name??'Unnamed mapped feature'}</h2><p className="detail-category">{categories[c.categoryId].label}</p>
  <div className="detail-distance"><strong>{Math.round(c.distanceMeters)}<small> m</small></strong><span>from analysis center</span></div>
  <div className="detail-section"><h3>Location</h3><p className="mono">{c.coordinates.lat.toFixed(5)}, {c.coordinates.lon.toFixed(5)}</p><p className="micro">{c.positionKind==='representative-center'?'Representative center of a mapped area. This may not be the business entrance.':'Mapped point location. Entrance accuracy is not verified.'}</p></div>
  <div className="detail-section"><h3>Matching source evidence</h3><div className="evidence-tags">{Object.entries(c.evidence).map(([key,value])=><code key={key}>{key}={value}</code>)}</div><a className="source-link" href={c.sourceUrl} target="_blank" rel="noreferrer">{c.sourceType}/{c.sourceId} ↗</a></div>
  <div className="detail-section"><h3>Research context</h3><p className="micro">Reviews, offerings, and business insights have not been retrieved for this feature.</p></div>
  <div className="detail-provenance"><span className="eyebrow">OPENSTREETMAP / OVERPASS</span><p>Retrieved {new Date(p.fetchedAt).toLocaleString()}</p><p>{p.cacheState} · Coverage unknown</p><a href={p.licenseLink}>{p.attribution} · ODbL</a></div>
 </section>;
}

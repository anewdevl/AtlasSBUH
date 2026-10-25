'use client';
import { useEffect, useRef, useState } from 'react';
import { canonicalize, type AnalysisRequest } from '../lib/contracts';
import { categories } from '../lib/categories';
import { checks, locationAdviceSchema, type LocationAdvice } from '../lib/location-advisor';
export default function LocationAdvisor({request,description,prepare,revision}:{request:AnalysisRequest;description:string;prepare:()=>Promise<AnalysisRequest>;revision:number}) {
 const [report,setReport]=useState<LocationAdvice|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const control=useRef<AbortController|null>(null),generation=useRef(0);
 function clear(){generation.current++;control.current?.abort();setReport(null);setBusy(false);setError('');}
 useEffect(()=>{clear();return()=>{generation.current++;control.current?.abort();};},[revision]);
 async function run(){
  clear();const id=generation.current,controller=new AbortController();control.current=controller;setBusy(true);
  const timer=setTimeout(()=>controller.abort(),85000);
  try{
   const analysis=canonicalize(await prepare());if(id!==generation.current)return;
   const response=await fetch('/api/location-advice',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({analysis,description}),signal:controller.signal});
   const data=await response.json();if(!response.ok)throw new Error(data.error||'Location assessment unavailable.');
   const valid=locationAdviceSchema.parse(data);if(JSON.stringify(valid.request.analysis)!==JSON.stringify(analysis)||valid.request.description!==description.trim())throw new Error('Location assessment scope mismatch.');
   if(id===generation.current)setReport(valid);
  }catch(e){if(id===generation.current)setError(e instanceof Error&&e.name!=='AbortError'?e.message:'Assessment canceled or timed out. Try again.');}
  finally{clearTimeout(timer);if(id===generation.current)setBusy(false);}
 }
 const area=report?.candidates[0];
 return <section className="research-panel location-advisor" aria-label="Location assessment">
  <div className="eyebrow">SELECTED LOCATION / ASSESSMENT</div><h2>Check the local context.</h2>
  <p className="muted">Assess nearby competition, potentially complementary businesses, and mapped transit around your chosen pin. Use Compare to evaluate a second location yourself.</p>
  <button type="button" className="secondary" disabled={busy} onClick={run}>{busy?'Assessing selected location…':'Assess this location'}</button>
  {busy&&<><p role="status">Checking mapped evidence for your selected area…</p><button onClick={clear}>Cancel assessment</button></>}
  {error&&<p role="alert">{error}</p>}
  {report&&area&&<div aria-live="polite"><h3>{report.status==='provisional'?'Location evidence reviewed':report.status==='insufficient'?'Limited mapped evidence':'AI assessment unavailable'}</h3>
   <p>{categories[request.categoryId].label} · {request.scope.radiusMeters} m radius</p>
   <dl className="assessment-metrics"><div><dt>Mapped competitors</dt><dd>{area.competition??'Unavailable'}</dd></div><div><dt>Potential complements</dt><dd>{area.complements??'Unavailable'}</dd></div><div><dt>Transit features</dt><dd>{area.transit??'Unavailable'}</dd></div></dl>
   {report.recommendation&&<p>Investigate these signals first: {report.recommendation.priorities.map(p=>p==='complements'?'complementary businesses':p==='competition'?'nearby competitors':'transit access').join(', ')}.</p>}
   <details><summary>Inspect supporting evidence</summary><p>Potential complementary types: {report.complementCategories.join(', ')}.</p><ul>{area.sources.map(s=><li key={s.id}><a href={`https://www.openstreetmap.org/${s.id}`} target="_blank" rel="noreferrer">{s.name}</a> · {s.metric}</li>)}</ul><p className="micro">Up to four examples per metric. Representative centers may differ from entrances.</p></details>
   <h3>Before committing to premises</h3><ul>{(report.recommendation?.checks??['rent','footfall','access','permits'] as const).map(c=><li key={c}>{checks[c]}</li>)}</ul>
   <details><summary>Limitations & retrieval details</summary><ul>{report.warnings.map(w=><li key={w}>{w}</li>)}</ul><p>Retrieved {new Date(report.fetchedAt).toLocaleString()} · Coverage unknown</p><p>OSM base: {report.osmBaseTimestamp??'Unknown'}</p><p>Query hash: {report.queryHash}</p></details>
   <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors · ODbL</a>
  </div>}
 </section>;
}

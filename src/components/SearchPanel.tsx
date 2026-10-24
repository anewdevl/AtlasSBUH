'use client';
import { useState } from 'react';
import { categories,categoryIds,type CategoryId } from '../lib/categories';
import { cities, type CityId } from '../lib/cities';
import { classify } from '../lib/classify';
import { type AnalysisRequest } from '../lib/contracts';
type Props={request:AnalysisRequest;onChange:(r:AnalysisRequest)=>void;onAnalyze:()=>void;busy:boolean};
export default function SearchPanel({request:r,onChange,onAnalyze,busy}:Props){
 const [description,setDescription]=useState(''),[suggested,setSuggested]=useState<ReturnType<typeof classify>|null>(null);
 function category(categoryId:CategoryId){onChange({...r,categoryId,adjacentCategoryIds:[]});}
 return <section className="search-panel" aria-label="Analysis settings">
  <div className="eyebrow">01 / DEFINE YOUR MARKET</div><h1>A better view of <br/>your next move<span>.</span></h1>
  <p className="muted intro">Explore the businesses mapped around a location. Start with a category, then choose your area.</p>
  <label htmlFor="business">What are you opening? <span className="optional">optional</span></label>
  <div className="input-action"><input id="business" value={description} onChange={e=>{setDescription(e.target.value);setSuggested(null);}} placeholder="A neighborhood coffee shop…" maxLength={200}/><button onClick={()=>setSuggested(classify(description))} aria-label="Suggest category">↗</button></div>
  {suggested&&<div className="suggestion" role="status">{suggested.status==='unsupported'?'No supported match. Choose a category below.':suggested.status==='ambiguous'?'Several categories match. Confirm one below.':'Suggested category — select to confirm:'}{suggested.matches.map(id=><button className="chip" key={id} onClick={()=>category(id)}>{categories[id].label}</button>)}</div>}
  <label htmlFor="category">Confirmed category</label><select id="category" value={r.categoryId} onChange={e=>category(e.target.value as CategoryId)}>{categoryIds.map(id=><option value={id} key={id}>{categories[id].label}</option>)}</select>
  <label htmlFor="city">City preset</label><select id="city" value={r.scope.cityId} onChange={e=>{const cityId=e.target.value as CityId;onChange({...r,scope:{...r.scope,cityId,center:cities[cityId].center}});}}>{Object.entries(cities).map(([id,c])=><option key={id} value={id}>{c.label}</option>)}</select>
  <fieldset><legend>Search radius</legend><div className="segmented">{([500,1000,2000] as const).map(radiusMeters=><button key={radiusMeters} aria-pressed={r.scope.radiusMeters===radiusMeters} onClick={()=>onChange({...r,scope:{...r.scope,radiusMeters}})}>{radiusMeters===500?'500 m':`${radiusMeters/1000} km`}</button>)}</div></fieldset>
  <fieldset><legend>Include adjacent categories</legend>{categories[r.categoryId].adjacent.map(id=><label className="check" key={id}><input type="checkbox" checked={r.adjacentCategoryIds.includes(id)} onChange={e=>onChange({...r,adjacentCategoryIds:e.target.checked?[...r.adjacentCategoryIds,id]:r.adjacentCategoryIds.filter(x=>x!==id)})}/>{categories[id].label}</label>)}</fieldset>
  <details className="coordinates"><summary>Set exact coordinates</summary><div className="coordinate-fields"><label>Latitude<input aria-label="Latitude" type="number" step="0.0001" value={r.scope.center.lat} onChange={e=>onChange({...r,scope:{...r.scope,center:{...r.scope.center,lat:Number(e.target.value)}}})}/></label><label>Longitude<input aria-label="Longitude" type="number" step="0.0001" value={r.scope.center.lon} onChange={e=>onChange({...r,scope:{...r.scope,center:{...r.scope.center,lon:Number(e.target.value)}}})}/></label></div></details>
  <button className="primary analyze" disabled={busy} onClick={onAnalyze}>{busy?'Retrieving mapped evidence…':'Analyze this area'}<span aria-hidden="true">→</span></button>
  <p className="micro">Click the map to set a center. Panning never runs a search. Presets and envelopes are not official city boundaries.</p>
 </section>;
}

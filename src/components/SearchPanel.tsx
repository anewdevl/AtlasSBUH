'use client';
import { useEffect, useRef, useState } from 'react';
import { categories,categoryIds,type CategoryId } from '../lib/categories';
import { cities, type CityId } from '../lib/cities';
import { classify } from '../lib/classify';
import { type AnalysisRequest } from '../lib/contracts';
import { categorySuggestionSchema, type CategorySuggestion } from '../lib/category-suggestion';
import LocationSearch from './LocationSearch';
type Props={request:AnalysisRequest;onChange:(r:AnalysisRequest)=>void;description:string;setDescription:(value:string)=>void};
export default function SearchPanel({request:r,onChange,description,setDescription}:Props){
 const [suggested,setSuggested]=useState<ReturnType<typeof classify>|null>(null),[aiSuggestion,setAiSuggestion]=useState<CategorySuggestion|null>(null),[aiBusy,setAiBusy]=useState(false),[aiError,setAiError]=useState('');
 const selectedCategory=categories[r.categoryId]??categories.cafe;
 const generation=useRef(0), control=useRef<AbortController|null>(null);
 function cancelSuggestion(){generation.current++;control.current?.abort();setAiBusy(false);}
 useEffect(()=>{cancelSuggestion();return()=>{generation.current++;control.current?.abort();};},[description,JSON.stringify(r)]);
 useEffect(()=>{setAiSuggestion(null);setSuggested(null);setAiError('');},[description]);
 function category(categoryId:CategoryId,automatic=false){cancelSuggestion();if(!automatic)setAiSuggestion(null);onChange({...r,categoryId,adjacentCategoryIds:[]});}
 async function suggestWithAi(){
  cancelSuggestion();const id=generation.current,controller=new AbortController();control.current=controller;
  setAiBusy(true);setAiError('');setAiSuggestion(null);const timer=setTimeout(()=>controller.abort(),20000);
  try{
   const response=await fetch('/api/suggest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({description}),signal:controller.signal});
   const data=await response.json();if(!response.ok)throw new Error(data.error??'AI suggestion unavailable.');
   const suggestion=categorySuggestionSchema.parse(data);if(generation.current!==id)return;
   setAiSuggestion(suggestion);if(suggestion.categoryId)category(suggestion.categoryId,true);
  }catch(error){if(generation.current===id)setAiError(error instanceof Error&&error.name!=='AbortError'?error.message:'AI classification timed out. Try again.');}
  finally{clearTimeout(timer);if(generation.current===id)setAiBusy(false);}
 }
 return <section className="search-panel" aria-label="Analysis settings">
  <div className="eyebrow">SEARCH PARAMETERS</div><h1>Explore a market<span>.</span></h1>
  <p className="muted intro">Describe your business, let AI select its mapped type, then choose an area.</p>
  <label htmlFor="business">What are you opening? <span className="optional">optional</span></label>
  <div className="input-action"><input id="business" value={description} onChange={e=>{cancelSuggestion();setDescription(e.target.value);setSuggested(null);setAiSuggestion(null);setAiError('');}} placeholder="A neighborhood coffee shop…" maxLength={500}/><button type="button" onClick={()=>setSuggested(classify(description))} aria-label="Suggest category">↗</button></div>
  {suggested&&<div className="suggestion" role="status">{suggested.status==='unsupported'?'No supported match. Choose a category below.':suggested.status==='ambiguous'?'Several categories match. Confirm one below.':'Suggested category — select to confirm:'}{suggested.matches.map(id=><button className="chip" key={id} onClick={()=>category(id)}>{categories[id].label}</button>)}</div>}
  <button type="button" className="ai-suggest" disabled={aiBusy||description.trim().length<3} onClick={suggestWithAi}>{aiBusy?'Asking NVIDIA AI…':'Ask NVIDIA AI for a category'}</button>
  <p className="micro ai-privacy">AI applies the closest supported business type automatically. You can override it below. Your description is sent to NVIDIA; map counts come from OSM.</p>
  {aiError&&<p className="ai-error" role="alert">{aiError}</p>}
  {aiSuggestion&&<div className="suggestion" role="status"><strong>{aiSuggestion.categoryId?`Selected by AI: ${categories[aiSuggestion.categoryId].label}`:'Outside current mapped categories'}</strong><p>{aiSuggestion.explanation}</p></div>}
  <label htmlFor="category">Confirmed category <span className="optional">manual override</span></label><select id="category" value={categories[r.categoryId]?r.categoryId:'cafe'} onChange={e=>category(e.target.value as CategoryId)}>{categoryIds.map(id=><option value={id} key={id}>{categories[id].label}</option>)}</select>
  <p className="micro">{categoryIds.length} mapped business types. Matching rule: {selectedCategory.qualifier}. Broad types may include businesses with different offerings; OSM coverage varies, especially for offices.</p>
  <label htmlFor="city">City preset</label><select id="city" value={r.scope.cityId} onChange={e=>{const cityId=e.target.value as CityId;onChange({...r,scope:{...r.scope,cityId,center:cities[cityId].center}});}}>{Object.entries(cities).map(([id,c])=><option key={id} value={id}>{c.label}</option>)}</select>
  <LocationSearch cityId={r.scope.cityId} onSelect={center=>onChange({...r,scope:{...r.scope,center}})}/>
  <fieldset><legend>Search radius</legend><div className="segmented">{([500,1000,2000] as const).map(radiusMeters=><button key={radiusMeters} aria-pressed={r.scope.radiusMeters===radiusMeters} onClick={()=>onChange({...r,scope:{...r.scope,radiusMeters}})}>{radiusMeters===500?'500 m':`${radiusMeters/1000} km`}</button>)}</div></fieldset>
  <details className="coordinates advanced"><summary>Advanced settings</summary><fieldset><legend>Include adjacent categories</legend>{selectedCategory.adjacent.map(id=><label className="check" key={id}><input type="checkbox" checked={r.adjacentCategoryIds.includes(id)} onChange={e=>onChange({...r,adjacentCategoryIds:e.target.checked?[...r.adjacentCategoryIds,id]:r.adjacentCategoryIds.filter(x=>x!==id)})}/>{categories[id].label}</label>)}</fieldset><div className="coordinate-fields"><label>Latitude<input aria-label="Latitude" type="number" step="0.0001" value={r.scope.center.lat} onChange={e=>onChange({...r,scope:{...r.scope,center:{...r.scope.center,lat:Number(e.target.value)}}})}/></label><label>Longitude<input aria-label="Longitude" type="number" step="0.0001" value={r.scope.center.lon} onChange={e=>onChange({...r,scope:{...r.scope,center:{...r.scope.center,lon:Number(e.target.value)}}})}/></label></div></details>
 </section>;
}

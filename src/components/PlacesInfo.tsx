'use client';
import {useEffect,useRef,useState} from 'react';
import {placesResponseSchema,type PlacesRequest,type PlacesResponse} from '../lib/places';
export default function PlacesInfo({input}:{input:PlacesRequest}){
 const [result,setResult]=useState<PlacesResponse|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const control=useRef<AbortController|null>(null),generation=useRef(0);
 useEffect(()=>()=>{generation.current++;control.current?.abort();},[]);
 async function lookup(){
  if(busy||result)return;const id=++generation.current,controller=new AbortController();control.current=controller;setBusy(true);setError('');
  const timer=setTimeout(()=>controller.abort(),12000);
  try{
   const response=await fetch('/api/places',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal:controller.signal,cache:'no-store'});
   const body=await response.json();if(!response.ok)throw new Error(body.message||'Optional Google info unavailable.');
   const valid=placesResponseSchema.parse(body);if(JSON.stringify(valid.request)!==JSON.stringify(input))throw new Error('Place lookup context changed.');
   if(id===generation.current)setResult(valid);
  }catch(e){if(id===generation.current)setError(e instanceof Error&&e.name!=='AbortError'?e.message:'Optional lookup canceled or timed out.');}
  finally{clearTimeout(timer);if(id===generation.current)setBusy(false);}
 }
 return <section aria-label="Optional Google place information">
  <h1>{input.name}</h1><p className="muted">Optional nearby listing information. Your mapped competitors, comparison, research and exports are independent of this lookup.</p>
  <button className="primary" disabled={busy||result!==null} onClick={lookup}>{busy?'Looking up optional info…':result?'Lookup complete':'Get Google place info'}</button>
  <p className="micro">One request per click. Limited demo key; no automatic lookup, retries or additional pages. Reviews and photos are unavailable.</p>
  {busy&&<p role="status">Requesting nearby listings…</p>}{error&&<p role="alert">{error}</p>}
  {result&&<div className="google-place-results"><span className="google-maps-attribution" translate="no">Google Maps</span><p className="micro">Possible matches within 500 m of the mapped feature. Confirm the name and address; branch identity is unverified.</p>
   {!result.matches.length&&<p>No nearby candidate returned. This does not change your mapped analysis.</p>}
   {result.matches.map(p=><article key={p.id}><h2>{p.name}</h2><p>{p.address??'Address unavailable.'}</p><p>Google listing status: {p.businessStatus?.replace(/_/g,' ').toLowerCase()??'unavailable'}</p>{p.primaryType&&<p>Listing type: {p.primaryType.replace(/_/g,' ')}</p>}<a href={p.mapsUrl} target="_blank" rel="noreferrer">View listing on Google Maps ↗</a>{p.attributions.map((a,i)=><p className="micro" key={i}>{a.uri?<a href={a.uri} target="_blank" rel="noreferrer">{a.name}</a>:a.name}</p>)}</article>)}
   <p className="micro">Retrieved {new Date(result.fetchedAt).toLocaleString()}. Listing status is not a live open-now check.</p><p className="micro">{result.remainingRequests} optional requests remaining in ATLAS’s daily budget. This is separate from Google’s quota.</p>
  </div>}
 </section>;
}

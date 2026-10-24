'use client';
import dynamic from 'next/dynamic';
import { useEffect,useMemo,useRef,useState } from 'react';
import { cities,quantize,inCity,type CityId } from '../lib/cities';
import { REGISTRY_VERSION } from '../lib/categories';
import { SCHEMA_VERSION,canonicalize,requestSchema,responseSchema,validateResponse,isResponseForRequest,type AnalysisRequest,type AnalysisResponse } from '../lib/contracts';
import { sanitizeCategorySelection } from '../lib/category-selection';
import SearchPanel from '../components/SearchPanel';
import ResultsPanel from '../components/ResultsPanel';
import ComparePanel from '../components/ComparePanel';
import CompetitorDetail from '../components/CompetitorDetail';
import { defaultCompetitorFilters,filterCompetitors,type CompetitorFilters } from '../lib/competitor-view';
const MapCanvas=dynamic(()=>import('../components/MapCanvas'),{ssr:false,loading:()=> <div className="map-loading">Loading your map…</div>});
const initial:AnalysisRequest={schemaVersion:SCHEMA_VERSION,registryVersion:REGISTRY_VERSION,scope:{cityId:'nyc',center:cities.nyc.center,radiusMeters:1000},categoryId:'cafe',adjacentCategoryIds:[]};
export default function Home(){
 const [request,setRequest]=useState(initial),[result,setResult]=useState<AnalysisResponse|null>(null),[pin,setPin]=useState<AnalysisResponse|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [theme,setTheme]=useState<'dark'|'light'>('dark'),[view,setView]=useState<'search'|'results'|'compare'>('search'),[selectedId,setSelectedId]=useState<string|null>(null),[sidebarOpen,setSidebarOpen]=useState(true);
 const [filters,setFilters]=useState<CompetitorFilters>(defaultCompetitorFilters),[selectionTick,setSelectionTick]=useState(0);
 function selectCompetitor(id:string){setSelectedId(id);setSelectionTick(n=>n+1);setView('results');}
 function changeFilters(next:CompetitorFilters){setFilters(next);setSelectedId(null);}
 useEffect(()=>{try{if(localStorage.getItem('atlas.theme')==='light')setTheme('light');}catch{}},[]);
 function toggleTheme(){const next=theme==='dark'?'light':'dark';setTheme(next);try{localStorage.setItem('atlas.theme',next);}catch{}}
 const sequence=useRef(0),controller=useRef<AbortController|null>(null);
 useEffect(()=>{if(request.schemaVersion!==SCHEMA_VERSION||request.registryVersion!==REGISTRY_VERSION){sequence.current++;controller.current?.abort();setBusy(false);setRequest(initial);setResult(null);setPin(null);setError('The analysis schema was updated. Run a new analysis with the current settings.');return;}const safe=sanitizeCategorySelection(request);if(safe.categoryId!==request.categoryId||safe.adjacentCategoryIds.length!==request.adjacentCategoryIds.length)change(safe);},[request.schemaVersion,request.registryVersion,request.categoryId,request.adjacentCategoryIds,SCHEMA_VERSION,REGISTRY_VERSION]);
 const currentResult=useMemo(()=>result&&isResponseForRequest(result,request)?result:null,[result,request]);
 const visibleCompetitors=useMemo(()=>filterCompetitors(currentResult?.competitors??[],filters),[currentResult,filters]);
 function change(next:AnalysisRequest){setSelectedId(null);setFilters(defaultCompetitorFilters);const safe=sanitizeCategorySelection(next);sequence.current++;controller.current?.abort();setBusy(false);setRequest({...safe,schemaVersion:SCHEMA_VERSION,registryVersion:REGISTRY_VERSION,scope:{...safe.scope,center:quantize(safe.scope.center)}});setResult(null);setError('');setMessage('');}
 async function run(){
  const parsed=requestSchema.safeParse(request);if(!parsed.success){setError('Choose a center inside the selected city envelope and supported settings.');return;}
  const canonical=canonicalize(parsed.data);setRequest(canonical);const id=++sequence.current;controller.current?.abort();const control=new AbortController();controller.current=control;setBusy(true);setSelectedId(null);setFilters(defaultCompetitorFilters);setError('');setResult(null);setMessage('');
  const timeout=setTimeout(()=>control.abort(),35000);
  try{const response=await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(canonical),signal:control.signal});const data=await response.json();if(!response.ok)throw new Error(`${data.message??'Analysis unavailable.'}${data.retryAfterSeconds?` Try again in ${data.retryAfterSeconds} seconds.`:''}`);const valid=validateResponse(data,canonical);if(sequence.current===id){setResult(valid);setView('results');}}
  catch(e){if(sequence.current===id)setError(e instanceof Error&&e.name!=='AbortError'?e.message:'The request timed out. Try again when ready.');}
  finally{clearTimeout(timeout);if(sequence.current===id)setBusy(false);}
 }
 function save(){if(!result)return;try{localStorage.setItem('atlas.analysis.v1',JSON.stringify(result));setMessage('Analysis saved in this browser.');}catch{setMessage('Browser storage is unavailable or full.');}}
 function restore(){try{const raw=localStorage.getItem('atlas.analysis.v1');if(!raw){setMessage('No analysis saved in this browser yet.');return;}const saved=responseSchema.parse(JSON.parse(raw));change(saved.request);setResult(saved);setView('results');setMessage('Restored a saved analysis. Its original retrieval date is preserved; run Analyze to refresh.');}catch{setMessage('Saved data is incompatible or browser storage is unavailable.');}}
 const selected=currentResult?.competitors.find(c=>`${c.sourceType}/${c.sourceId}`===selectedId)??null;
 return <div className="app-shell" data-theme={theme}>
  <a className="skip-link" href="#workspace">Skip to analysis</a>
  <main id="workspace" tabIndex={-1} className={sidebarOpen?'':'sidebar-collapsed'}>
   <aside className="control-sidebar" aria-label="Explore workspace">
    <div className="sidebar-brand"><a className="brand" href="/" aria-label="ATLAS home"><span className="brand-mark">⌁</span>ATLAS</a><span className="workspace-label">EXPLORE</span><button className="mobile-toggle" onClick={()=>setSidebarOpen(!sidebarOpen)} aria-expanded={sidebarOpen} aria-controls="sidebar-body">{sidebarOpen?'Collapse':'Open controls'}</button></div>
    <div id="sidebar-body" className="sidebar-body">
     <nav className="workspace-nav" aria-label="Explorer views">{(['search','results','compare'] as const).map(tab=><button key={tab} aria-pressed={view===tab} onClick={()=>setView(tab)}>{tab==='search'?'Search':tab==='results'?`Competitors${currentResult?` (${currentResult.competitors.length})`:''}`:`Compare${pin?' •':''}`}</button>)}</nav>
     <div className="sidebar-scroll">
      {error&&<div className="error" role="alert"><strong>Analysis unavailable</strong><p>{error}</p><span>No zero counts or substitute areas are shown.</span></div>}
      {message&&<p className="feedback" role="status">{message}</p>}
      {busy&&<div className="loading-state" role="status"><span className="pulse"/>Retrieving mapped evidence…</div>}
      <div hidden={view!=='search'}><SearchPanel request={request} onChange={change}/></div>
      {view==='results'&&(currentResult?<ResultsPanel result={currentResult} onPin={()=>{setPin(currentResult);setView('compare');}} onSave={save} selectedId={selectedId} onSelect={selectCompetitor} competitors={visibleCompetitors} filters={filters} onFilters={changeFilters}/>:<div className="sidebar-empty"><span className="empty-symbol">⌖</span><h2>Your evidence starts here.</h2><p>Choose a business and area, then run an analysis to inspect mapped competitors.</p><button className="secondary" onClick={()=>setView('search')}>Set up a search →</button></div>)}
      {view==='compare'&&(pin?<ComparePanel a={pin} b={currentResult} onClear={()=>setPin(null)}/>:<div className="sidebar-empty"><span className="empty-symbol">⇄</span><h2>Two areas. Equal terms.</h2><p>Pin an analysis from Competitors, then search another area with matching settings.</p><button className="secondary" onClick={()=>setView(currentResult?'results':'search')}>{currentResult?'View competitors':'Set up a search'} →</button></div>)}
     </div>
     {view==='search'&&<div className="search-actions"><button className="primary analyze" disabled={busy} onClick={run}>{busy?'Retrieving mapped evidence…':'Analyze this area'}<span aria-hidden="true">→</span></button><p className="micro">Click map to set a center. Panning never runs a search. City presets are not official boundaries.</p></div>}
     <div className="sidebar-footer"><button className="text-button" onClick={restore}>Saved analysis</button><details className="methodology"><summary>Methodology</summary><p>Counts describe matching OpenStreetMap features, not unique businesses. Coverage is unknown. Density is direct mapped features per circular km², not a demand score.</p><p>Way and relation positions are representative centers, not guaranteed entrances. Exact caches are fresh for 24 hours; stale fallback lasts up to 30 days. Retrieval dates are preserved.</p><a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors · ODbL</a></details></div>
    </div>
   </aside>
   <section className="map-section" aria-label="Area explorer">
    <MapCanvas center={request.scope.center} radius={request.scope.radiusMeters} competitors={visibleCompetitors} selectedId={selectedId} selectionTick={selectionTick} onSelect={selectCompetitor} onNavigate={()=>setSelectedId(null)} onCenter={p=>{const canonical=quantize(p);if(inCity(request.scope.cityId,canonical))change({...request,scope:{...request.scope,center:canonical}});else setMessage('That point is outside this city’s search envelope.');}}/>
    <div className="map-caption"><span className="eyebrow"><i className="status-dot"/> AREA EXPLORER</span><strong>{cities[request.scope.cityId].label}</strong><span>{request.scope.center.lat.toFixed(4)}, {request.scope.center.lon.toFixed(4)} · {request.scope.radiusMeters/1000} km radius</span></div>
    <button className="theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${theme==='dark'?'light':'dark'} theme`} title={`Switch to ${theme==='dark'?'light':'dark'} theme`}><span aria-hidden="true">{theme==='dark'?'☀':'☾'}</span><span>{theme==='dark'?'Light':'Dark'}</span></button>
    <div className="map-bottom"><div className="map-legend"><span><i className="direct-dot"/>Direct</span><span><i className="adjacent-dot"/>Adjacent</span><span>◌ Search radius</span></div><p>Click map to set center · Select a point to inspect</p></div>
    {selected&&currentResult&&<CompetitorDetail competitor={selected} provenance={currentResult.provenance} onClose={()=>setSelectedId(null)}/>}
   </section>
  </main>
 </div>;
}

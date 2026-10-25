'use client';
import { categories, categoryIds, type CategoryId } from '../lib/categories';
import { cities, type CityId } from '../lib/cities';
import type { AnalysisRequest } from '../lib/contracts';
import type { CategorySuggestion } from '../lib/category-suggestion';
import LocationSearch from './LocationSearch';
type Props = { request: AnalysisRequest; onChange: (r: AnalysisRequest) => void; description: string; setDescription: (value: string) => void; manual: boolean; onManual: (value: boolean) => void; interpretation: CategorySuggestion | null; classifying: boolean; onInterpret: () => void; locationLabel: string; onLocation: (position: AnalysisRequest['scope']['center'], label: string) => void };
export default function SearchPanel({ request: r, onChange, description, setDescription, manual, onManual, interpretation, classifying, onInterpret, locationLabel, onLocation }: Props) {
 const selected = categories[r.categoryId] ?? categories.cafe;
 return <section className="search-panel" aria-label="Analysis settings">
  <div className="eyebrow">BUSINESS / LOCATION</div><h1>Explore a market<span>.</span></h1>
  <p className="muted intro">Choose a business and location to explore nearby competitors.</p>
  <label htmlFor="business">What are you opening?</label><textarea id="business" value={description} onChange={e => setDescription(e.target.value)} placeholder="A neighborhood grocery store, a clothing boutique…" maxLength={500} rows={3}/>
  <button className="ai-suggest" disabled={classifying || manual || description.trim().length < 3} onClick={onInterpret}>{classifying ? 'Interpreting business…' : 'Interpret business'}</button>
  <p className="micro">Business type is interpreted automatically. Manual override is available below.</p>
  {interpretation && <div className="suggestion" role="status"><strong>{interpretation.categoryId ? `Business type: ${categories[interpretation.categoryId].label}` : 'No reliable mapped type'}</strong><p>{interpretation.explanation}</p></div>}
  {manual && <p className="micro">Manual business type: {selected.label}</p>}
  <label htmlFor="city">City preset</label><select id="city" value={r.scope.cityId} onChange={e => { const cityId = e.target.value as CityId; onLocation(cities[cityId].center, `${cities[cityId].label} preset`); onChange({ ...r, scope: { ...r.scope, cityId, center: cities[cityId].center } }); }}>{Object.entries(cities).map(([id, c]) => <option value={id} key={id}>{c.label}</option>)}</select>
  <LocationSearch cityId={r.scope.cityId} onSelect={onLocation}/>
  <div className="selected-location" role="status"><span className="eyebrow">SELECTED LOCATION</span><strong>{locationLabel}</strong><span>{r.scope.center.lat.toFixed(4)}, {r.scope.center.lon.toFixed(4)}</span><p>Confirm this pin on the map before analyzing. Click the map to move it.</p></div>
  <fieldset><legend>Search radius</legend><div className="segmented">{([500,1000,2000] as const).map(radiusMeters => <button key={radiusMeters} aria-pressed={r.scope.radiusMeters === radiusMeters} onClick={() => onChange({ ...r, scope: { ...r.scope, radiusMeters } })}>{radiusMeters === 500 ? '500 m' : `${radiusMeters / 1000} km`}</button>)}</div></fieldset>
  <details className="coordinates advanced"><summary>Advanced settings</summary><label className="check"><input type="checkbox" checked={manual} onChange={e => onManual(e.target.checked)}/>Use manual business type</label>
   <label htmlFor="category">Confirmed category (manual override)</label><select id="category" disabled={!manual} value={r.categoryId} onChange={e => onChange({ ...r, categoryId: e.target.value as CategoryId, adjacentCategoryIds: [] })}>{categoryIds.map(id => <option key={id} value={id}>{categories[id].label}</option>)}</select>
   <p className="micro">{categoryIds.length} supported mapped types. Coverage varies. {selected.qualifier}.</p>
   <fieldset><legend>Include adjacent categories</legend>{selected.adjacent.map(id => <label className="check" key={id}><input type="checkbox" checked={r.adjacentCategoryIds.includes(id)} onChange={e => onChange({ ...r, adjacentCategoryIds: e.target.checked ? [...r.adjacentCategoryIds,id] : r.adjacentCategoryIds.filter(x => x !== id) })}/>{categories[id].label}</label>)}</fieldset>
   <div className="coordinate-fields">{(['lat','lon'] as const).map(key => <label key={key}>{key === 'lat' ? 'Latitude' : 'Longitude'}<input aria-label={key === 'lat' ? 'Latitude' : 'Longitude'} type="number" step="0.0001" value={r.scope.center[key]} onChange={e => onLocation({ ...r.scope.center, [key]: Number(e.target.value) }, 'Custom coordinates')}/></label>)}</div>
  </details>
 </section>;
}

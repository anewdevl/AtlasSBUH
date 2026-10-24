'use client';
import { useEffect, useRef, useState } from 'react';
import { cities, type CityId, type Position } from '../lib/cities';
import { locationResultsSchema, type LocationResult } from '../lib/location-search';

export default function LocationSearch({ cityId, onSelect }: { cityId: CityId; onSelect: (position: Position) => void }) {
  const [query, setQuery] = useState(''), [results, setResults] = useState<LocationResult[]>([]), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const controller = useRef<AbortController | null>(null), generation = useRef(0);
  function cancel() { generation.current++; controller.current?.abort(); setBusy(false); setResults([]); setMessage(''); }
  useEffect(() => { cancel(); setQuery(''); return () => { generation.current++; controller.current?.abort(); }; }, [cityId]);
  async function search() {
    cancel(); const id = generation.current, control = new AbortController(); controller.current = control; setBusy(true);
    try {
      const response = await fetch(`/api/locations?${new URLSearchParams({ q: query.trim(), city: cityId })}`, { signal: control.signal });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Location search unavailable.');
      const places = locationResultsSchema.parse(data.results);
      if (id === generation.current) { setResults(places); if (!places.length) setMessage(`No matches in ${cities[cityId].label}. Try a street, neighborhood or landmark.`); }
    } catch (e) { if (id === generation.current) setMessage(e instanceof Error ? e.message : 'Location search unavailable.'); }
    finally { if (id === generation.current) setBusy(false); }
  }
  return <div className="location-search"><form onSubmit={e => { e.preventDefault(); void search(); }}><label htmlFor="location-query">Find a location</label><div className="input-action"><input id="location-query" value={query} minLength={3} maxLength={180} onChange={e => { cancel(); setQuery(e.target.value); }} placeholder={`Address or landmark in ${cities[cityId].label}`} /><button disabled={busy || query.trim().length < 3} aria-label="Search locations">{busy ? '…' : '⌕'}</button></div></form><p className="micro">Choose a result to move the search center. <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a> · Photon</p>{message && <p role="status">{message}</p>}<ul aria-label="Location results">{results.map(r => <li key={r.id}><button type="button" onClick={() => { cancel(); setQuery(r.label); setMessage(`Selected ${r.label}`); onSelect(r.coordinates); }}>{r.label}</button></li>)}</ul></div>;
}

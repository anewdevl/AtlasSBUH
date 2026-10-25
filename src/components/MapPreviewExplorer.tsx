'use client';
import {useState} from 'react';
import BusinessMapPreview from './BusinessMapPreview';
import {buildMapPreview} from '../lib/map-preview';
export default function MapPreviewExplorer(){const [query,setQuery]=useState(''),[selected,setSelected]=useState('');const preview=selected?buildMapPreview({name:selected}):null;return <><h1>Preview any business or location.</h1><form onSubmit={e=>{e.preventDefault();if(query.trim())setSelected(query.trim());}}><label htmlFor="map-query">Business name or address</label><input id="map-query" maxLength={500} required value={query} onChange={e=>setQuery(e.target.value)} placeholder="Business name, street and city"/><button className="secondary" type="submit">Preview map</button></form>{preview&&<BusinessMapPreview key={selected} {...preview} autoOpen/>}<p className="micro">Use the Mini map button on any Research or Competitors result. No Places API key or lookup budget is required.</p></>;}

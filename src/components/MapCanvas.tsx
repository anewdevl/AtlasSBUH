'use client';
import { useEffect,useRef,useState } from 'react';
import L from 'leaflet';
import { type Position } from '../lib/cities';
import { categories } from '../lib/categories';
import { competitorId,type Competitor } from '../lib/competitor-view';
type Props={center:Position;radius:number;competitors:Competitor[];selectedId:string|null;selectionTick:number;onSelect:(id:string)=>void;onNavigate:()=>void;onCenter:(p:Position)=>void};
export default function MapCanvas({center,radius,competitors,selectedId,selectionTick,onSelect,onNavigate,onCenter}:Props){
 const host=useRef<HTMLDivElement>(null),map=useRef<L.Map|null>(null),layer=useRef<L.LayerGroup|null>(null);
 const markers=useRef(new Map<string,L.CircleMarker>()),callback=useRef(onCenter),select=useRef(onSelect);
 const [tilesFailed,setTilesFailed]=useState(false);callback.current=onCenter;select.current=onSelect;
 function padding(withDetails=false){
  const m=map.current!,size=m.getSize(),mobile=matchMedia('(max-width:760px)').matches;
  const panel=withDetails?host.current?.parentElement?.querySelector('.competitor-detail')?.getBoundingClientRect():null;
  const rect=host.current!.getBoundingClientRect();
  const coveredBottom=mobile&&panel?Math.max(0,rect.bottom-panel.top):0;
  return {paddingTopLeft:L.point(24,Math.min(160,size.y*.3)),paddingBottomRight:L.point(panel&&!mobile?Math.min(panel.width+48,size.x*.65):40,Math.min(coveredBottom+60,size.y*.65))};
 }
 function navigate(kind:'center'|'results'){
  const m=map.current;if(!m)return;m.stop();m.closePopup();onNavigate();m.invalidateSize({pan:false});
  const bounds=kind==='results'&&competitors.length?L.latLngBounds(competitors.map(c=>[c.coordinates.lat,c.coordinates.lon] as L.LatLngTuple)):L.latLng(center.lat,center.lon).toBounds(radius*2);
  m.fitBounds(bounds,{...(kind==='center'?{padding:L.point(64,64)}:padding()),maxZoom:17,animate:false});
 }
 useEffect(()=>{
  if(!host.current)return;
  const m=L.map(host.current,{zoomControl:false,fadeAnimation:false}).setView([center.lat,center.lon],14);map.current=m;
  L.control.zoom({position:'bottomright'}).addTo(m);
  L.tileLayer(process.env.NEXT_PUBLIC_TILE_URL||'https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'}).on('tileerror',()=>setTilesFailed(true)).addTo(m);
  layer.current=L.layerGroup().addTo(m);m.on('click',(e:L.LeafletMouseEvent)=>callback.current({lat:e.latlng.lat,lon:e.latlng.lng}));
  const observer=new ResizeObserver(()=>m.invalidateSize());observer.observe(host.current);
  return()=>{observer.disconnect();m.remove();map.current=null;};
 // Initial creation is separate from scope and selection updates.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 useEffect(()=>{const m=map.current;if(m){m.stop();m.invalidateSize({pan:false});m.setView([center.lat,center.lon],m.getZoom(),{animate:false});}},[center.lat,center.lon]);
 useEffect(()=>{
  if(!layer.current||!map.current)return;const group=layer.current,m=map.current;m.closePopup();group.clearLayers();markers.current.clear();
  function focusMarker(marker?:L.CircleMarker){const el=marker?.getElement();if(el instanceof SVGElement||el instanceof HTMLElement)el.focus();}
  function choose(id:string){m.closePopup();focusMarker(markers.current.get(id));select.current(id);}
  function activate(id:string){
   const clicked=markers.current.get(id);if(!clicked)return;clicked.closeTooltip();
   const point=m.latLngToContainerPoint(clicked.getLatLng());
   const nearby=competitors.filter(c=>m.latLngToContainerPoint([c.coordinates.lat,c.coordinates.lon]).distanceTo(point)<=18);
   if(nearby.length<2){choose(id);return;}
   const content=document.createElement('section'),heading=document.createElement('strong'),hint=document.createElement('p');
   content.setAttribute('aria-label','Overlapping competitors');content.className='overlap-picker';heading.textContent=`${nearby.length} nearby mapped features`;hint.textContent='Choose a business to inspect. Source locations are unchanged.';content.append(heading,hint);
   for(const c of nearby){const button=document.createElement('button');button.type='button';button.textContent=`${c.name??'Unnamed mapped feature'} · ${c.relation} · ${Math.round(c.distanceMeters)} m`;button.addEventListener('click',()=>choose(competitorId(c)));content.append(button);}
   L.DomEvent.disableClickPropagation(content);L.DomEvent.disableScrollPropagation(content);
   content.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();m.closePopup();focusMarker(clicked);}});
   L.popup({className:'overlap-popup',maxHeight:230,minWidth:220,maxWidth:280,autoPan:true}).setLatLng(clicked.getLatLng()).setContent(content).openOn(m);
   content.querySelector('button')?.focus();
  }
  L.circle([center.lat,center.lon],{radius,color:'var(--accent)',weight:1.5,fillColor:'var(--accent)',fillOpacity:0.07,dashArray:'5 7',interactive:false}).addTo(group);
  L.circleMarker([center.lat,center.lon],{radius:4,color:'var(--paper)',weight:2,fillColor:'var(--accent)',fillOpacity:1,interactive:false,className:'search-center-marker'}).addTo(group);
  for(const c of competitors){
   const id=`${c.sourceType}/${c.sourceId}`,content=document.createElement('div'),name=document.createElement('strong'),meta=document.createElement('span');
   name.textContent=c.name??'Unnamed mapped feature';meta.textContent=`${categories[c.categoryId].label} · ${c.relation} · ${Math.round(c.distanceMeters)} m`;
   content.className='marker-preview';content.append(name,meta);
   const color=c.relation==='direct'?'var(--accent)':'var(--violet)';
   const marker=L.circleMarker([c.coordinates.lat,c.coordinates.lon],{radius:6,color:'var(--paper)',weight:1.5,fillColor:color,fillOpacity:1,bubblingMouseEvents:false,className:`competitor-marker ${c.relation}`}).bindTooltip(content,{direction:'top',offset:[0,-8],className:'competitor-tooltip'}).addTo(group);
   marker.on('click',()=>activate(id));
   const el=marker.getElement();
   if(el){el.setAttribute('data-source-id',id);el.setAttribute('tabindex','0');el.setAttribute('role','button');el.setAttribute('aria-label',`${c.name??'Unnamed mapped feature'}, ${categories[c.categoryId].label}, ${Math.round(c.distanceMeters)} meters`);el.addEventListener('keydown',event=>{const e=event as KeyboardEvent;if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();activate(id);}});el.addEventListener('focus',()=>marker.openTooltip());el.addEventListener('blur',()=>marker.closeTooltip());}
   markers.current.set(id,marker);
  }
 },[center.lat,center.lon,radius,competitors]);
 useEffect(()=>{if(selectedId)map.current?.closePopup();for(const [id,marker] of markers.current){const active=id===selectedId;marker.setRadius(active?10:6);marker.setStyle({weight:active?3:1.5});marker.getElement()?.setAttribute('aria-pressed',String(active));if(active){marker.bringToFront();map.current?.panInside(marker.getLatLng(),{...padding(true),animate:false});}}},[selectedId,selectionTick,competitors]);
 return <><div ref={host} className="map-canvas" aria-label="Interactive area map"/><div className="map-actions" aria-label="Map navigation"><button onClick={()=>navigate('center')}>⌖ Recenter</button><button disabled={!competitors.length} onClick={()=>navigate('results')}>⛶ Fit results</button></div>{tilesFailed&&<div className="tile-warning" role="status">Some map tiles are unavailable. Analysis and the evidence list still work.</div>}</>;
}

'use client';
import { useEffect,useRef,useState } from 'react';
import L from 'leaflet';
import { type Position } from '../lib/cities';
import { type AnalysisResponse } from '../lib/contracts';
export default function MapCanvas({center,radius,result,onCenter}:{center:Position;radius:number;result:AnalysisResponse|null;onCenter:(p:Position)=>void}){
 const host=useRef<HTMLDivElement>(null),map=useRef<L.Map|null>(null),layer=useRef<L.LayerGroup|null>(null),callback=useRef(onCenter);
 const [tilesFailed,setTilesFailed]=useState(false);callback.current=onCenter;
 useEffect(()=>{
  if(!host.current)return;
  const m=L.map(host.current,{zoomControl:false}).setView([center.lat,center.lon],14);map.current=m;
  L.control.zoom({position:'bottomright'}).addTo(m);
  L.tileLayer(process.env.NEXT_PUBLIC_TILE_URL||'https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'}).on('tileerror',()=>setTilesFailed(true)).addTo(m);
  layer.current=L.layerGroup().addTo(m);m.on('click',(e:L.LeafletMouseEvent)=>callback.current({lat:e.latlng.lat,lon:e.latlng.lng}));
  const observer=new ResizeObserver(()=>m.invalidateSize());observer.observe(host.current);
  return()=>{observer.disconnect();m.remove();map.current=null;};
 // Initial map creation is intentionally separate from scope updates.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 useEffect(()=>{if(!map.current||!layer.current)return;const group=layer.current;group.clearLayers();map.current.setView([center.lat,center.lon],map.current.getZoom(),{animate:true});
  L.circle([center.lat,center.lon],{radius,color:'#b9f16c',weight:2,fillColor:'#b9f16c',fillOpacity:0.09,dashArray:'5 6'}).addTo(group);
  L.circleMarker([center.lat,center.lon],{radius:5,color:'#142719',weight:2,fillColor:'#b9f16c',fillOpacity:1}).bindTooltip('Analysis center').addTo(group);
  for(const c of result?.competitors??[]){const content=document.createElement('div'),name=document.createElement('strong'),link=document.createElement('a');name.textContent=c.name??'Unnamed mapped feature';link.textContent='Inspect OpenStreetMap source ↗';link.href=c.sourceUrl;link.target='_blank';link.rel='noopener noreferrer';content.append(name,document.createElement('br'),link);
   L.circleMarker([c.coordinates.lat,c.coordinates.lon],{radius:6,color:c.relation==='direct'?'#12352b':'#7755aa',weight:2,fillColor:c.relation==='direct'?'#c2f687':'#d5bef9',fillOpacity:1}).bindPopup(content).addTo(group);
  }
 },[center.lat,center.lon,radius,result]);
 return <><div ref={host} className="map-canvas" aria-label="Interactive area map"/>{tilesFailed&&<div className="tile-warning" role="status">Some map tiles are unavailable. Analysis and the evidence list still work.</div>}</>;
}

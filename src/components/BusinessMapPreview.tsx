'use client';
import {useState} from 'react';
export default function BusinessMapPreview({name,embedUrl,mapsUrl,identity,autoOpen=false}:{name:string;embedUrl:string;mapsUrl:string;identity?:string;autoOpen?:boolean}){
 const [open,setOpen]=useState(autoOpen);
 return <section className="business-map-preview" aria-label="Business map preview"><button className="secondary" aria-expanded={open} onClick={()=>setOpen(!open)}>{open?'Hide mini map':'Show mini map'}</button>{open&&<><iframe title={`${name} — Google Maps preview`} src={embedUrl} width="600" height="450" style={{border:0}} allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin"/><p className="micro">{identity}. Interactive Google Maps preview. The full business page, reviews and other controls may open on Google Maps.</p><a href={mapsUrl} target="_blank" rel="noreferrer">Open full Google Maps listing ↗</a></>}</section>;
}

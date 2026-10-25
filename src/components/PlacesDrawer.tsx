'use client';
import {useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import PlacesInfo from './PlacesInfo';
import type {PlacesRequest} from '../lib/places';
export default function PlacesDrawer({input,onClose}:{input:PlacesRequest;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),dismiss=useRef(onClose);dismiss.current=onClose;
 useEffect(()=>{const trigger=document.activeElement as HTMLElement|null;dialog.current?.showModal();return()=>{if(trigger?.isConnected)trigger.focus();};},[]);
 return createPortal(<dialog ref={dialog} className="places-dialog app-shell" data-theme="dark" aria-label="Google listing context" onCancel={e=>{e.preventDefault();dismiss.current();}}><div className="places-sheet"><div className="detail-top"><span className="eyebrow">OPTIONAL / GOOGLE LISTING CONTEXT</span><button autoFocus className="secondary" onClick={onClose}>Back to workspace</button></div><PlacesInfo input={input} autoLoad/><p className="micro">Google context supplements the mapped and web evidence. It does not establish specialty offerings, exact branch identity or business viability.</p><footer className="places-footer"><a href="/privacy" target="_blank" rel="noreferrer">Privacy</a><a href="/terms" target="_blank" rel="noreferrer">Terms</a></footer></div></dialog>,document.body);
}

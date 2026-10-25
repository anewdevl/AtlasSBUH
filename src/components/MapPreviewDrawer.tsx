'use client';
import {useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import BusinessMapPreview from './BusinessMapPreview';
import {buildMapPreview,type MapPreviewInput} from '../lib/map-preview';
export default function MapPreviewDrawer({input,onClose}:{input:MapPreviewInput;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),dismiss=useRef(onClose);dismiss.current=onClose;
 useEffect(()=>{const trigger=document.activeElement as HTMLElement|null;dialog.current?.showModal();return()=>{if(trigger?.isConnected)trigger.focus();};},[]);
 const preview=buildMapPreview(input);
 return createPortal(<dialog ref={dialog} className="places-dialog app-shell" data-theme={document.querySelector('.app-shell')?.getAttribute('data-theme') ?? 'dark'} aria-label="Business mini map" onCancel={e=>{e.preventDefault();dismiss.current();}}><div className="places-sheet"><div className="detail-top"><span className="eyebrow">BUSINESS / MINI MAP</span><button autoFocus className="secondary" onClick={onClose}>Back to workspace</button></div><h1>{preview.name}</h1><BusinessMapPreview {...preview} autoOpen/><p className="micro">Confirm the returned business and branch. Map search results do not verify specialty or suitability.</p><footer className="places-footer"><a href="/privacy" target="_blank" rel="noreferrer">Privacy</a><a href="/terms" target="_blank" rel="noreferrer">Terms</a></footer></div></dialog>,document.body);
}

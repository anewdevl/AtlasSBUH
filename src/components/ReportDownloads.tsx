'use client';
import {useEffect,useRef,useState} from 'react';
import type {ResearchReport} from '../lib/research-contracts';
export default function ReportDownloads({report,locationLabel}:{report:ResearchReport;locationLabel:string}){
 const [busy,setBusy]=useState<'pdf'|'pptx'|null>(null),[error,setError]=useState(''),[message,setMessage]=useState('');
 const epoch=useRef(0),control=useRef<AbortController|null>(null);
 useEffect(()=>{epoch.current++;control.current?.abort();setBusy(null);setError('');setMessage('');return()=>{epoch.current++;control.current?.abort();};},[report,locationLabel]);
 async function download(format:'pdf'|'pptx'){
  const id=++epoch.current,controller=new AbortController();control.current=controller;setBusy(format);setError('');setMessage('');
  try{
   const [{buildExportBrief,exportFilename},{createReportPdf,createReportDeck}]=await Promise.all([import('../lib/report-export'),import('../lib/report-files')]);
   const brief=buildExportBrief(report,locationLabel),bytes=await(format==='pdf'?createReportPdf(brief,controller.signal):createReportDeck(brief,controller.signal));
   if(id!==epoch.current)return;
   const blob=new Blob([Uint8Array.from(bytes).buffer],{type:format==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.presentationml.presentation'});
   const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=exportFilename(report,format);document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
   setMessage(format==='pdf'?'PDF download ready.':'PowerPoint download ready.');
  }catch(e){if(id===epoch.current)setError(e instanceof Error&&e.name==='AbortError'?'Export canceled.':'Could not prepare this download. Please try again.');}
  finally{if(id===epoch.current)setBusy(null);}
 }
 return <div className="report-downloads" aria-label="Report downloads"><div><button className="secondary" disabled={busy!==null} onClick={()=>download('pdf')}>{busy==='pdf'?'Preparing PDF…':'Download PDF'}</button><button className="secondary" disabled={busy!==null} onClick={()=>download('pptx')}>{busy==='pptx'?'Preparing slides…':'Download slides (.pptx)'}</button></div><p className="micro">Export this report with sources and limitations. Slides are editable. No new research requests.</p>{busy&&<p role="status">Preparing your {busy==='pdf'?'PDF report':'PowerPoint deck'}…</p>}{message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}</div>;
}

import PlacesInfo from '../../components/PlacesInfo';
import {placesRequestSchema} from '../../lib/places';
export default async function PlacesPage({searchParams}:{searchParams:Promise<{context?:string|string[]}>}){
 const {context}=await searchParams;let raw:unknown;
 try{if(typeof context==='string'&&context.length<=4096)raw=JSON.parse(context);}catch{}
 const parsed=placesRequestSchema.safeParse(raw);
 return <div className="app-shell" data-theme="dark"><main className="places-page"><a className="brand" href="/">ATLAS</a><p className="eyebrow">OPTIONAL / PLACE DETAILS</p>{parsed.success?<PlacesInfo input={parsed.data}/>:<><h1>Select a mapped competitor first.</h1><p>Open competitor details in the explorer, then select Extra info (Google).</p></>}<footer className="places-footer"><a href="/">Open explorer</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a></footer></main></div>;
}

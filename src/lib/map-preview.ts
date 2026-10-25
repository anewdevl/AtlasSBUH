export type MapPreviewInput={name?:string|null;address?:string|null;city?:string;coordinates?:{lat:number;lon:number};placeId?:string};
/** Google handles the public map search and redirects to its embeddable map view. */
export function buildMapPreview(input:MapPreviewInput){
 const name=input.name?.trim(),address=input.address?.trim(),p=input.coordinates;
 const validPosition=p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&Math.abs(p.lat)<=90&&Math.abs(p.lon)<=180;
 const point=validPosition?`${p.lat},${p.lon}`:undefined;
 const query=name?[name,address??input.city,point?`near ${point}`:undefined].filter(Boolean).join(' '):point??address??input.city;
 if(!query)throw new Error('Choose a business or location to preview.');
 const embed=new URL('https://www.google.com/maps');embed.search=new URLSearchParams({q:query,output:'embed',z:'17',hl:'en'}).toString();if(point)embed.searchParams.set('ll',point);
 const full=new URL('https://www.google.com/maps/search/');full.search=new URLSearchParams({api:'1',query:query,...(input.placeId?{query_place_id:input.placeId}:{})}).toString();
 return {name:name??'Selected mapped location',embedUrl:embed.href,mapsUrl:full.href,identity:name?'Business search; confirm the returned branch. The full listing link uses a Google place ID when available':'Coordinates only; no business identity verified'};
}

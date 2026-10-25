import {it,expect} from 'vitest';
import {buildMapPreview} from '../../src/lib/map-preview';
it('builds different mini maps for arbitrary businesses rather than a fixed sample',()=>{
 const a=buildMapPreview({name:'Synthetic Café',city:'London',coordinates:{lat:51.5137,lon:-0.1365}}),b=buildMapPreview({name:'Synthetic Bookshop',city:'Singapore',coordinates:{lat:1.3,lon:103.85}});
 expect(a.embedUrl).not.toBe(b.embedUrl);expect(new URL(a.embedUrl).searchParams.get('q')).toContain('Synthetic Café London near 51.5137,-0.1365');expect(new URL(b.embedUrl).searchParams.get('q')).toContain('Synthetic Bookshop Singapore');
 expect(new URL(a.mapsUrl).searchParams.get('query')).toContain('51.5137,-0.1365');expect(a.embedUrl).not.toContain('key=');expect(a.embedUrl).not.toContain('Atelier');
});
it('supports coordinate-only unnamed features and keeps supplied Google identity in the full listing link',()=>{
 const location=buildMapPreview({coordinates:{lat:40.7,lon:-74}});expect(new URL(location.embedUrl).searchParams.get('q')).toBe('40.7,-74');
 const exact=buildMapPreview({name:'Example',placeId:'ChIJfixture'});expect(new URL(exact.embedUrl).searchParams.get('q')).toBe('Example');expect(new URL(exact.mapsUrl).searchParams.get('query_place_id')).toBe('ChIJfixture');
});
it('encodes names as search data and never lets input replace the iframe origin',()=>{
 const preview=buildMapPreview({name:'https://attacker.example/?output=bad & key=secret'});const url=new URL(preview.embedUrl);expect(url.origin).toBe('https://www.google.com');expect(url.searchParams.get('output')).toBe('embed');expect(url.searchParams.has('key')).toBe(false);expect(()=>buildMapPreview({})).toThrow();
});

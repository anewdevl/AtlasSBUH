import {describe,it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import {PDFDocument} from 'pdf-lib';
import JSZip from 'jszip';
import {buildExportBrief} from '../../src/lib/report-export';
import {createReportPdf,createReportDeck,wrapExportText} from '../../src/lib/report-files';
import {stages} from '../../src/lib/research-contracts';
import {request,result} from '../fixtures';
import {shortlistBusinesses} from '../../src/lib/business-shortlist';
const quote='Synthetic café offers a weekday breakfast menu.';
function report(){return {request:{description:'A café serving breakfast',scope:request.scope,osmRequest:request,localOnly:true},status:'partial',startedAt:'2026-10-24T20:00:00.000Z',shortlist:shortlistBusinesses(result(), 'coffee shop'),evidence:[{id:'web1',url:'https://fixture.example/menu',provider:'tavily',retrievedAt:'2026-10-24T19:00:00.000Z',title:'Synthetic café menu',excerpt:quote,contentKind:'page',placeId:null,coordinates:null}],findings:[{id:'f1',kind:'offering',claim:'The source lists breakfast.',business:'Synthetic café',relation:'direct',evidence:[{sourceId:'web1',quote}],geographicRelevance:'Exact branch unconfirmed.',limitations:['One source only.'],reviewSampleSize:null,reviewDates:null}],insights:[{id:'i1',kind:'experiment',recommendation:'Interview potential breakfast customers.',findingIds:['f1'],reasoning:'The source shows an existing breakfast offering.',uncertainty:'Demand is unmeasured.',validation:'Interview customers before committing.'}],stages:stages.map(stage=>({stage,status:'partial',message:'Synthetic stage.'})),warnings:['Some pages were unavailable.'],unknowns:['Rent is unknown.']};}
describe('Report exports',()=>{
 it('uses existing evidence, caveats, status and original dates without creating a recommendation',()=>{
  const brief=buildExportBrief(report(),'Selected map pin'),text=JSON.stringify(brief.sections);
  expect(text).toContain(quote);expect(text).toContain('2026-10-24T19:00:00.000Z');expect(text).toContain('Exact branch unconfirmed.');expect(text).toContain('Run status: partial');expect(text).toContain('https://fixture.example/menu');expect(text).toContain('Supporting sources: S1');expect(brief.slides).toHaveLength(6);expect(text).not.toContain('Recommended');expect(text).toContain('Location recommendation: Not recommended');expect(text).not.toContain('80%');
  const invalid=report();invalid.findings[0].evidence[0].sourceId='invented';expect(()=>buildExportBrief(invalid,'Pin')).toThrow();
 });
 it('preserves long text and URLs while wrapping, including single long tokens',()=>{
  const text='Long '+ 'a'.repeat(200)+'\nCafé and more words';
  const lines=wrapExportText(text,20,value=>value.length);expect(lines.every(l=>l.length<=20)).toBe(true);expect(lines.join('').replace(/\s/g,'')).toBe(text.replace(/\s/g,''));
 });
 it('generates a real PDF with embedded fonts, pagination and clickable source references',async()=>{
  const brief=buildExportBrief(report(),'Washington Square'),fonts={regular:await readFile('public/fonts/NotoSans-Regular.ttf'),bold:await readFile('public/fonts/NotoSans-Bold.ttf')};
  const bytes=await createReportPdf(brief,undefined,fonts),pdf=await PDFDocument.load(bytes);
  expect(new TextDecoder().decode(bytes.slice(0,5))).toBe('%PDF-');expect(pdf.getPageCount()).toBeGreaterThan(1);expect(pdf.getTitle()).toContain('ATLAS');expect(pdf.getPages().some(p=>(p.node.Annots()?.size()??0)>0)).toBe(true);
 },15000);
 it('generates editable slides and notes preserving citations, dates and uncertainty',async()=>{
  const brief=buildExportBrief(report(),'Washington Square'),bytes=await createReportDeck(brief),zip=await JSZip.loadAsync(bytes);
  const slides=Object.keys(zip.files).filter(p=>/^ppt\/slides\/slide\d+\.xml$/.test(p));expect(slides.length).toBeGreaterThanOrEqual(11);
  const xml=(await Promise.all(slides.map(p=>zip.file(p)!.async('string')))).join('');expect(xml).toContain('partial');expect(xml).toContain('Sources and attribution');expect(xml).toContain('Location recommendation: Not recommended');
  const notes=(await Promise.all(Object.keys(zip.files).filter(p=>/^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(p)).map(p=>zip.file(p)!.async('string')))).join('');expect(notes).toContain(quote);expect(notes).toContain('https://fixture.example/menu');expect(notes).toContain('2026-10-24T19:00:00.000Z');expect(notes).toContain('Demand is unmeasured.');
 },15000);
});

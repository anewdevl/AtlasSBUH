import type {ExportBrief,ExportSection} from './report-export';

function sourceLink(value:string):string|undefined{
 try{if(!/^https:\/\/\S+$/.test(value))return;const url=new URL(value);return url.username||url.password?undefined:url.href;}catch{return;}
}

/** Explicit line wrapping also splits long URLs, so nothing is silently clipped. */
export function wrapExportText(text:string,width:number,measure:(value:string)=>number):string[]{
 const result:string[]=[];
 for(const paragraph of text.replace(/\r/g,'').split('\n')){
  let line='';
  for(const word of paragraph.split(/\s+/).filter(Boolean)){
   if(measure(line?`${line} ${word}`:word)<=width){line=line?`${line} ${word}`:word;continue;}
   if(line){result.push(line);line='';}
   if(measure(word)<=width){line=word;continue;}
   for(const char of word){if(line&&measure(line+char)>width){result.push(line);line='';}line+=char;}
  }
  result.push(line);
 }
 return result;
}

export async function createReportPdf(brief:ExportBrief,signal?:AbortSignal,fontBytes?:{regular:Uint8Array;bold:Uint8Array}):Promise<Uint8Array>{
 const [{PDFDocument,rgb,PDFString},{default:fontkit}]=await Promise.all([import('pdf-lib'),import('@pdf-lib/fontkit')]);
 const load=async(name:string)=>{const response=await fetch(`/fonts/NotoSans-${name}.ttf`,{signal});if(!response.ok)throw new Error('Report font unavailable. Please retry.');return new Uint8Array(await response.arrayBuffer());};
 const fonts=fontBytes??{regular:await load('Regular'),bold:await load('Bold')};
 signal?.throwIfAborted();
 const doc=await PDFDocument.create();doc.registerFontkit(fontkit);
 const regular=await doc.embedFont(fonts.regular,{subset:true}),bold=await doc.embedFont(fonts.bold,{subset:true});
 doc.setTitle(`ATLAS | ${brief.scope}`);doc.setAuthor('ATLAS');doc.setSubject(brief.report.request.description);doc.setCreationDate(new Date());
 const supported=new Set(regular.getCharacterSet());let substituted=false;
 const safe=(value:string)=>Array.from(value).map(c=>{if(c==='\n'||c==='\r'||supported.has(c.codePointAt(0)!))return c;substituted=true;return `[U+${c.codePointAt(0)!.toString(16).toUpperCase()}]`;}).join('');
 const ink=rgb(.08,.14,.19),muted=rgb(.30,.37,.42),accent=rgb(.02,.42,.36);
 let page=doc.addPage([595.28,841.89]),y=0;
 const top=()=>{page.drawText('ATLAS / BUSINESS RESEARCH',{x:48,y:800,size:9,font:bold,color:accent});y=761;};top();
 const ensure=(height:number)=>{if(y-height<60){page=doc.addPage([595.28,841.89]);top();}};
 const text=(value:string,size=10.5,strong=false,link?:string)=>{
  const font=strong?bold:regular,lines=wrapExportText(safe(value),499.28,t=>font.widthOfTextAtSize(t,size));
  for(const line of lines){ensure(size*1.5);page.drawText(line,{x:48,y,size,font,color:link?accent:strong?ink:muted});
   if(link&&line){const annotation=doc.context.obj({Type:'Annot',Subtype:'Link',Rect:[48,y-2,48+font.widthOfTextAtSize(line,size),y+size+2],Border:[0,0,0],A:{Type:'Action',S:'URI',URI:PDFString.of(link)}});page.node.addAnnot(doc.context.register(annotation));}
   y-=size*1.48;
  }
  y-=7;
 };
 text('Business location brief',29,true);text(`Exported: ${new Date().toISOString()}`,9);
 for(const section of brief.sections){
  signal?.throwIfAborted();ensure(82);y-=10;text(section.title,16,true);
  for(const paragraph of section.paragraphs){const height=wrapExportText(safe(paragraph),499.28,t=>regular.widthOfTextAtSize(t,10.5)).length*15.54+paragraph.split('\n').length*7;if(height<640)ensure(height);for(const line of paragraph.split('\n'))text(line,10.5,/^(F\d+ |S\d+ |\d+\. (interpretation|hypothesis|experiment):)/.test(line),sourceLink(line));}
 }
 if(substituted)text('Characters unavailable in the embedded font are preserved as [U+XXXX] code points. Consult the original source for their original script.',9);
 const pages=doc.getPages();pages.forEach((p,index)=>{p.drawText('ATLAS | Evidence and validation advice',{x:48,y:31,size:8,font:regular,color:muted});p.drawText(`${index+1} / ${pages.length}`,{x:502,y:31,size:8,font:regular,color:muted});});
 return doc.save();
}

export async function createReportDeck(brief:ExportBrief,signal?:AbortSignal):Promise<Uint8Array>{
 const [{default:PptxGenJS},{PDFDocument,StandardFonts}]=await Promise.all([import('pptxgenjs'),import('pdf-lib')]);
 const metrics=await PDFDocument.create(),font=await metrics.embedFont(StandardFonts.Helvetica);
 const measure=(value:string,size:number)=>font.widthOfTextAtSize(value.replace(/[^\x20-\x7e\u00a0-\u00ff]/g,'WW'),size);
 const pptx=new PptxGenJS();pptx.layout='LAYOUT_WIDE';pptx.author='ATLAS';pptx.subject=brief.report.request.description;pptx.title=`ATLAS | ${brief.scope}`;pptx.company='ATLAS';pptx.theme={headFontFace:'Arial',bodyFontFace:'Arial'};
 const sourceNotes=brief.report.evidence.map((s,i)=>`S${i+1}: ${s.title}\n${s.url}\nRetrieved ${s.retrievedAt} | ${s.provider}`).join('\n\n');
 let number=0;
 function add(section:ExportSection,appendix=false){
  const size=appendix?17:20,capacity=appendix?17:14,step=appendix ? .30 : .345;
  let lines:{text:string;url?:string}[]=[];
  for(const paragraph of section.paragraphs){
   const link=sourceLink(paragraph);
   lines.push(...wrapExportText(paragraph,745,t=>measure(t,size)).map(text=>({text,url:link})),{text:''});
  }
  if(lines.length&&lines.at(-1)?.text==='')lines.pop();
  const chunks=Array.from({length:Math.max(1,Math.ceil(lines.length/capacity))},(_,i)=>lines.slice(i*capacity,(i+1)*capacity));
  if(chunks.length>1&&chunks.at(-1)!.length<5){const previous=chunks.at(-2)!,last=chunks.at(-1)!;last.unshift(...previous.splice(previous.length-(5-last.length)));}
  for(const [index,chunk] of chunks.entries()){
   signal?.throwIfAborted();const slide=pptx.addSlide();slide.background={color:'FAFBFC'};number++;
   slide.addText(appendix?'ATLAS / EVIDENCE APPENDIX':'ATLAS / BUSINESS RESEARCH',{x:.65,y:.3,w:11.9,h:.22,fontFace:'Arial',fontSize:10,charSpacing:1.5,color:'087B68',margin:0});
   slide.addText(`${section.title}${index?' (continued)':''}`,{x:.65,y:.78,w:12,h:.65,fontFace:'Arial',fontSize:number===1?40:32,bold:true,color:'142D3D',margin:0,breakLine:false});
   chunk.forEach((line,i)=>{if(line.text)slide.addText(line.text,{x:.68,y:1.7+i*step,w:11.95,h:.34,fontFace:'Arial',fontSize:size,color:line.url?'087B68':'344D5D',margin:0,breakLine:false,hyperlink:line.url?{url:line.url}:undefined});});
   slide.addText(`${brief.report.request.scope.cityId.toUpperCase()} | ${brief.report.request.scope.radiusMeters} m | ${brief.report.status} run | ${number}`,{x:.65,y:7.02,w:12,h:.2,fontFace:'Arial',fontSize:9,color:'5A6E7C',margin:0});
   slide.addNotes(`${section.title}\n\n${section.paragraphs.join('\n\n')}\n\nOriginal research started: ${brief.date}\n${brief.scope}\n\nSources:\n${sourceNotes}\n\nMapped data: © OpenStreetMap contributors, ODbL. https://www.openstreetmap.org/copyright\nA complete run is not exhaustive market coverage. No opening recommendation is established.`);
  }
 }
 brief.slides.forEach(section=>add(section));
 // Full observations, uncertainty, quotes and references remain editable in the appendix.
 brief.sections.slice(1).forEach(section=>add(section,true));
 signal?.throwIfAborted();
 const output=await pptx.write({outputType:'uint8array',compression:true});
 if(output instanceof Uint8Array)return output;
 if(output instanceof ArrayBuffer)return new Uint8Array(output);
 if(output instanceof Blob)return new Uint8Array(await output.arrayBuffer());
 throw new Error('Could not generate the slide deck.');
}

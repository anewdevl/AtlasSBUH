import {reportSchema,type ResearchReport} from './research-contracts';
import {cities} from './cities';
import {categories} from './categories';
export type ExportSection={title:string;paragraphs:string[]};
export type ExportBrief={report:ResearchReport;locationLabel:string;scope:string;date:string;sections:ExportSection[];slides:ExportSection[]};
export const exportLimits='Mapped coverage is unknown. Rent, footfall, customer demand, zoning and profitability have not been established. This report does not establish an opening recommendation.';
export function buildExportBrief(raw:unknown,locationLabel:string):ExportBrief{
 const report=reportSchema.parse(raw),r=report.request;
 const scope=`${cities[r.scope.cityId].label} | ${r.scope.center.lat.toFixed(4)}, ${r.scope.center.lon.toFixed(4)} | ${r.scope.radiusMeters} m radius`;
 const date=new Date(report.startedAt).toISOString();
 const refs=(ids:string[])=>[...new Set(ids)].map(id=>`S${report.evidence.findIndex(e=>e.id===id)+1}`).join(', ');
 const findingRefs=(ids:string[])=>refs(report.findings.filter(f=>ids.includes(f.id)).flatMap(f=>f.evidence.map(e=>e.sourceId)));
 const summary=[`Business: ${r.description}`,`Selected location: ${locationLabel.trim().slice(0,1000)||'Selected map pin'}`,scope,`Research started: ${date}`,`Run status: ${report.status}. This describes the bounded run, not exhaustive market coverage.`,`${report.shortlist.length} named mapped features | ${report.findings.length} supported observations | ${report.insights.length} proposed next steps | ${report.evidence.length} retrieved sources`,exportLimits];
 const context=report.osmContext?[`Mapped context retrieved: ${report.osmContext.fetchedAt} | ${report.osmContext.status}`,`Direct mapped features: ${report.osmContext.directMappedCount??'Unavailable'} | Adjacent mapped features: ${report.osmContext.adjacentMappedCount??'Unavailable'}`]:['No separate aggregate OSM context is available in this report.'];
 const shortlist=report.shortlist.slice(0,10).map((b,i)=>`${i+1}. ${b.name} | ${categories[b.categoryId].label} | ${Math.round(b.distanceMeters)} m straight-line distance\n${b.matchReason}\n${b.positionKind==='representative-center'?'Representative mapped center; entrance unverified.':'Mapped point; entrance unverified.'}\n${b.sourceUrl}`);
 const observations=report.findings.flatMap((f,i)=>[
  `F${i+1} | ${f.business??'Source observation'} | ${f.kind} | ${f.relation}`,
  f.claim,...f.evidence.map(e=>`[${refs([e.sourceId])}] Quote: ${e.quote}`),
  `Geographic relevance: ${f.geographicRelevance}`,
  ...(f.kind==='feedback'?[`Review sample: ${f.reviewSampleSize??'Unknown'} | Review dates: ${f.reviewDates??'Unknown'}. This is not a representative survey.`]:[]),
  `Limitations: ${f.limitations.join(' ')}`,
 ]);
 const insights=report.insights.flatMap((i,n)=>[
  `${n+1}. ${i.kind}: ${i.recommendation}`,`Reasoning: ${i.reasoning}`,`Uncertainty: ${i.uncertainty}`,`Validate next: ${i.validation}`,`Supporting sources: ${findingRefs(i.findingIds)}`,
 ]);
 const unknowns=[exportLimits,...report.warnings,...report.unknowns,...(!report.findings.some(f=>f.kind==='price')?['No monetary price passed the evidence checks.']:[]),...(!report.findings.some(f=>f.kind==='feedback')?['No usable review text passed the evidence checks.']:[])];
 const sources=report.evidence.flatMap((e,i)=>[`S${i+1} | ${e.provider==='google-maps'?'Google Maps':e.provider} | ${e.title}`,e.url,`Retrieved: ${e.retrievedAt} | ${e.contentKind}`,...(e.provider==='google-maps'?['Google Maps provider-generated context; exact branch and radius membership unverified.']:[])]);
 const content:ExportSection[]=[
  {title:'Business and selected location',paragraphs:summary},
  {title:'Mapped competition',paragraphs:[...context,`Showing up to 10 of ${report.shortlist.length} named mapped features. Features are not unique businesses.`,...shortlist,...(!shortlist.length?['No named mapped shortlist is available. This does not establish absence of competitors.']:[]),'Shortlist ranking: 80% category/text relevance, 20% proximity. Match scores are not business quality or location suitability. Web name matches do not confirm the exact local branch.']},
  {title:'Supported observations',paragraphs:observations.length?observations:['No verified findings available in this run.']},
  {title:'Business insights and validation',paragraphs:insights.length?insights:['Insufficient verified evidence for insights.']},
  {title:'Unknowns and limitations',paragraphs:unknowns},
  {title:'Sources and attribution',paragraphs:[...sources,...(!sources.length?['No external sources were retrieved.']:[]),'Mapped data: © OpenStreetMap contributors | ODbL','https://www.openstreetmap.org/copyright','Original retrieval dates are preserved. Exporting adds no new research or verification.']},
 ];
 const excerpt=(s:string,max=240)=>s.length>max?`${s.slice(0,max).trimEnd()}… [excerpt; full text in appendix]`:s;
 const slides:ExportSection[]=[
  {title:'Business location brief',paragraphs:[r.description,scope,`Research started: ${date}`,`Run status: ${report.status}`, 'Evidence and proposed next steps; no opening recommendation established']},
  {title:'Evidence overview',paragraphs:[`${report.shortlist.length} named mapped features`,`${report.findings.length} supported observations from ${report.evidence.length} retrieved sources`,`${report.insights.length} proposed next steps`,...(report.osmContext?[`OSM: ${report.osmContext.status}; ${report.osmContext.directMappedCount??'Unavailable'} direct / ${report.osmContext.adjacentMappedCount??'Unavailable'} adjacent. Retrieved ${report.osmContext.fetchedAt}`]:['No separate aggregate OSM context.']),'Coverage is unknown; a completed run is not a complete market census.']},
  {title:'Nearby mapped businesses',paragraphs:report.shortlist.length?report.shortlist.slice(0,3).map(b=>`${excerpt(b.name,120)} | ${categories[b.categoryId].label} | ${Math.round(b.distanceMeters)} m\nMapped feature; exact web branch identity unconfirmed.`):['No named mapped shortlist is available. This does not prove there are no competitors.']},
  {title:'Supported observations',paragraphs:report.findings.length?[...report.findings.slice(0,3).map(f=>`${excerpt(f.claim,160)} [${refs(f.evidence.map(e=>e.sourceId))}]`),'Web name matches may refer to another branch or the whole brand. Full findings and limitations are in the appendix.']:['No verified findings available. Source availability and geographic support remain uncertain.']},
  {title:'Proposed next steps',paragraphs:report.insights.length?report.insights.slice(0,3).map(i=>`${i.kind}: ${excerpt(i.recommendation,160)} [${findingRefs(i.findingIds)}]`):['No evidence-supported insights were produced. Validate the concept and collect additional sources.']},
  {title:'Before committing to premises',paragraphs:[exportLimits,...report.unknowns.slice(0,2).map(s=>excerpt(s)),...report.warnings.slice(0,1).map(s=>excerpt(s))]},
 ];
 const sections=[content[0],content[3],content[2],content[1],content[4],content[5]];
 return {report,scope,date,locationLabel,sections,slides};
}
export function exportFilename(report:ResearchReport,format:'pdf'|'pptx'){
 const city=report.request.scope.cityId,date=report.startedAt.slice(0,10);
 return `atlas-${city}-research-${date}.${format}`;
}

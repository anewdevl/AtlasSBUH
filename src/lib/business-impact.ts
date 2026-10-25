import {normalizedName,businessQualifiers} from './business-shortlist';
import type {BusinessImpact,BusinessAssessment,Finding,ResearchRequest} from './research-contracts';
const groups=[['coffee','espresso','latte','cappuccino','cafe'],['clothing','clothes','apparel','fashion','garments'],['software','saas'],['books','bookshop','bookstore'],['hair','haircut','barber'],['gym','fitness']];
const terms=(text:string)=>normalizedName(text).split(' ').filter(t=>t.length>2&&!['the','and','for','with','shop','store','business'].includes(t));
export function offeringsOverlap(a:string,b:string){const left=terms(a),right=terms(b);return left.some(t=>right.includes(t)||groups.some(g=>g.includes(t)&&right.some(x=>g.includes(x))));}
export function groundedImpacts(rows:BusinessImpact[],findings:Finding[],request:ResearchRequest){
 const seen=new Set<string>();return rows.filter(i=>{
  if(seen.has(normalizedName(i.business)))return false;
  const support=i.findingIds.map(id=>findings.find(f=>f.id===id));
  if(!support.length||support.some(f=>!f||f.business!==i.business||!['offering','price'].includes(f.kind)))return false;
  if(!request.description.toLowerCase().includes(i.yourOffering.toLowerCase())||!support.some(f=>f!.evidence.some(e=>e.quote.includes(i.competitorOffering))))return false;
  if(i.effect==='competition'&&!offeringsOverlap(i.yourOffering,i.competitorOffering))return false;
  seen.add(normalizedName(i.business));return true;
 });
}
export function impactExplanation(i:BusinessImpact,request:ResearchRequest){
 const specialty=request.osmRequest?businessQualifiers(request.description,request.osmRequest.categoryId):[];
 const unverified=specialty.filter(t=>!terms(i.competitorOffering).includes(t));
 if(i.effect==='competition')return `May compete for spending on similar offerings.${unverified.length?` Specialty overlap (${unverified.join(', ')}) remains unverified.`:''} This does not establish lost customers or sales.`;
 if(i.effect==='complement')return 'Could complement your business if customers use both offerings. Customer crossover has not been measured.';
 if(i.effect==='limited-overlap')return 'The retrieved offering differs from your proposal. Its competitive effect remains uncertain; this does not prove there is no competition.';
 return 'The available source does not establish how this business would affect yours.';
}
/** A judgment may be subjective; new measurable facts cannot be introduced to justify it. */
export function assessmentHasUnsupportedFacts(a:BusinessAssessment,findings:Finding[]){
 const support=a.findingIds.flatMap(id=>findings.find(f=>f.id===id)?.evidence.map(e=>e.quote)??[]).join(' ');
 const narrative=[a.reasoning,...a.risks].join(' ');
 const numbers=narrative.match(/\d+(?:[.,]\d+)?/g)??[];
 if(numbers.some(n=>!support.includes(n)))return true;
 return /\b(?:guaranteed|proven demand|high demand|strong demand|high footfall|high foot traffic|only (?:one|two|three) (?:nearby |local )?competitors?|no (?:other |nearby |local )?(?:competitors|cafes|cafés)|low rent|affordable rent|underserved market|will succeed|will be profitable|will increase sales)\b/i.test(narrative);
}

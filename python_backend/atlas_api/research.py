"""Budgeted state machine: mapped candidates -> retrieval -> extraction -> review.

Models return data/IDs. Only the coordinator executes a fixed set of tools.
"""
import asyncio
import re
import time
import unicodedata
from typing import Literal
from pydantic import create_model
from urllib.parse import unquote,urlsplit
from .providers import ProviderError
from .runtime import stamp
from .schemas import CATEGORIES,CITIES,Choice,Selection,Extraction,Synthesis,Verification

STAGES=['planning','web','insights','verification','reporting']
UNKNOWN=[
    'Mapped coverage is unknown; distinct OSM objects can represent the same business. Only up to three distinct named candidates receive web enrichment.',
    'A brand page does not confirm offerings at the mapped branch. Branch identity and current opening status require local verification.',
    'Broad category matches do not establish specialty overlap. Missing prices, review dates and sample sizes remain unknown.',
    'This bounded sample cannot establish market coverage, customer demand, rent, footfall, revenue or profitability.',
]

def normalized(value):
    return ' '.join(re.sub(r'[^\w]+',' ',''.join(c for c in unicodedata.normalize('NFKD',value).lower() if not unicodedata.combining(c))).split())

def names(value):
    full=normalized(value)
    short=re.sub(r'\s+(coffee roasters|coffee roasting company|inc|llc)$','',full)
    return {full,short} if len(short)>=6 else {full}

def shortlist(mapped,description):
    category=mapped['request']['categoryId']
    generic=set(normalized(' '.join([CATEGORIES[category]['label'],*CATEGORIES[category]['aliases'],'business shop store company open opening want would like start sell selling a an the in at with and for of to my new'])).split())
    qualifiers=set(w for w in normalized(description).split() if len(w)>2 and w not in generic)
    rows=[]
    for row in mapped['competitors']:
        if not row['name']:
            continue
        tokens=set(normalized(row['name']+' '+' '.join(row['evidence'].values())).split())
        matches=qualifiers & tokens
        relevance=(40 if row['relation']=='direct' else 10)+(40*len(matches)/len(qualifiers) if qualifiers else 0)
        proximity=max(0,1-row['distanceMeters']/mapped['request']['scope']['radiusMeters'])*100
        rows.append(dict(id=f'{row["sourceType"]}/{row["sourceId"]}',name=row['name'],coordinates=row['coordinates'],distanceMeters=row['distanceMeters'],positionKind=row['positionKind'],categoryId=row['categoryId'],relation=row['relation'],relevanceScore=relevance,rankScore=round(.8*relevance+.2*proximity,1),matchReason=f'Mapped category: {CATEGORIES[row["categoryId"]]["label"]}. '+(f'Specialty requirements: {", ".join(sorted(qualifiers))}. '+('Mapped text mentions '+', '.join(sorted(matches))+'; offerings still require verification.' if matches else 'No specialty evidence in this mapped record.') if qualifiers else 'Category membership alone does not verify competitive relevance.'),sourceUrl=row['sourceUrl']))
    return sorted(rows,key=lambda b:(-b['rankScore'],b['distanceMeters'],b['id']))

def source_allowed(source,business):
    path=unquote(urlsplit(source['url']).path).lower()
    if re.search(r'/(news|blogs?|articles?|press|press-release|magazine|search|search-results)(/|$)',path) or re.search(r'\b(top\s+\d+|best\s+\d+|roundup|round-up|news|stock market|press release|best .* (in|for))\b',source['title'],re.I):
        return False
    if re.search(r'(^|\.)(reuters|bbc|cnn|nytimes|theguardian|forbes)\.(com|co\.uk)$',urlsplit(source['url']).hostname or ''):
        return False
    text=' '+normalized(source['title']+' '+source['excerpt'])+' '
    return any(' '+alias+' ' in text for alias in names(business))

def category_allowed(source,category):
    text=normalized(source['title']+' '+source['excerpt'])
    title=normalized(source['title'])
    identities=[(r'\b(?:is a|is an|we are a|we are an) software company\b',{'software'}),
                (r'\b(?:is a|is an|we are a|we are an) restaurant\b',{'restaurant','fast-food','cafe','bar'}),
                (r'\b(?:is a|is an|we are a|we are an) (?:clothing store|fashion boutique)\b',{'clothing'}),
                (r'\b(?:is a|is an|we are a|we are an) dental clinic\b',{'dentist','clinic'}),
                (r'\b(?:is a|is an|we are a|we are an) law firm\b',{'lawyer'})]
    if any(re.search(pattern,text) and category not in accepted for pattern,accepted in identities):
        return False
    food={'cafe','bakery','bubble-tea','restaurant','fast-food','bar','ice-cream'}
    if category not in food and re.search(r'\b(restaurant|food delivery|takeout|dinner menu)\b',title):
        return False
    if category in food and re.search(r'\b(clothing|apparel|law firm|dental clinic)\b',title):
        return False
    signals={
        'cafe':r'coffee|cafe|espresso|latte|cappuccino','bakery':r'bakery|bakeries|bread|pastry|pastries|baked|cakes',
        'bubble-tea':r'boba|bubble tea|milk tea','pharmacy':r'pharmacy|pharmacies|prescriptions|drugstore',
        'supermarket':r'supermarket|groceries|grocery|food market','restaurant':r'restaurant|dining|menu|cuisine|dinner|lunch',
        'fast-food':r'fast food|takeaway|takeout|burger|pizza|sandwich|menu','bar':r'bar|pub|cocktail|beer|wine',
        'ice-cream':r'ice cream|gelato|sorbet','convenience':r'convenience|groceries|grocery|corner store',
        'clothing':r'clothing|clothes|fashion|apparel|boutique|garments|wear|designer|resale|vintage',
        'shoes':r'shoes|footwear','electronics':r'electronics|computer|computers|laptop|phones|devices',
        'books':r'books|bookstore|bookshop|bookseller','florist':r'florist|flowers|bouquet|floral',
        'pet-shop':r'pet|pets|petfood|aquarium|dog supplies|cat supplies','hairdresser':r'hair|hairdresser|barber|haircut|salon',
        'beauty':r'beauty|nail|nails|salon|cosmetics|skincare','laundry':r'laundry|laundromat|dry cleaning|dry cleaner',
        'gym':r'gym|fitness|workout|exercise|training','dentist':r'dentist|dental|dentistry|orthodontic',
        'clinic':r'clinic|medical|healthcare|physician|doctor','veterinary':r'veterinary|veterinarian|vet|animal hospital',
        'car-repair':r'auto repair|car repair|mechanic|automotive|vehicle service','hotel':r'hotel|guest house|rooms|accommodation|lodging',
        'software':r'software|technology|tech|information technology|it services|saas|cloud',
        'coworking':r'coworking|co working|workspace|shared office','estate-agent':r'real estate|estate agent|property|properties|realtor',
        'accountant':r'accountant|accounting|bookkeeping|tax|audit','lawyer':r'lawyer|law firm|attorney|legal|solicitor',
    }
    return bool(re.search(r'\b(?:'+signals[category]+r')\b',text))

def quotes(source,description):
    terms=set(normalized(description).split())
    rows=[]
    for i,line in enumerate(re.split(r'\n|(?<=[.!?])\s+(?=[A-Z])',source['excerpt'])):
        text=line.strip()[:300]
        if len(text)<12:
            continue
        score=sum(w in text.lower() for w in terms if len(w)>3)
        score+=4*bool(re.search(r'\b(offers?|serves?|sells?|provides?|speciali[sz]es?|espresso|latte|pastries|clothing|apparel|software|haircut|fitness|products?|services?)\b',text,re.I))
        score-=10*bool(re.search(r'free shipping|subscribe|privacy|cookie|sign up',text,re.I))
        rows.append((score,i,dict(id=f'{source["id"]}-q{i}',text=text)))
    return [r[2] for r in sorted(rows,key=lambda r:(-r[0],r[1]))[:12]]

def supports_kind(kind,text):
    if re.search(r'free shipping|shipping over|delivery fee|subscribe|cookie policy|privacy policy|terms of use',text,re.I):
        return False
    if re.fullmatch(r'https?://\S+|[^\s@]+@[^\s@]+\.[^\s@]+|[+\d()\s.-]{7,}',text):
        return False
    if kind=='offering':
        return len(re.findall(r'\b\w+\b',text))>=5 and bool(re.search(r'\b(offers?|serves?|sells?|provides?|speciali[sz]es?|coffee|espresso|latte|pastries|bread|breakfast|clothing|apparel|fashion|garments|footwear|books|software|haircuts?|fitness|groceries|flowers|dental|medical|legal|accounting|repairs?|rooms|workspace|services?|products?)\b',text,re.I))
    if kind=='price':
        return bool(re.search(r'[$£€¥₹]\s*\d|\d[\d,.]*\s*(USD|GBP|EUR|AED|SGD|dollars?|pounds?|euros?)\b',text)) and not re.search(r'\b(reviewers?|paid|per person|approximately|around)\b',text,re.I)
    if kind=='location':
        return bool(re.search(r'\d',text) and re.search(r'\b(street|st|avenue|ave|road|rd|broadway|lane|ln|drive|dr|square|sq|boulevard|blvd|way|suite|floor|unit|postal|postcode)\b',text,re.I))
    return bool(re.search(r'\b(loved?|liked?|delicious|friendly|rude|slow|quick|excellent|amazing|terrible|overpriced|disappointing|recommend|waited|helpful|fresh|stale|quality|service|experience|value|flavou?r)\b',text,re.I)) and len(text.split())>=3

def grounded_extraction(result,evidence,candidates,description,metrics):
    source_map={s['id']:s for s in evidence}
    quote_map={s['id']:{q['id']:q['text'] for q in quotes(s,description)} for s in evidence}
    businesses={c['name']:c for c in candidates}
    rows=[];seen=set()
    for selection in result.findings:
        source=source_map.get(selection.sourceId)
        quote=quote_map.get(selection.sourceId,{}).get(selection.quoteId)
        identity=(selection.sourceId,selection.quoteId)
        candidate=businesses.get(selection.business)
        if not source or not quote or not candidate or identity in seen or not source_allowed(source,selection.business) or not category_allowed(source,candidate['categoryId']) or not supports_kind(selection.kind,quote) or quote not in source['excerpt']:
            metrics.data['rejectedClaims']+=1;continue
        seen.add(identity)
        rows.append(dict(id=f'f{len(rows)+1}',claim=f'Retrieved source states: {quote}',kind=selection.kind,business=selection.business,relation=candidate['relation'],evidence=[dict(sourceId=source['id'],quote=quote)],geographicRelevance=f'Mapped candidate is {round(candidate["distanceMeters"])} m from the selected center; this source does not independently confirm branch identity.',limitations=['Source assertion, not independent verification.','Exact branch identity and current availability remain unverified.']+(['Review sample size, dates and authorship are unknown; this excerpt does not establish representative sentiment.'] if selection.kind=='feedback' else []),reviewSampleSize=None,reviewDates=None))
    return rows

def grounded_synthesis(result,findings,description,metrics):
    found={f['id']:f for f in findings}
    impacts=[];seen=set()
    groups=[{'coffee','espresso','latte','cappuccino','cafe'},{'clothing','clothes','apparel','fashion','garments'},{'software','saas'},{'books','bookshop','bookstore'},{'hair','haircut','barber'},{'gym','fitness'}]
    for impact in result.impacts:
        i=impact.model_dump();support=[found.get(fid) for fid in i['findingIds']]
        left=set(normalized(i['yourOffering']).split());right=set(normalized(i['competitorOffering']).split())
        overlap=(left & right)-{'the','and','for','with','shop','store','business'} or any(left & g and right & g for g in groups)
        valid=all(f and f['business']==i['business'] and f['kind'] in ('offering','price') for f in support)
        valid=valid and i['yourOffering'].lower() in description.lower() and any(i['competitorOffering'] in e['quote'] for f in support if f for e in f['evidence'])
        if not valid or i['business'] in seen or i['effect']=='competition' and not overlap:
            metrics.data['rejectedClaims']+=1;continue
        i['id']=f'impact{len(impacts)+1}'
        seen.add(i['business']);impacts.append(i)
    assessment=result.assessment.model_dump()
    support=' '.join(e['quote'] for f in findings if f['id'] in assessment['findingIds'] for e in f['evidence'])
    unsupported=re.search(r'\b(guaranteed|proven demand|high demand|strong demand|high footfall|high foot traffic|no (other |nearby |local )?(competitors|cafes)|low rent|affordable rent|underserved market|will succeed|will be profitable|will increase sales)\b',assessment['reasoning'],re.I)
    valid=all(fid in found for fid in assessment['findingIds']) and not unsupported and all(n in support for n in re.findall(r'\d+(?:[.,]\d+)?',assessment['reasoning']))
    if assessment['verdict']!='insufficient-evidence':
        valid=valid and any(fid in i['findingIds'] for fid in assessment['findingIds'] for i in impacts)
    if not valid:
        metrics.data['rejectedClaims']+=1;assessment=None
    return impacts,assessment

class Workflow:
    def __init__(self,request,providers,maps,emit):
        self.request=request
        self.p=providers;self.maps=maps;self.emit=emit
        self.states={};self.stage_starts={}
        self.report=dict(request=request.model_dump(exclude_unset=True),status='unavailable',startedAt=stamp(),evidence=[],findings=[],insights=[],impacts=[],assessment=None,stages=[],warnings=[],unknowns=UNKNOWN.copy(),agentRuns=providers.agent_runs,osmContext=None,shortlist=[])
        self.candidates=[]

    def update(self,stage,status,message):
        now=time.monotonic()
        if status=='running':
            self.stage_starts.setdefault(stage,now)
        elif stage in self.stage_starts:
            self.p.metrics.data['stages'].append(dict(stage=stage,status=status,durationMs=round((now-self.stage_starts.pop(stage))*1000)))
        row=dict(stage=stage,status=status,message=message[:2000])
        self.states[stage]=row;self.emit({'type':'stage','stage':row})

    def failed(self,stage,exc):
        message=str(exc) if isinstance(exc,ProviderError) else type(exc).__name__
        self.p.metrics.data['failures'].append(dict(stage=stage,reason=message))
        self.report['warnings'].append(f'{stage}: {message}. Available mapped candidates and sources are retained.')
        self.update(stage,'unavailable',message)

    def query(self,candidate,focus='offerings'):
        city=CITIES[self.request.scope.cityId]['label']
        return f'"{candidate["name"]}" {city} {CATEGORIES[candidate["categoryId"]]["label"]} '+{
            'offerings':'official website products services menu','prices':'official menu prices','branch':'address location branch','feedback':'customer reviews service experience',
        }[focus]

    async def retrieve(self,candidate,focus='offerings'):
        try:
            docs=await self.p.search(self.query(candidate,focus))
            eligible=[s for s in docs if source_allowed(s,candidate['name']) and category_allowed(s,candidate['categoryId'])]
            if len(eligible)<len(docs):
                self.report['warnings'].append(f'{len(docs)-len(eligible)} unrelated or editorial sources excluded for a mapped candidate.')
            return eligible[:2]
        except ProviderError as exc:
            self.failed('web',exc);return []

    def add_sources(self,sources):
        existing={s['id']:s for s in self.report['evidence']}
        for source in sources:
            existing[source['id']]=source
        self.report['evidence']=list(existing.values())[:16]

    async def extract(self):
        documents=[dict(id=s['id'],url=s['url'],title=s['title'],quotes=quotes(s,self.request.description)) for s in self.report['evidence']]
        # Enumerations make the model choose application-owned identities instead
        # of constructing branch labels or accidentally returning quote text as IDs.
        quote_ids=[q['id'] for d in documents for q in d['quotes']]
        if not quote_ids:
            return []
        bounded_selection=create_model('BoundedSelection',__base__=Selection,
            business=(Literal[tuple(c['name'] for c in self.candidates)],...),
            sourceId=(Literal[tuple(d['id'] for d in documents)],...),
            quoteId=(Literal[tuple(quote_ids)],...))
        from pydantic import Field
        bounded_extraction=create_model('BoundedExtraction',__base__=Extraction,findings=(list[bounded_selection],Field(max_length=12)))
        start=time.monotonic()
        try:
            result=await self.p.structured('extractor','Select exact sourceId and quoteId observations for supplied candidate names only. Copy business exactly from its enum, never add a suffix or branch label. Accept dedicated official pages, menus, listings or reviews. Reject roundups, incidental mentions, same-name unrelated industries, navigation, promotions and contact-only text. Prefer concrete offering sentences, not menu section headings. Preserve specialty and branch uncertainty.',dict(description=self.request.description,businesses=[c['name'] for c in self.candidates],documents=documents),bounded_extraction)
        finally:
            self.p.metrics.data['stages'].append(dict(stage='extraction',durationMs=round((time.monotonic()-start)*1000)))
        self.report['unknowns']+=result.unknowns
        return grounded_extraction(result,self.report['evidence'],self.candidates,self.request.description,self.p.metrics)

    async def reason_and_verify(self):
        report=self.report
        self.update('insights','running','Comparing retrieved offerings with your proposal and identifying missing evidence.')
        synthesis=await self.p.structured('analyst','Compare actual quoted offerings to the proposal. yourOffering must be an exact substring of the proposal; competitorOffering must be an exact substring of a cited quote. Cite only business-specific offering/price findings. Mark possible effects, never lost sales or proven crossover. Assess provisionally; disclose missing evidence on branch, specialty, market coverage, demand and profitability.',dict(description=self.request.description,goals=self.request.goals,findings=report['findings']),Synthesis)
        report['impacts'],report['assessment']=grounded_synthesis(synthesis,report['findings'],self.request.description,self.p.metrics)
        self.update('insights','complete','Offering comparisons checked against source text and finding identities.')
        self.update('verification','running','Checking every finding and conclusion against its cited quotes.')
        review=await self.p.structured('verifier','Return exactly one decision per finding and impact ID, copying IDs exactly. Evaluate quoted source assertions as source observations with their stated limitations; independent corroboration is not required for a qualified observation. Supplied mapped candidates establish the computed radius/distance, but not branch identity of a web page. Set supported=true for a quoted brand offering with explicit branch uncertainty if the source identifies that brand. Do not require branch confirmation to retain such a qualified source observation. Do not reject an observation merely because the business lacks the user specialty: different offerings are valid comparison evidence. Specialty overlap must remain unverified unless quoted. Reject branch-specific conclusions that exceed these limits. Check source/business identity, semantic quote support, unsupported specialty or branch claims, offering overlap and every conclusion. Reject unsupported demand, profitability, absence claims and representative sentiment. assessmentSupported must review the entire assessment. If one targeted retrieval could resolve a material gap, choose a supplied candidateId; otherwise null.',dict(description=self.request.description,findings=report['findings'],impacts=report['impacts'],assessment=report['assessment'],candidateIds=[c['id'] for c in self.candidates],mappedCandidates=self.candidates,sourceIdentities=[{k:s[k] for k in ('id','url','title','contentKind')} for s in report['evidence']]),Verification)
        def approved(decisions,identity):
            matches=[d for d in decisions if d.id==identity]
            return len(matches)==1 and matches[0].supported
        before=len(report['findings'])+len(report['impacts'])
        report['findings']=[f for f in report['findings'] if approved(review.findings,f['id'])]
        surviving={f['id'] for f in report['findings']}
        report['impacts']=[i for i in report['impacts'] if approved(review.impacts,i['id']) and set(i['findingIds'])<=surviving]
        a=report['assessment']
        if not review.assessmentSupported or a and (not set(a['findingIds'])<=surviving or a['verdict']!='insufficient-evidence' and not any(fid in i['findingIds'] for fid in a['findingIds'] for i in report['impacts'])):
            report['assessment']=None
        rejected=before-len(report['findings'])-len(report['impacts'])
        for decision in [*review.findings,*review.impacts]:
            if not decision.supported:
                report['warnings'].append(f'Verifier rejected {decision.id}: {decision.reason[:1000]}')
        if rejected:
            report['warnings'].append(f'{rejected} findings or comparisons were removed because verification did not approve them.')
        self.p.metrics.data['rejectedClaims']+=rejected
        report['unknowns']+=review.missingEvidence
        self.update('verification','partial' if rejected or not report['findings'] or report['assessment'] is None else 'complete',f'Exact quotes checked in code; model review removed {rejected} unsupported observations/conclusions.')
        return review

    async def execute(self):
        report=self.report
        self.update('planning','running','Loading verified mapped candidates inside the selected radius.')
        if not self.request.osmRequest:
            self.update('planning','unavailable','Confirm a mapped category before local research; no city-wide substitutes used.')
            return
        try:
            mapped=await self.maps.analyze(self.request.osmRequest.model_dump(),self.p.metrics,self.p)
            report['shortlist']=shortlist(mapped,self.request.description)
            report['osmContext']=dict(request=mapped['request'],fetchedAt=mapped['provenance']['fetchedAt'],status=mapped['status'],directMappedCount=mapped['directMappedCount'],adjacentMappedCount=mapped['adjacentMappedCount'],coverage='unknown')
            report['warnings']+=mapped['warnings']
            seen=set()
            for candidate in report['shortlist']:
                name=normalized(candidate['name'])
                if name not in seen:
                    seen.add(name);self.candidates.append(candidate)
                if len(self.candidates)==3:
                    break
            self.update('planning','complete',f'{len(report["shortlist"])} named mapped candidates; researching {len(self.candidates)} distinct names.')
        except ProviderError as exc:
            self.failed('planning',exc);return
        if not self.candidates:
            return
        self.update('web','running','Searching independent mapped candidates concurrently with bounded provider concurrency.')
        # gather waits for all children; cancellation propagates to every provider call.
        results=await asyncio.gather(*(self.retrieve(c) for c in self.candidates))
        # Round-robin prevents a single candidate from using every evidence slot.
        for index in range(2):
            self.add_sources([docs[index] for docs in results if len(docs)>index])
        if not report['evidence']:
            self.update('web','partial','No usable business-specific sources. This does not establish competitor absence.')
            return
        # One bounded model decision. The application builds all queries and resolves IDs.
        if self.p.remaining()>5:
            try:
                choice=await self.p.structured('researcher','Choose search/refine for a supplied candidate, inspect a discovered source, or stop when evidence is sufficient. Prefer stop if pages already supply concrete offerings. Use only supplied IDs, null unused IDs. No URLs, free-form queries or code are accepted.',dict(description=self.request.description,candidates=[dict(id=c['id'],name=c['name']) for c in self.candidates],sources=[dict(id=s['id'],title=s['title'],contentKind=s['contentKind'],quotes=quotes(s,self.request.description)[:4]) for s in report['evidence']]),Choice)
                candidate=next((c for c in self.candidates if c['id']==choice.candidateId),None)
                source=next((s for s in report['evidence'] if s['id']==choice.sourceId),None)
                if choice.action in ('search','refine') and candidate:
                    self.add_sources(await self.retrieve(candidate,choice.focus))
                elif choice.action=='inspect' and source:
                    self.add_sources([await self.p.inspect(source)])
                elif choice.action!='stop':
                    report['warnings'].append('Researcher requested an invalid tool target; action rejected.')
            except ProviderError as exc:
                report['warnings'].append(f'Research choice unavailable: {exc}. Continuing with discovered sources.')
        self.update('web','complete','Business-specific sources retrieved; only compact numbered quotes go to reasoning models.')
        try:
            report['findings']=await self.extract()
            if not report['findings']:
                report['warnings'].append('Initial extraction produced no usable observations; attempting one targeted offering retrieval within the remaining budget.')
                if self.p.remaining()<4 or self.p.deadline-time.monotonic()<15:
                    return
                self.add_sources(await self.retrieve(self.candidates[0],'prices'))
                report['findings']=await self.extract()
                if not report['findings']:
                    return
            review=await self.reason_and_verify()
            # At most one correction cycle, with reserved calls for a fresh review.
            candidate=next((c for c in self.candidates if c['id']==review.retrieveCandidateId),None)
            if candidate and self.p.remaining()>=4 and self.p.deadline-time.monotonic()>15:
                self.update('web','running','Verifier requested one targeted branch/offerings retrieval.')
                self.add_sources(await self.retrieve(candidate,'branch'))
                self.update('web','complete','Targeted retrieval finished within the remaining budget.')
                reviewed=(report['findings'],report['impacts'],report['assessment'])
                try:
                    report['findings']=await self.extract()
                    await self.reason_and_verify()
                except ProviderError:
                    report['findings'],report['impacts'],report['assessment']=reviewed
                    raise
        except ProviderError as exc:
            self.failed('verification',exc)
            # Only previously reviewed claims may survive an interrupted correction.
            if 'reviewed' not in locals():
                report['findings']=[];report['impacts']=[];report['assessment']=None

    def finish(self):
        for stage in STAGES[:-1]:
            if stage not in self.states or self.states[stage]['status']=='running':
                self.update(stage,'skipped' if stage not in self.states else 'partial','No further evidence available within this bounded run.')
        self.update('reporting','complete','Validated evidence and available partial results are ready.')
        report=self.report
        report['stages']=[self.states[s] for s in STAGES]
        report['unknowns']=list(dict.fromkeys(str(s)[:2000] for s in report['unknowns'] if str(s).strip()))[:20]
        report['warnings']=list(dict.fromkeys(report['warnings']))[:50]
        report['status']='complete' if report['findings'] and all(s['status'] in ('complete','skipped') for s in report['stages']) else 'partial' if report['evidence'] or report['shortlist'] else 'unavailable'
        return report

    async def run(self):
        try:
            async with asyncio.timeout(max(.01,self.p.deadline-time.monotonic())):
                await self.execute()
        except TimeoutError:
            self.failed('verification',ProviderError('overall deadline exceeded'))
            # Findings awaiting verification cannot be published.
            if self.states.get('verification',{}).get('status')!='complete':
                self.report['findings']=[];self.report['impacts']=[];self.report['assessment']=None
        return self.finish()

"""Deterministic upstream fixtures; no live provider calls or paid model calls."""
import asyncio
import copy
import json
import sys
import time
import unittest
from pathlib import Path
from unittest.mock import patch
import httpx

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from atlas_api.schemas import AnalysisRequest,ResearchRequest,Extraction,Synthesis,Verification,Choice,Suggestion,AdviceDecision
from atlas_api.runtime import Metrics,Cache,stamp
from atlas_api.maps import Maps,MAP_CACHE,normalize,query_for,digest,matching,validate_cached
from atlas_api.providers import Providers,ProviderError,SEARCH_CACHE,PAGE_CACHE,public_url
from atlas_api.research import Workflow
from atlas_api.advice import measure

REQUEST=dict(schemaVersion='1',registryVersion='2',scope=dict(cityId='nyc',center=dict(lat=40.7308,lon=-73.9973),radiusMeters=1000),categoryId='cafe',adjacentCategoryIds=[])

def element(identity=1,**tags):
    return dict(type='node',id=identity,lat=40.7308,lon=-73.9973,tags={'amenity':'cafe','name':'Fixture Coffee',**tags})

def mapped(elements=None,request=None):
    request=request or REQUEST
    return normalize(request,dict(elements=[element()] if elements is None else elements,fetchedAt=stamp(),osmBaseTimestamp=None,queryHash=digest(query_for(request))),'https://overpass.private.coffee/api/interpreter')

def source():
    return dict(id='web-fixture',url='https://fixture-business.example/menu',title='Fixture Coffee menu',excerpt='Fixture Coffee serves espresso coffee and fresh pastries every morning.',provider='tavily',retrievedAt=stamp(),contentKind='page',placeId=None,coordinates=None)

class FakeMaps:
    def __init__(self,value):
        self.value=value
    async def analyze(self,*args):
        return self.value

class FakeProviders(Providers):
    def __init__(self,case='normal',**kwargs):
        super().__init__(None,Metrics('evaluation'),budget=12,**kwargs)
        self.case=case;self.searches=0;self.reviews=0
    async def search(self,query,limit=3):
        self.searches+=1;self.count+=1
        await asyncio.sleep(.005)
        if self.case=='provider-failure':
            raise ProviderError('tavily: HTTP 503')
        return [source()]
    async def structured(self,role,prompt,payload,output):
        self.count+=1
        if output is Suggestion:
            return Suggestion(categoryId='cafe',explanation='Synthetic mapped category.')
        if output is AdviceDecision:
            return AdviceDecision(recommendedId=None,priorities=['competition','transit'],checks=['rent','footfall','customers'])
        if self.case=='deadline':
            await asyncio.sleep(1)
        if self.case=='verifier-failure' and role=='verifier':
            raise ProviderError('nvidia: HTTP 503')
        if output is Choice:
            return Choice(action='stop',candidateId=None,sourceId=None,focus='offerings')
        if issubclass(output,Extraction):
            quote=payload['documents'][0]['quotes'][0]['id']
            return Extraction(findings=[dict(sourceId='web-fixture',quoteId='invented' if self.case=='unsupported-quote' else quote,business='Fixture Coffee',kind='offering')],unknowns=['Specialty overlap remains unverified.'])
        if output is Synthesis:
            f=payload['findings'][0]
            return Synthesis(impacts=[dict(id='draft',business=f['business'],effect='competition',yourOffering='coffee',competitorOffering='espresso coffee',findingIds=[f['id']])],assessment=dict(verdict='recommended',reasoning='Proven demand guarantees success.' if self.case=='unsupported-conclusion' else 'Quoted coffee offerings indicate potential competition; validate this branch and customer demand.',findingIds=[f['id']],risks=['Branch identity unverified.','Demand and profitability unknown.']))
        if output is Verification:
            self.reviews+=1
            reject=self.case=='unsupported-claim' or self.case=='correction' and self.reviews==1
            return Verification(findings=[dict(id=f['id'],supported=not reject,reason='Quote review.') for f in payload['findings']],impacts=[dict(id=i['id'],supported=not reject,reason='Offering review.') for i in payload['impacts']],assessmentSupported=not reject,missingEvidence=['Exact branch identity remains unverified.'],retrieveCandidateId='node/1' if self.case=='correction' and self.reviews==1 else None)
        raise AssertionError(output)

async def evaluate(case):
    request=copy.deepcopy(REQUEST)
    if case=='specialty':
        description='Specialty gluten free coffee shop'
    else:
        description='coffee with fast morning pickup'
    req=ResearchRequest(description=description,scope=request['scope'],osmRequest=request,localOnly=True)
    value=mapped([] if case=='empty' else [element(1),{**element(2),'lat':40.731}] if case=='ambiguous-branch' else None)
    events=[];p=FakeProviders(case)
    if case=='deadline':
        p.deadline=time.monotonic()+.02
    workflow=Workflow(req,p,FakeMaps(value),events.append)
    report=await workflow.run()
    metrics=p.metrics.finish(report)
    return dict(case=case,report=report,metrics=metrics,events=events,searches=p.searches,reviews=p.reviews,providerCalls=p.count)

class WorkflowTests(unittest.IsolatedAsyncioTestCase):
    async def test_evaluation_cases(self):
        for case in ('normal','specialty','empty','provider-failure','unsupported-quote','unsupported-claim','unsupported-conclusion','verifier-failure','deadline','correction','ambiguous-branch'):
            with self.subTest(case=case):
                row=await evaluate(case);r=row['report']
                self.assertEqual([s['stage'] for s in r['stages']],['planning','web','insights','verification','reporting'])
                if case in ('normal','specialty','ambiguous-branch','correction'):
                    self.assertEqual(len(r['findings']),1)
                    self.assertEqual(len(r['impacts']),1)
                    self.assertIn('branch',r['findings'][0]['limitations'][1])
                elif case=='unsupported-conclusion':
                    self.assertIsNone(r['assessment'])
                else:
                    self.assertEqual(r['findings'],[])
                    self.assertEqual(r['impacts'],[])
                if case=='correction':
                    self.assertEqual(row['reviews'],2)
                    self.assertEqual(row['searches'],2)
                if case=='ambiguous-branch':
                    self.assertEqual(len(r['shortlist']),2)
                    self.assertEqual(row['searches'],1)
                    self.assertIn('unverified',r['findings'][0]['limitations'][1])
                self.assertLessEqual(row['providerCalls'],12)

    async def test_provider_budget_and_cache_timestamps(self):
        SEARCH_CACHE.entries.clear()
        async def transport(request):
            return httpx.Response(200,json={'results':[{'url':'https://fixture-business.example/menu','title':'Fixture Coffee','content':source()['excerpt']}]})
        async with httpx.AsyncClient(transport=httpx.MockTransport(transport)) as client:
            p=Providers(client,Metrics('test'),budget=1)
            with patch.dict('os.environ',{'TAVILY_API_KEY':'synthetic'}):
                first=await p.search('fixture unique')
                second=await p.search('fixture unique')
                self.assertEqual(first,second)
                self.assertEqual(p.count,1)
                self.assertEqual(p.metrics.data['cacheHits'],1)
                with self.assertRaises(ProviderError):
                    await p.search('different query')

    async def test_shared_provider_concurrency(self):
        SEARCH_CACHE.entries.clear();active=peak=0
        async def handler(request):
            nonlocal active,peak
            active+=1;peak=max(peak,active)
            await asyncio.sleep(.015)
            active-=1
            return httpx.Response(200,json={'results':[]})
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            sem=asyncio.Semaphore(2)
            p=Providers(client,Metrics('test'),sem)
            with patch.dict('os.environ',{'TAVILY_API_KEY':'synthetic'}):
                await asyncio.gather(*(p.search(str(i)) for i in range(5)))
            self.assertEqual(peak,2)

    async def test_malformed_provider_envelopes_fail_closed(self):
        SEARCH_CACHE.entries.clear()
        for payload in ([],{'results':'wrong type'},{'results':[{'url':7,'content':False}]}):
            async with httpx.AsyncClient(transport=httpx.MockTransport(lambda request:httpx.Response(200,json=payload))) as client:
                p=Providers(client,Metrics('test'))
                with patch.dict('os.environ',{'TAVILY_API_KEY':'synthetic'}):
                    try:
                        result=await p.search('malformed '+str(payload))
                        self.assertEqual(result,[])
                    except ProviderError:
                        pass

    async def test_cancellation_reaches_provider(self):
        cancelled=asyncio.Event()
        async def handler(request):
            try:
                await asyncio.sleep(10)
            except asyncio.CancelledError:
                cancelled.set();raise
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            p=Providers(client,Metrics('test'))
            with patch.dict('os.environ',{'TAVILY_API_KEY':'synthetic'}):
                task=asyncio.create_task(p.search('cancel test'))
                await asyncio.sleep(.01);task.cancel()
                with self.assertRaises(asyncio.CancelledError):
                    await task
            self.assertTrue(cancelled.is_set())

class MapTests(unittest.TestCase):
    def test_radius_dedup_invalid_and_inactive(self):
        outside={**element(2),'lat':40.9}
        result=mapped([element(),element(),outside,element(3,opening_hours='closed'),{'bad':'record'}])
        self.assertEqual(len(result['competitors']),1)
        self.assertEqual(result['status'],'partial')
        self.assertIsNone(result['directMappedCount'])

    def test_registry_rules(self):
        self.assertIsNone(matching('cafe',{'amenity':'cafe','cuisine':'coffee; bubble_tea'}))
        self.assertIsNotNone(matching('bubble-tea',{'amenity':'cafe','cuisine':'coffee; bubble_tea'}))
        self.assertIsNone(matching('pharmacy',{'shop':'chemist'}))
        self.assertIsNotNone(matching('pharmacy',{'healthcare':'pharmacy'}))

    def test_guardrails(self):
        for changes in ({'registryVersion':'1'},{'categoryId':'invented'},{'adjacentCategoryIds':['hotel']},{'scope':{**REQUEST['scope'],'center':{'lat':0,'lon':0}}}):
            with self.assertRaises(ValueError):
                AnalysisRequest.model_validate({**REQUEST,**changes})

    def test_cache_integrity_and_scope(self):
        result=mapped()
        self.assertEqual(validate_cached(result,REQUEST),result)
        result['competitors'][0]['distanceMeters']=2000
        with self.assertRaises(ValueError):
            validate_cached(result,REQUEST)

    def test_partial_advice_counts(self):
        area,complete=measure(REQUEST,[element(),{'bad':True}])
        self.assertFalse(complete)
        self.assertIsNone(area['competition']);self.assertIsNone(area['transit'])

    def test_retrieval_url_permissions(self):
        for url in ['http://example.com','https://127.0.0.1/x','https://localhost/x','https://foo.internal/x','https://user:secret@example.com','https://example.com:8000','file:///etc/passwd']:
            self.assertFalse(public_url(url),url)
        self.assertTrue(public_url('https://business.example/menu'))

    def test_bounded_cache(self):
        cache=Cache(2);cache.put('a',1);cache.put('b',2);cache.put('c',3)
        self.assertIsNone(cache.get('a'));self.assertEqual(len(cache.entries),2)

if __name__=='__main__':
    unittest.main()

import asyncio
import json
import unittest
from unittest.mock import patch
import httpx
from test_workflow import REQUEST,FakeProviders,element
from atlas_api.main import app,lifespan
from atlas_api.maps import MAP_CACHE

class ApiTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.lifespan=lifespan(app)
        await self.lifespan.__aenter__()
        await app.state.http.aclose()
        async def provider(request):
            if 'photon' in request.url.host:
                return httpx.Response(200,json={'features':[{'geometry':{'coordinates':[-73.9973,40.7308]},'properties':{'name':'Fixture Park','osm_type':'node','osm_id':8}}]})
            return httpx.Response(200,json={'elements':[element(1),element(2),element(3)]})
        app.state.http=httpx.AsyncClient(transport=httpx.MockTransport(provider))
        self.client=httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='http://test')
        MAP_CACHE.entries.clear()
        self.factory=patch('atlas_api.main.Providers',side_effect=lambda *args,**kwargs:FakeProviders())
        self.factory.start()

    async def asyncTearDown(self):
        self.factory.stop()
        await self.client.aclose()
        await self.lifespan.__aexit__(None,None,None)

    async def test_all_five_frontend_routes(self):
        analysis=await self.client.post('/api/analyze',json=REQUEST)
        self.assertEqual(analysis.status_code,200)
        self.assertEqual(analysis.headers['x-atlas-backend'],'python')
        self.assertEqual(analysis.json()['directMappedCount'],3)
        suggestion=await self.client.post('/api/suggest',json={'description':'coffee'})
        self.assertEqual(suggestion.json()['categoryId'],'cafe')
        location=await self.client.get('/api/locations?q=Fixture&city=nyc')
        self.assertEqual(location.json()['results'][0]['label'],'Fixture Park')
        research=await self.client.post('/api/research',json=dict(description='coffee',scope=REQUEST['scope'],osmRequest=REQUEST,localOnly=True))
        events=[json.loads(line) for line in research.text.splitlines()]
        self.assertEqual(events[-1]['type'],'report')
        self.assertEqual(len(events[-1]['report']['findings']),1)
        self.assertEqual(app.state.research_active,0)
        advice=await self.client.post('/api/location-advice',json={'analysis':REQUEST,'description':'coffee'})
        self.assertEqual(advice.status_code,200)
        self.assertEqual(advice.json()['status'],'provisional')
        self.assertIsNone(advice.json()['candidates'][0]['score'])

    async def test_invalid_requests_and_body_limit(self):
        self.assertEqual((await self.client.post('/api/analyze',content='{')).status_code,400)
        self.assertEqual((await self.client.post('/api/analyze',json={**REQUEST,'categoryId':'invented'})).status_code,422)
        self.assertEqual((await self.client.post('/api/research',json=dict(description='coffee',scope=REQUEST['scope'],localOnly=True))).status_code,400)
        self.assertEqual((await self.client.post('/api/suggest',content='x'*9000)).status_code,413)

    async def test_photon_failure_uses_bounded_mapped_landmarks(self):
        async def fallback(request):
            if 'photon' in request.url.host:
                return httpx.Response(403)
            self.assertIn('name',request.content.decode())
            return httpx.Response(200,json={'elements':[element(8,name='Fixture Park')]})
        await app.state.http.aclose()
        app.state.http=httpx.AsyncClient(transport=httpx.MockTransport(fallback))
        response=await self.client.get('/api/locations?q=Fixture&city=nyc')
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json()['results'][0]['label'],'Fixture Park')

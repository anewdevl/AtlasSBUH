import asyncio
import contextlib
import json
import os
import re
import time
from contextlib import asynccontextmanager
from urllib.parse import urlsplit
import httpx
from dotenv import load_dotenv
from fastapi import FastAPI,Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse,StreamingResponse
from .runtime import ROOT,Cache,Metrics
from .schemas import AnalysisRequest,ResearchRequest,Description,AdviceRequest,Suggestion,CITIES,Position
from .providers import Providers,ProviderError
from .maps import Maps,element
from .research import Workflow
from .advice import advise

load_dotenv(ROOT/'.env')
LOCATION_CACHE=Cache(500,86400)

@asynccontextmanager
async def lifespan(app):
    app.state.http=httpx.AsyncClient(timeout=httpx.Timeout(30,connect=5),follow_redirects=False,limits=httpx.Limits(max_connections=12,max_keepalive_connections=8))
    app.state.providers=asyncio.Semaphore(min(2,max(1,int(os.getenv('ATLAS_RESEARCH_CONCURRENCY','2')))))
    app.state.research_active=0
    app.state.next_geocoder=0
    app.state.buckets=Cache(10000,60)
    yield
    await app.state.http.aclose()

app=FastAPI(title='ATLAS Python API',version='1.0.0',lifespan=lifespan)

@app.exception_handler(RequestValidationError)
async def validation_error(request,exc):
    analysis=request.url.path=='/api/analyze'
    malformed=any(e['type'] in ('json_invalid','missing','extra_forbidden','float_type','string_type','dict_type','list_type','greater_than_equal','less_than_equal') for e in exc.errors()) or 'application/json' not in request.headers.get('content-type','')
    return JSONResponse({'code':'INVALID_REQUEST' if malformed else 'UNSUPPORTED_REQUEST','message':'Malformed analysis request.' if malformed else 'Unsupported category, version, radius, adjacent setting, or city scope.'} if analysis else {'error':'Enter valid business and geographic settings.'},status_code=400 if not analysis or malformed else 422)

@app.middleware('http')
async def limits(request,call_next):
    # Check bytes while reading: Content-Length is untrusted and can be omitted.
    if request.method=='POST':
        body=bytearray()
        async for chunk in request.stream():
            body.extend(chunk)
            if len(body)>8192:
                return JSONResponse({'error':'Request too large.','code':'INVALID_REQUEST','message':'Request too large.'},status_code=413)
        request._body=bytes(body)
    if request.url.path.startswith('/api/'):
        ip=request.client.host if request.client else 'local'
        saved=app.state.buckets.get(ip) or {'count':0}
        saved['count']+=1
        # Fixed windows: do not extend the expiry with each request.
        if saved['count']==1:
            app.state.buckets.put(ip,saved)
        else:
            created,_=app.state.buckets.entries[ip]
            app.state.buckets.entries[ip]=(created,saved)
        if saved['count']>60:
            return JSONResponse({'error':'Request capacity reached.','code':'RATE_LIMIT','message':'Please wait before retrying.','retryAfterSeconds':60},status_code=429,headers={'Retry-After':'60'})
    response=await call_next(request)
    response.headers['Cache-Control']='no-store'
    response.headers['X-ATLAS-Backend']='python'
    return response

@app.get('/health')
async def health():
    return {'status':'ok','backend':'python'}

async def disconnected(request,stop):
    while not stop.is_set():
        if await request.is_disconnected():
            return True
        await asyncio.sleep(.15)
    return False

async def cancellable(request,coroutine):
    task=asyncio.create_task(coroutine)
    stop=asyncio.Event()
    watcher=asyncio.create_task(disconnected(request,stop))
    try:
        done,_=await asyncio.wait([task,watcher],return_when=asyncio.FIRST_COMPLETED)
        if watcher in done:
            task.cancel()
            raise asyncio.CancelledError
        return await task
    finally:
        stop.set()
        for child in (task,watcher):
            if not child.done():
                child.cancel()
        await asyncio.gather(task,watcher,return_exceptions=True)

async def within_deadline(coroutine,deadline):
    try:
        async with asyncio.timeout(max(.001,deadline-time.monotonic())):
            return await coroutine
    except TimeoutError:
        raise ProviderError('overall deadline exceeded') from None

@app.post('/api/analyze')
async def analyze(body: AnalysisRequest,request: Request):
    metrics=Metrics('analysis');result=None
    try:
        result=await cancellable(request,Maps(app.state.http).analyze(body.model_dump(),metrics))
        return result
    except ProviderError as exc:
        metrics.data['failures'].append(dict(stage='mapping',reason=str(exc)))
        return JSONResponse({'code':'UNAVAILABLE','message':'Map provider unavailable; no exact compatible saved area exists. No zero counts or substitute area produced.','retryAfterSeconds':10},status_code=503)
    finally:
        metrics.finish(result)

@app.post('/api/suggest')
async def suggest(body: Description,request: Request):
    metrics=Metrics('suggestion');p=Providers(app.state.http,metrics,app.state.providers,budget=1)
    p.deadline=time.monotonic()+18
    try:
        from .schemas import CATEGORIES
        result=await cancellable(request,within_deadline(p.structured('researcher','Match the primary activity to exactly one supplied mapped category or null if ambiguous. Preserve specialty limitations. Do not infer demand or market fit.',dict(description=body.description,catalog=CATEGORIES),Suggestion),p.deadline))
        return result.model_dump()
    except ProviderError as exc:
        metrics.data['failures'].append(dict(stage='suggestion',reason=str(exc)))
        return JSONResponse({'error':'AI suggestion unavailable. Choose a mapped category or refine the description.'},status_code=502)
    finally:
        metrics.finish()

@app.get('/api/locations')
async def locations(request: Request,q: str='',city: str=''):
    q=q.strip()
    if city not in CITIES or not 3<=len(q)<=180:
        return JSONResponse({'error':'Enter at least three characters and select a supported city.'},status_code=400)
    saved=LOCATION_CACHE.get(city+':'+q.lower())
    metrics=Metrics('location-search')
    if saved is not None:
        metrics.data['cacheHits']+=1
        metrics.finish()
        return {'results':saved}
    if time.monotonic()<app.state.next_geocoder:
        return JSONResponse({'error':'Please wait a second before searching again.'},status_code=429,headers={'Retry-After':'1'})
    app.state.next_geocoder=time.monotonic()+1.1
    async def search():
        endpoint=os.getenv('ATLAS_GEOCODER_ENDPOINT','https://photon.komoot.io/api/')
        if urlsplit(endpoint).scheme!='https':
            raise ProviderError('Invalid geocoder')
        s,w,n,e=CITIES[city]['envelope']
        photon=dict(provider='photon',stage='geocoding',status='unavailable')
        metrics.data['calls'].append(photon)
        photon_start=time.monotonic()
        try:
            response=await app.state.http.get(endpoint,params=dict(q=q,limit=8,lang='en',bbox=f'{w},{s},{e},{n}'),timeout=3,headers={'User-Agent':'ATLAS-SBUH/1.0 (https://github.com/anewdevl/AtlasSBUH)'})
            photon['httpStatus']=response.status_code
            response.raise_for_status()
            if len(response.content)>100000:
                raise ProviderError('Geocoder payload limit')
            features=response.json()['features'][:50]
            photon['status']='complete'
        except (httpx.HTTPError,ValueError,KeyError,ProviderError) as exc:
            photon['failure']=type(exc).__name__
            metrics.data['failures'].append(dict(stage='photon',reason=type(exc).__name__))
            # Named mapped landmarks remain searchable if Photon is unavailable.
            # Escape both regex syntax and the Overpass string literal.
            pattern=json.dumps(re.escape(q),ensure_ascii=False)
            query=f'[out:json][timeout:5][maxsize:1048576];nwr["name"~{pattern},i]({s},{w},{n},{e});out center 8;'
            async with asyncio.timeout(5):
                data=await Maps(app.state.http).fetch(query,metrics)
            features=[]
            for raw in data['elements']:
                try:
                    tags,pos=element(raw)
                    features.append(dict(geometry=dict(coordinates=[pos['lon'],pos['lat']]),properties=dict(name=tags.get('name',''),osm_type=raw['type'],osm_id=raw['id'])))
                except (ValueError,TypeError):
                    continue
        finally:
            photon['durationMs']=round((time.monotonic()-photon_start)*1000)
        results=[]
        for index,f in enumerate(features):
            lon,lat=f['geometry']['coordinates'];pos=Position(lat=round(lat,4),lon=round(lon,4)).model_dump()
            if not s<=pos['lat']<=n or not w<=pos['lon']<=e:
                continue
            props=f['properties'];street=' '.join(str(props[k]) for k in ('housenumber','street') if props.get(k))
            label=', '.join(dict.fromkeys(v for v in [props.get('name'),street,props.get('district'),props.get('city'),props.get('state')] if isinstance(v,str) and v))[:1000]
            if label:
                results.append(dict(id=f'{props.get("osm_type","place")}-{props.get("osm_id",index)}',label=label,coordinates=pos))
        LOCATION_CACHE.put(city+':'+q.lower(),results[:8])
        return {'results':results[:8]}
    try:
        return await cancellable(request,search())
    except (ProviderError,httpx.HTTPError,ValueError,KeyError,TypeError,TimeoutError):
        return JSONResponse({'error':'Location search unavailable. Click the map to choose a center.'},status_code=503)
    finally:
        metrics.finish()

@app.post('/api/location-advice')
async def location_advice(body: AdviceRequest,request: Request):
    metrics=Metrics('location-advice');p=Providers(app.state.http,metrics,app.state.providers,budget=2)
    p.deadline=time.monotonic()+60
    result=None
    try:
        result=await cancellable(request,within_deadline(advise(body,Maps(app.state.http),p),p.deadline))
        return result
    except ProviderError as exc:
        metrics.data['failures'].append(dict(stage='advice',reason=str(exc)))
        return JSONResponse({'error':'Location assessment could not retrieve usable map data. No substitute area or zero counts produced.'},status_code=503)
    finally:
        metrics.finish(result)

@app.post('/api/research')
async def research(body: ResearchRequest):
    if app.state.research_active>=2:
        return JSONResponse({'error':'Research capacity reached. Try again shortly.'},status_code=429,headers={'Retry-After':'5'})
    app.state.research_active+=1
    async def events():
        metrics=Metrics('research');p=Providers(app.state.http,metrics,app.state.providers)
        queue=asyncio.Queue()
        workflow=Workflow(body,p,Maps(app.state.http),queue.put_nowait)
        task=asyncio.create_task(workflow.run())
        report=None;cancelled=False;heartbeat=time.monotonic()
        try:
            while not task.done() or not queue.empty():
                try:
                    event=await asyncio.wait_for(queue.get(),.1)
                    yield json.dumps(event)+'\n'
                except TimeoutError:
                    if time.monotonic()-heartbeat>=10:
                        heartbeat=time.monotonic()
                        yield json.dumps({'type':'heartbeat'})+'\n'
                    continue
            report=await task
            serialized=json.dumps({'type':'report','report':report})
            for name in ('NVIDIA_API_KEY','TAVILY_API_KEY','ATLAS_OVERPASS_API_KEY'):
                secret=os.getenv(name)
                if secret:
                    serialized=serialized.replace(secret,'[redacted]')
            yield serialized+'\n'
        except asyncio.CancelledError:
            cancelled=True;raise
        except Exception as exc:
            metrics.data['failures'].append(dict(stage='coordinator',reason=type(exc).__name__))
            yield json.dumps({'type':'error','error':'Research could not finish; try a smaller task.'})+'\n'
        finally:
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError,Exception):
                await task
            app.state.research_active-=1
            metrics.finish(report,cancelled)
    return StreamingResponse(events(),media_type='application/x-ndjson',headers={'X-Content-Type-Options':'nosniff'})

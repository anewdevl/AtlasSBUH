"""OSM taxonomy, exact-radius normalization and dated exact-scope fallbacks."""
import asyncio
import copy
import hashlib
import json
import math
import os
import re
import time
from datetime import datetime
from urllib.parse import urlsplit
import httpx
from .runtime import Cache,ROOT,age,stamp
from .schemas import AnalysisRequest,Position,CATEGORIES,REGISTRY,distance
from .providers import ProviderError

MAP_CACHE=Cache(100)
OSM_SEMAPHORE=asyncio.Semaphore(2)
MAX_RECORDS=5000
FRESH=86400
STALE=30*FRESH

def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()

def key(request):
    return json.dumps(request,sort_keys=True,separators=(',',':'))

def inactive(tags):
    return any(re.match(r'^(disused|abandoned|demolished|removed|razed|construction|proposed|was)(:|$)',k) and v.lower() not in ('no','false','0','') for k,v in tags.items()) or tags.get('lifecycle') in ('closed','disused','abandoned','demolished') or tags.get('operational_status')=='closed' or tags.get('amenity') in ('closed','disused','abandoned') or tags.get('opening_hours')=='closed'

def matching(category,tags):
    if inactive(tags):
        return None
    bubble='bubble_tea' in [t.strip().lower() for t in tags.get('cuisine','').split(';')]
    if category=='cafe':
        return {'amenity':'cafe',**({'cuisine':tags['cuisine']} if tags.get('cuisine') else {})} if tags.get('amenity')=='cafe' and not bubble else None
    if category=='bubble-tea':
        return {'amenity':tags['amenity'],'cuisine':tags['cuisine']} if bubble and tags.get('amenity') in ('cafe','fast_food','restaurant') else None
    if category=='pharmacy':
        result={k:tags[k] for k in ('amenity','healthcare') if tags.get(k)=='pharmacy'}
        return result or None
    for predicate in CATEGORIES[category]['predicates']:
        match=re.fullmatch(r'\["([^"]+)"="([^"]+)"\]',predicate)
        if match and tags.get(match[1])==match[2]:
            return {match[1]:match[2]}
    return None

def query_for(request,selectors=None):
    r=AnalysisRequest.model_validate(request).canonical()
    p=r['scope']['center']
    selectors=selectors or [p for c in [r['categoryId'],*r['adjacentCategoryIds']] for p in CATEGORIES[c]['predicates']]
    # JavaScript Number stringification has no trailing .0.
    number=lambda v:format(v,'.15g')
    return '[out:json][timeout:20][maxsize:16777216];('+''.join(f'nwr{s}(around:{r["scope"]["radiusMeters"]},{number(p["lat"])},{number(p["lon"])});' for s in selectors)+f');out center {MAX_RECORDS+1};'

def details(tags):
    clean=lambda v:re.sub(r'\s+',' ',v).strip() if isinstance(v,str) else ''
    street=' '.join(filter(None,[clean(tags.get('addr:housenumber')),clean(tags.get('addr:street'))]))
    website=clean(tags.get('website',tags.get('contact:website')))
    if website and not re.match(r'^https?://',website) and re.fullmatch(r'[\w-]+(\.[\w-]+)+(/\S*)?',website):
        website='https://'+website
    values=dict(address=', '.join(filter(None,[street,clean(tags.get('addr:city',tags.get('addr:suburb')))])),phone=clean(tags.get('phone',tags.get('contact:phone'))),website=website,openingHours=clean(tags.get('opening_hours')),brand=clean(tags.get('brand')),cuisine=clean(tags.get('cuisine')).replace(';',', ').replace('_',' '),takeaway=clean(tags.get('takeaway')),wheelchair=clean(tags.get('wheelchair')),outdoorSeating=clean(tags.get('outdoor_seating')))
    limits=dict(address=200,phone=60,website=300,openingHours=300,brand=120,cuisine=120)
    result={k:v for k,v in values.items() if v and k in limits and len(v)<=limits[k]}
    if 'website' in result and (urlsplit(website).scheme not in ('http','https') or not urlsplit(website).netloc):
        del result['website']
    for k,accepted in dict(takeaway=['yes','no','only'],wheelchair=['yes','no','limited'],outdoorSeating=['yes','no']).items():
        if values[k] in accepted:
            result[k]=values[k]
    return result

def element(raw,with_position=True):
    if not isinstance(raw,dict) or raw.get('type') not in ('node','way','relation') or type(raw.get('id')) is not int or not 0<raw['id']<=9007199254740991:
        raise ValueError('Invalid source')
    tags=raw.get('tags',{})
    if not isinstance(tags,dict) or not all(isinstance(k,str) and isinstance(v,str) for k,v in tags.items()):
        raise ValueError('Invalid tags')
    for k in ('lat','lon'):
        if k in raw and (type(raw[k]) not in (float,int) or not math.isfinite(raw[k])):
            raise ValueError('Invalid coordinate')
    if 'center' in raw:
        Position.model_validate(raw['center'])
    pos={k:raw.get(k) for k in ('lat','lon')} if raw['type']=='node' else raw.get('center')
    return tags,Position.model_validate(pos).model_dump() if with_position else pos

def validate_dates(fetched,base):
    fetched_time=datetime.fromisoformat(fetched.replace('Z','+00:00'))
    if fetched_time.tzinfo is None or fetched_time.timestamp()>time.time()+300:
        raise ValueError('Invalid retrieval timestamp')
    if base:
        base_time=datetime.fromisoformat(base.replace('Z','+00:00'))
        if base_time.tzinfo is None or base_time.timestamp()>fetched_time.timestamp()+300:
            raise ValueError('Invalid OSM timestamp')

def normalize(request,data,endpoint):
    r=AnalysisRequest.model_validate(request).canonical()
    rows=[]; seen=set(); excluded=invalid=0
    raw=data['elements']
    for item in raw[:MAX_RECORDS]:
        try:
            tags,pos=element(item,False)
        except (ValueError,TypeError):
            excluded+=1; invalid+=1; continue
        identity=f'{item["type"]}/{item["id"]}'
        if identity in seen:
            excluded+=1; continue
        seen.add(identity)
        category=next((c for c in [r['categoryId'],*r['adjacentCategoryIds']] if matching(c,tags)),None)
        if not category:
            excluded+=1;continue
        try:
            pos=Position.model_validate(pos).model_dump()
        except ValueError:
            excluded+=1;invalid+=1;continue
        meters=distance(r['scope']['center'],pos)
        if meters>r['scope']['radiusMeters']:
            excluded+=1; continue
        row=dict(sourceType=item['type'],sourceId=item['id'],sourceUrl=f'https://www.openstreetmap.org/{identity}',name=tags.get('name','').strip()[:500] or None,coordinates=pos,positionKind='node' if item['type']=='node' else 'representative-center',categoryId=category,relation='direct' if category==r['categoryId'] else 'adjacent',evidence=matching(category,tags),distanceMeters=meters)
        extra=details(tags)
        if extra:
            row['details']=extra
        rows.append(row)
    rows.sort(key=lambda c:(c['distanceMeters'],c['sourceId']))
    partial=len(raw)>MAX_RECORDS or invalid>0
    direct=sum(c['relation']=='direct' for c in rows)
    warnings=['Coverage is unknown. Counts describe mapped features, not all businesses. Distinct OSM objects may represent the same business.','Way and relation centers are representative positions, not guaranteed entrances.']
    if partial:
        warnings.insert(0,'Truncated or invalid upstream records. Results are partial; aggregates are unavailable.')
    return dict(request=r,status='partial' if partial else 'complete',truncated=len(raw)>MAX_RECORDS,competitors=rows,directMappedCount=None if partial else direct,adjacentMappedCount=None if partial else len(rows)-direct,directMappedDensity=None if partial else direct/(math.pi*(r['scope']['radiusMeters']/1000)**2),provenance=dict(provider='OpenStreetMap / Overpass',fetchedAt=data['fetchedAt'],osmBaseTimestamp=data.get('osmBaseTimestamp'),upstreamEndpoint=endpoint,queryHash=data['queryHash'],cacheState='live',attribution='© OpenStreetMap contributors',licenseLink='https://www.openstreetmap.org/copyright',coverage='unknown',excludedRecordCount=excluded),warnings=warnings)

def validate_cached(value,request):
    validate_dates(value['provenance']['fetchedAt'],value['provenance']['osmBaseTimestamp'])
    if key(value['request'])!=key(request) or value['provenance']['queryHash']!=digest(query_for(request)):
        raise ValueError('Incompatible map cache')
    if age(value['provenance']['fetchedAt'])>STALE:
        raise ValueError('Expired map cache')
    if value['provenance']['upstreamEndpoint'] not in REGISTRY['overpassEndpoints']:
        raise ValueError('Unsupported provider')
    seen=set()
    for row in value['competitors']:
        identity=f'{row["sourceType"]}/{row["sourceId"]}'
        meters=distance(request['scope']['center'],row['coordinates'])
        if identity in seen or row['sourceUrl']!=f'https://www.openstreetmap.org/{identity}' or meters>request['scope']['radiusMeters'] or abs(meters-row['distanceMeters'])>.01 or matching(row['categoryId'],row['evidence'])!=row['evidence']:
            raise ValueError('Invalid cached competitor')
        if row['relation']=='direct' and row['categoryId']!=request['categoryId'] or row['relation']=='adjacent' and row['categoryId'] not in request['adjacentCategoryIds']:
            raise ValueError('Invalid cached category')
        seen.add(identity)
    direct=sum(c['relation']=='direct' for c in value['competitors'])
    if value['status']=='partial':
        if any(value[k] is not None for k in ('directMappedCount','adjacentMappedCount','directMappedDensity')) or not value['warnings']:
            raise ValueError('Partial aggregates')
    elif value['truncated'] or value['directMappedCount']!=direct or value['adjacentMappedCount']!=len(value['competitors'])-direct or abs(value['directMappedDensity']-direct/(math.pi*(request['scope']['radiusMeters']/1000)**2))>1e-9:
        raise ValueError('Invalid aggregates')
    return value

class Maps:
    def __init__(self,client):
        self.client=client
        self.endpoint=os.getenv('ATLAS_OVERPASS_ENDPOINT','').strip() or REGISTRY['overpassEndpoints'][0]
        if self.endpoint not in REGISTRY['overpassEndpoints']:
            raise ValueError('Overpass endpoint must be allowlisted')

    async def fetch(self,query,metrics=None,providers=None):
        headers={'User-Agent':'ATLAS/0.2 (OpenStreetMap neighborhood analysis)'}
        if self.endpoint=='https://api.overpass.ch/v1/interpreter':
            secret=os.getenv('ATLAS_OVERPASS_API_KEY')
            if not secret:
                raise ProviderError('Overpass key unconfigured')
            headers['X-API-Key']=secret
        async with OSM_SEMAPHORE:
            if providers:
                if providers.remaining()<=0:
                    raise ProviderError('request budget exhausted')
                providers.count+=1
            row=dict(provider='overpass',stage='mapping',status='unavailable')
            if metrics:
                metrics.data['calls'].append(row)
            start=time.monotonic()
            try:
                timeout=min(25,max(.01,providers.deadline-time.monotonic())) if providers else 25
                async with asyncio.timeout(timeout):
                    async with self.client.stream('POST',self.endpoint,data={'data':query},headers=headers) as response:
                        row['httpStatus']=response.status_code
                        if response.status_code!=200:
                            raise ProviderError(f'overpass: HTTP {response.status_code}')
                        content=bytearray()
                        async for chunk in response.aiter_bytes():
                            content.extend(chunk)
                            if len(content)>8*1024*1024:
                                raise ProviderError('Overpass payload limit')
                        raw=json.loads(content)
                        if raw.get('remark') or not isinstance(raw.get('elements'),list):
                            raise ProviderError('Overpass incomplete envelope')
                        validate_dates(stamp(),raw.get('osm3s',{}).get('timestamp_osm_base'))
                        row['status']='complete'
                        return dict(elements=raw['elements'],fetchedAt=stamp(),osmBaseTimestamp=raw.get('osm3s',{}).get('timestamp_osm_base'),queryHash=digest(query))
            except (httpx.HTTPError,TimeoutError,ValueError) as exc:
                row['failure']=type(exc).__name__
                raise ProviderError(f'overpass: {type(exc).__name__}') from None
            except ProviderError as exc:
                row['failure']=str(exc); raise
            finally:
                row['durationMs']=round((time.monotonic()-start)*1000)

    async def analyze(self,input,metrics=None,providers=None):
        request=AnalysisRequest.model_validate(input).canonical(); cache_key=key(request)
        fallbacks=[]
        runtime=MAP_CACHE.get(cache_key,stale=True)
        if runtime:
            try:
                fallbacks.append((validate_cached(runtime,request),'runtime'))
            except (ValueError,KeyError,TypeError):
                pass
        for file in (ROOT/'data'/'snapshots').glob('*.json'):
            try:
                wrapper=json.loads(file.read_text(encoding='utf-8'))
                value=wrapper['response']
                serialized=json.dumps(value,ensure_ascii=False,separators=(',',':'))
                if digest(serialized)!=wrapper['fileIntegrityHash']:
                    continue
                fallbacks.append((validate_cached(value,request),'snapshot'))
            except (ValueError,KeyError,TypeError):
                continue
        fallbacks.sort(key=lambda item:age(item[0]['provenance']['fetchedAt']))
        def serve(item,stale):
            value,source=copy.deepcopy(item)
            value['provenance']['cacheState']=source+('-stale' if stale else '-fresh')
            if stale:
                value['warnings'].append('Live retrieval failed. Showing an exact stale fallback; check its original retrieval date.')
            if metrics:
                metrics.data['cacheHits']+=1
            return value
        if fallbacks and age(fallbacks[0][0]['provenance']['fetchedAt'])<=FRESH:
            return serve(fallbacks[0],False)
        try:
            raw=await self.fetch(query_for(request),metrics,providers)
            result=normalize(request,raw,self.endpoint)
            MAP_CACHE.put(cache_key,result)
            return result
        except ProviderError:
            if fallbacks:
                return serve(fallbacks[0],True)
            raise

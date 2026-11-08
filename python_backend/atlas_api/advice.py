from .maps import CATEGORIES,MAX_RECORDS,element,inactive,matching,query_for
from .schemas import AdviceDecision,Position,distance
from .providers import ProviderError

def complements(category):
    if category in ('cafe','bakery','bubble-tea','restaurant','fast-food','bar','ice-cream'):
        return ['coworking','hotel','books','clothing']
    if category in ('software','coworking','estate-agent','accountant','lawyer'):
        return ['cafe','restaurant','hotel']
    if category in ('clinic','dentist','pharmacy'):
        return [c for c in ['clinic','dentist','pharmacy','supermarket'] if c!=category]
    return [c for c in ['cafe','supermarket','gym','hairdresser'] if c!=category]

def measure(request,elements):
    area=dict(id='current',label='Selected location',center=request['scope']['center'],competition=0,complements=0,transit=0,score=None,sources=[])
    complete=len(elements)<=MAX_RECORDS;seen=set()
    for raw in elements[:MAX_RECORDS]:
        try:
            tags,pos=element(raw,False)
        except (ValueError,TypeError):
            complete=False;continue
        identity=f'{raw["type"]}/{raw["id"]}'
        if identity in seen or inactive(tags):
            continue
        seen.add(identity)
        try:
            pos=Position.model_validate(pos).model_dump()
        except ValueError:
            complete=False;continue
        metric='competition' if matching(request['categoryId'],tags) else 'complements' if any(matching(c,tags) for c in complements(request['categoryId'])) else 'transit' if tags.get('highway')=='bus_stop' or tags.get('railway') in ('station','tram_stop') else None
        if metric and distance(area['center'],pos)<=request['scope']['radiusMeters']:
            area[metric]+=1
            if sum(s['metric']==metric for s in area['sources'])<4:
                area['sources'].append(dict(id=identity,name=(tags.get('name') or 'Unnamed mapped feature')[:300],metric=metric))
    if not complete:
        area.update(competition=None,complements=None,transit=None)
    return area,complete

async def advise(request,maps,providers):
    analysis=request.analysis.canonical()
    selectors=list(dict.fromkeys([p for c in [analysis['categoryId'],*complements(analysis['categoryId'])] for p in CATEGORIES[c]['predicates']]+['["highway"="bus_stop"]','["railway"="station"]','["railway"="tram_stop"]']))
    query=query_for(analysis,selectors)
    data=await maps.fetch(query,providers.metrics,providers)
    area,complete=measure(analysis,data['elements'])
    warnings=[
        'This assesses only the selected area, not premises, entrance, zoning or available property.',
        'OSM coverage is unknown. Counts describe mapped features, not unique businesses, stations or ridership; centers may be representative.',
        'Complementary activity is a hypothesis, not measured demand. Broad categories do not verify specialty competition.',
        'Rent, footfall, demographics, current business status and profitability require independent verification.',
    ]
    status='insufficient';recommendation=None
    if not complete:
        warnings.append('Truncated or invalid records: all aggregate counts and assessment withheld.')
    elif sum(area[k] for k in ('competition','complements','transit'))<3:
        warnings.append('Too few mapped features for a useful assessment; no conclusion about demand can be drawn.')
    else:
        try:
            result=await providers.structured('analyst','Assess only this selected location. Return recommendedId null, no ranking. Select metric priorities and at least three local validation checks. Never infer demand, property availability, profitability or footfall from map counts.',dict(description=request.description,area=area,warnings=warnings),AdviceDecision)
            recommendation=result.model_dump();status='provisional'
        except ProviderError as exc:
            providers.metrics.data['failures'].append(dict(stage='advice',reason=str(exc)))
            warnings.append('Location agent unavailable or invalid; measured evidence remains inspectable.')
            status='agent-unavailable'
    return dict(request=dict(analysis=analysis,description=request.description),candidates=[area],status=status,recommendation=recommendation,model=providers.judgment_model,fetchedAt=data['fetchedAt'],osmBaseTimestamp=data['osmBaseTimestamp'],query=query,queryHash=data['queryHash'],complementCategories=[CATEGORIES[c]['label'] for c in complements(analysis['categoryId'])],warnings=warnings)

"""Emit synthetic Python responses for validation by the original Zod schemas."""
import asyncio
import json
from test_workflow import evaluate,mapped,REQUEST
from atlas_api.advice import measure
from atlas_api.maps import query_for,digest
from atlas_api.runtime import stamp

async def main():
    reports=[await evaluate(case) for case in ('normal','specialty','empty','ambiguous-branch','unsupported-quote','unsupported-claim','unsupported-conclusion','provider-failure','verifier-failure','deadline','correction')]
    area,_=measure(REQUEST,[])
    advice=dict(request=dict(analysis=REQUEST,description='coffee'),candidates=[area],status='insufficient',recommendation=None,model='synthetic',fetchedAt=stamp(),osmBaseTimestamp=None,query=query_for(REQUEST),queryHash=digest(query_for(REQUEST)),complementCategories=[],warnings=['Synthetic fixture.'])
    print(json.dumps(dict(reports=reports,analysis=mapped(),advice=advice)))

asyncio.run(main())

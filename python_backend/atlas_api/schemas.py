"""Strict inbound contracts, with names matching the existing frontend."""
import json
import math
from pathlib import Path
from typing import Annotated,Literal
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

REGISTRY = json.loads(Path(__file__).with_name('registry.json').read_text(encoding='utf-8'))
CATEGORIES, CITIES = REGISTRY['categories'], REGISTRY['cities']

class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True, allow_inf_nan=False, strict=True)

class Position(StrictModel):
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)

class Scope(StrictModel):
    cityId: Literal['nyc', 'london', 'dubai', 'singapore']
    center: Position
    radiusMeters: Literal[500, 1000, 2000]

    @model_validator(mode='after')
    def inside_city(self):
        s,w,n,e = CITIES[self.cityId]['envelope']
        for lat,lon in [(self.center.lat,self.center.lon),(round(self.center.lat,4),round(self.center.lon,4))]:
            if not s <= lat <= n or not w <= lon <= e:
                raise ValueError('Center outside city guardrail')
        return self

class AnalysisRequest(StrictModel):
    schemaVersion: Literal['1']
    registryVersion: Literal['2']
    scope: Scope
    categoryId: str
    adjacentCategoryIds: list[str] = Field(max_length=2)

    @model_validator(mode='after')
    def registry(self):
        if self.categoryId not in CATEGORIES:
            raise ValueError('Unsupported category')
        if len(set(self.adjacentCategoryIds)) != len(self.adjacentCategoryIds) or any(c not in CATEGORIES[self.categoryId]['adjacent'] for c in self.adjacentCategoryIds):
            raise ValueError('Unsupported adjacent categories')
        return self

    def canonical(self):
        data=self.model_dump()
        data['scope']['center']={k:round(v,4) for k,v in data['scope']['center'].items()}
        data['adjacentCategoryIds'].sort()
        return data

class ResearchRequest(StrictModel):
    description: str = Field(min_length=3,max_length=500)
    scope: Scope
    goals: str | None = Field(default=None,max_length=500)
    osmRequest: AnalysisRequest | None = None
    localOnly: bool | None = None

    @model_validator(mode='after')
    def matching_scope(self):
        if any(getattr(self,k) is None for k in self.model_fields_set & {'goals','osmRequest','localOnly'}):
            raise ValueError('Optional fields must be omitted rather than null')
        if self.osmRequest and self.scope != self.osmRequest.scope:
            raise ValueError('OSM scope must match research scope')
        if self.localOnly and not self.osmRequest:
            raise ValueError('Local research requires a confirmed category')
        return self

class Description(StrictModel):
    description: str = Field(min_length=3,max_length=500)

class AdviceRequest(StrictModel):
    analysis: AnalysisRequest
    description: str = Field(default='',max_length=500)

class Suggestion(StrictModel):
    categoryId: str | None
    explanation: str = Field(min_length=1,max_length=240)

    @model_validator(mode='after')
    def category(self):
        if self.categoryId is not None and self.categoryId not in CATEGORIES:
            raise ValueError('Unknown category')
        return self

class Choice(StrictModel):
    action: Literal['search','inspect','refine','stop']
    candidateId: str | None
    sourceId: str | None
    focus: Literal['offerings','prices','branch','feedback']

class Selection(StrictModel):
    sourceId: str
    quoteId: str
    business: str
    kind: Literal['offering','price','feedback','location']

class Extraction(StrictModel):
    findings: list[Selection] = Field(max_length=12)
    unknowns: list[str] = Field(max_length=8)

class Impact(StrictModel):
    id: str = Field(min_length=1,max_length=2000)
    business: str = Field(min_length=1,max_length=2000)
    effect: Literal['competition','complement','limited-overlap','unclear']
    yourOffering: str = Field(min_length=1,max_length=2000)
    competitorOffering: str = Field(min_length=1,max_length=2000)
    findingIds: list[str] = Field(min_length=1,max_length=4)

class Assessment(StrictModel):
    verdict: Literal['recommended','not-recommended','insufficient-evidence']
    reasoning: str = Field(min_length=1,max_length=600)
    findingIds: list[str] = Field(max_length=8)
    risks: list[Annotated[str,StringConstraints(min_length=1,max_length=300)]] = Field(min_length=1,max_length=3)

class Synthesis(StrictModel):
    impacts: list[Impact] = Field(max_length=3)
    assessment: Assessment

class Decision(StrictModel):
    id: str
    supported: bool
    reason: str = Field(min_length=1,max_length=1000)

class Verification(StrictModel):
    findings: list[Decision] = Field(max_length=24)
    impacts: list[Decision] = Field(max_length=3)
    assessmentSupported: bool
    missingEvidence: list[str] = Field(max_length=8)
    retrieveCandidateId: str | None

class AdviceDecision(StrictModel):
    recommendedId: None
    priorities: list[Literal['competition','complements','transit']] = Field(min_length=1,max_length=3)
    checks: list[Literal['rent','footfall','competitors','access','permits','customers']] = Field(min_length=3,max_length=6)

    @model_validator(mode='after')
    def unique(self):
        if len(set(self.priorities))!=len(self.priorities) or len(set(self.checks))!=len(self.checks):
            raise ValueError('Duplicate priorities/checks')
        return self

def distance(a,b):
    rad=math.pi/180
    h=math.sin((b['lat']-a['lat'])*rad/2)**2+math.cos(a['lat']*rad)*math.cos(b['lat']*rad)*math.sin((b['lon']-a['lon'])*rad/2)**2
    return 6371000*2*math.asin(math.sqrt(min(1,h)))

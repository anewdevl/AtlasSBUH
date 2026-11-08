"""Bounded process-local retrieval caches and redacted run telemetry."""
import copy
import json
import time
import uuid
from collections import OrderedDict
from datetime import datetime,timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]

def stamp():
    return datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')

def age(timestamp):
    return max(0,time.time()-datetime.fromisoformat(timestamp.replace('Z','+00:00')).timestamp())

class Cache:
    def __init__(self,capacity=100,ttl=86400):
        self.capacity,self.ttl=capacity,ttl
        self.entries=OrderedDict()

    def get(self,key,stale=False):
        saved=self.entries.get(key)
        if not saved:
            return None
        created,value=saved
        if time.monotonic()-created>self.ttl and not stale:
            return None
        self.entries.move_to_end(key)
        return copy.deepcopy(value)

    def put(self,key,value):
        self.entries[key]=(time.monotonic(),copy.deepcopy(value))
        self.entries.move_to_end(key)
        while len(self.entries)>self.capacity:
            self.entries.popitem(last=False)

class Metrics:
    def __init__(self,kind):
        self.data=dict(runId=uuid.uuid4().hex,kind=kind,startedAt=stamp(),calls=[],stages=[],cacheHits=0,rejectedClaims=0,failures=[])
        self.start=time.monotonic()

    def finish(self,report=None,cancelled=False):
        self.data.update(durationMs=round((time.monotonic()-self.start)*1000),cancelled=cancelled)
        if report:
            self.data.update(status=report.get('status'),evidence=len(report.get('evidence',[])),findings=len(report.get('findings',[])),impacts=len(report.get('impacts',[])))
        target=ROOT/'.atlas-local'/'metrics.jsonl'
        target.parent.mkdir(exist_ok=True)
        if target.exists() and target.stat().st_size>5_000_000:
            target.replace(target.with_suffix('.previous.jsonl'))
        with target.open('a',encoding='utf-8') as handle:
            handle.write(json.dumps(self.data)+'\n')
        return self.data

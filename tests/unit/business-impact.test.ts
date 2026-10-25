import {it,expect} from 'vitest';
import {groundedImpacts,impactExplanation,offeringsOverlap} from '../../src/lib/business-impact';
import type {Finding,ResearchRequest,BusinessImpact} from '../../src/lib/research-contracts';
import {request as mapped} from '../fixtures';
const request:ResearchRequest={description:'desi clothing store',scope:mapped.scope,osmRequest:{...mapped,categoryId:'clothing'}};
const finding:Finding={id:'f1',business:'Synthetic Fashion',kind:'offering',claim:'Synthetic Fashion sells designer clothing.',relation:'context',evidence:[{sourceId:'s1',quote:'Synthetic Fashion sells designer clothing.'}],geographicRelevance:'Branch unconfirmed',limitations:['Source assertion'],reviewSampleSize:null,reviewDates:null};
const impact:BusinessImpact={id:'impact1',business:'Synthetic Fashion',effect:'competition',yourOffering:'clothing',competitorOffering:'designer clothing',findingIds:['f1']};
it('keeps a specialty unverified when only broad clothing overlap is evidenced',()=>{
 expect(groundedImpacts([impact],[finding],request)).toHaveLength(1);expect(impactExplanation(impact,request)).toContain('desi');expect(impactExplanation(impact,request)).toContain('unverified');
});
it('rejects another business, nonexistent offering, invented request requirement and identity-only evidence',()=>{
 for(const invalid of [{...impact,business:'Unrelated Shop'},{...impact,competitorOffering:'bridal lehengas'},{...impact,yourOffering:'bridal'}])expect(groundedImpacts([invalid],[finding],request)).toEqual([]);
 expect(groundedImpacts([impact],[{...finding,kind:'location'}],request)).toEqual([]);expect(offeringsOverlap('clothing','espresso')).toBe(false);
});

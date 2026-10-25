import {test,expect} from '@playwright/test';
import {result} from '../fixtures';
import {stages} from '../../src/lib/research-contracts';
import {shortlistBusinesses} from '../../src/lib/business-shortlist';

test.beforeEach(async({page})=>{await page.route('https://tile.openstreetmap.org/**',r=>r.abort());});

test('retail business is classified before analysis; unsupported input never becomes a cafe',async({page})=>{
 let calls=0;
 await page.route('**/api/suggest',r=>r.fulfill({json:{categoryId:r.request().postDataJSON().description.includes('online')?null:'clothing',explanation:'Synthetic mapping.'}}));
 await page.route('**/api/analyze',r=>{calls++;const request=r.request().postDataJSON();expect(request.categoryId).toBe('clothing');return r.fulfill({json:result([],request)});});
 await page.goto('/');await expect(page.getByRole('button',{name:'Locations',exact:true})).toHaveCount(0);
 await page.getByLabel('What are you opening?').fill('A clothing boutique');await page.getByRole('button',{name:'Analyze this area'}).click();
 await expect(page.getByRole('heading',{name:'Clothing shop · New York'})).toBeVisible();
 await page.getByRole('button',{name:'Search',exact:true}).click();await page.getByLabel('What are you opening?').fill('online venture');await page.getByRole('button',{name:'Analyze this area'}).click();
 await expect(page.locator('.error[role=alert]')).toContainText('No reliable mapped type');expect(calls).toBe(1);
});

test('selected-location assessment stays at the chosen pin and never displays a score',async({page})=>{
 await page.route('**/api/suggest',r=>r.fulfill({json:{categoryId:'supermarket',explanation:'Synthetic mapping.'}}));
 await page.route('**/api/location-advice',r=>{
  const request=r.request().postDataJSON();expect(request.analysis.categoryId).toBe('supermarket');
  return r.fulfill({json:{request,candidates:[{id:'current',label:'Selected location',center:request.analysis.scope.center,competition:4,complements:7,transit:2,score:null,sources:[]}],status:'provisional',recommendation:{recommendedId:null,priorities:['transit'],checks:['rent','footfall','permits']},model:'fixture',fetchedAt:new Date().toISOString(),osmBaseTimestamp:null,query:'fixture',queryHash:'a'.repeat(64),complementCategories:['Café'],warnings:['Zoning is unverified.']}});
 });
 await page.goto('/');await page.getByLabel('What are you opening?').fill('Grocery supermarket');await page.getByRole('button',{name:'Research',exact:true}).click();await page.getByRole('button',{name:'Assess this location'}).click();
 const panel=page.getByRole('region',{name:'Location assessment'});await expect(panel).toContainText('Location evidence reviewed');await expect(panel).toContainText('Mapped category features');await expect(panel).not.toContainText('/100');await expect(panel).not.toContainText('Nearby north');
 await panel.getByText('Limitations & retrieval details').click();await expect(panel).toContainText('Zoning is unverified.');
 await page.screenshot({path:'test-results/selected-location-assessment.png',animations:'disabled'});
});

test('on-demand research shares classification and connects supported observations to competitor details',async({page})=>{
 let researchCalls=0;
 await page.route('**/api/suggest',r=>r.fulfill({json:{categoryId:'cafe',explanation:'Synthetic mapping.'}}));
 await page.route('**/api/analyze',r=>r.fulfill({json:result(undefined,r.request().postDataJSON())}));
 await page.route('**/api/research',r=>{
  researchCalls++;const request=r.request().postDataJSON(),mapped=result(undefined,request.osmRequest);
  return r.fulfill({contentType:'application/x-ndjson',body:JSON.stringify({type:'report',report:{request,status:'partial',startedAt:new Date().toISOString(),evidence:[{id:'source',url:'https://fixture.example/menu',provider:'tavily',retrievedAt:new Date().toISOString(),title:'Synthetic menu',excerpt:'Synthetic test café offers coffee.',contentKind:'page',placeId:null,coordinates:null}],findings:[{id:'finding',claim:'Offers coffee.',kind:'offering',business:'Synthetic test café',relation:'direct',evidence:[{sourceId:'source',quote:'Synthetic test café offers coffee.'}],geographicRelevance:'Branch unconfirmed.',limitations:['One source only.'],reviewSampleSize:null,reviewDates:null}],insights:[],shortlist:shortlistBusinesses(mapped,request.description),stages:stages.map(stage=>({stage,status:'partial',message:'Synthetic stage.'})),warnings:[],unknowns:[]}})+'\n'});
 });
 await page.goto('/');await page.getByLabel('What are you opening?').fill('Coffee shop');await page.getByRole('button',{name:'Analyze this area'}).click();await expect(page.locator('.feature')).toHaveCount(1);
 await page.getByRole('button',{name:'Research',exact:true}).click();expect(researchCalls).toBe(0);await page.getByRole('button',{name:'Generate insights'}).click();await expect(page.getByLabel('Research report',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:/^Competitors/}).click();await page.locator('.feature').click();const details=page.getByRole('region',{name:'Competitor details',exact:true});await expect(details).toContainText('Exact branch identity is unconfirmed');await details.getByText('offering: Offers coffee.').click();await expect(details.getByRole('link',{name:'Synthetic menu'})).toHaveAttribute('href','https://fixture.example/menu');
 await page.getByRole('button',{name:'Close competitor details'}).click();await page.getByRole('button',{name:'Search',exact:true}).click();await page.getByLabel('City preset').selectOption('london');await page.getByRole('button',{name:'Research',exact:true}).click();await expect(page.getByLabel('Research report',{exact:true})).toHaveCount(0);
});

test('manual selection skips classification and canceled classification cannot overwrite later input',async({page})=>{
 let suggestions=0;let release:()=>void=()=>{};
 await page.route('**/api/suggest',async r=>{suggestions++;await new Promise<void>(resolve=>release=resolve);await r.fulfill({json:{categoryId:'cafe',explanation:'Delayed fixture.'}}).catch(()=>{});});
 await page.route('**/api/analyze',r=>{const request=r.request().postDataJSON();expect(request.categoryId).toBe('gym');return r.fulfill({json:result([],request)});});
 await page.goto('/');await page.getByLabel('What are you opening?').fill('Coffee shop');await page.getByRole('button',{name:'Interpret business',exact:true}).click();await expect.poll(()=>suggestions).toBe(1);await page.getByLabel('What are you opening?').fill('Fitness studio');release();
 await page.getByText('Advanced settings',{exact:true}).click();await page.getByLabel('Use manual business type').check();await page.getByLabel('Confirmed category').selectOption('gym');await page.getByRole('button',{name:'Analyze this area'}).click();await expect(page.getByRole('heading',{name:'Gym / fitness centre · New York'})).toBeVisible();expect(suggestions).toBe(1);
});

import {test,expect} from '@playwright/test';
import {result} from '../fixtures';
import {shortlistBusinesses} from '../../src/lib/business-shortlist';
import {stages} from '../../src/lib/research-contracts';
test.beforeEach(async({page})=>{await page.route('https://tile.openstreetmap.org/**',r=>r.abort());await page.route('https://www.google.com/maps?**',r=>r.fulfill({contentType:'text/html',body:'<p>Mock map transport</p>'}));});
test('general preview accepts different businesses without Places or an API key',async({page})=>{
 let places=0;await page.route('**/api/places',r=>{places++;return r.abort();});await page.goto('/map-preview');
 for(const query of ['Synthetic café London','Synthetic bookshop Singapore']){await page.getByLabel('Business name or address').fill(query);await page.getByRole('button',{name:'Preview map',exact:true}).click();const src=await page.locator('iframe').getAttribute('src');expect(new URL(src!).searchParams.get('q')).toBe(query);expect(new URL(src!).searchParams.has('key')).toBe(false);}
 expect(places).toBe(0);
});
test('every Research shortlist result, including entries beyond the first three, has its own mini map',async({page,context})=>{
 let places=0;await page.route('**/api/places',r=>{places++;return r.abort();});await page.route('**/api/suggest',r=>r.fulfill({json:{categoryId:'cafe',explanation:'Synthetic category'}}));
 await page.route('**/api/research',r=>{const input=r.request().postDataJSON(),mapped=result([1,2,3,4].map(id=>({type:'node',id,lat:40.7308+id*0.0001,lon:-73.9973,tags:{amenity:'cafe',name:`Synthetic shop ${id}`}})),input.osmRequest);return r.fulfill({contentType:'application/x-ndjson',body:JSON.stringify({type:'report',report:{request:input,status:'partial',startedAt:new Date().toISOString(),evidence:[],findings:[],insights:[],shortlist:shortlistBusinesses(mapped,input.description),stages:stages.map(stage=>({stage,status:'partial',message:'Synthetic test'})),warnings:[],unknowns:[]}})+'\n'});});
 await page.goto('/');await page.getByRole('button',{name:'Research',exact:true}).click();await page.getByLabel('Business description',{exact:true}).fill('coffee shop');await page.getByRole('button',{name:'Generate insights'}).click();
 await page.getByText('Show all 4 mapped candidates',{exact:true}).click();
 for(const id of [1,4]){await page.getByRole('button',{name:`Mini map for Synthetic shop ${id}`,exact:true}).click();const sheet=page.getByRole('dialog',{name:'Business mini map'});await expect(sheet).toBeVisible();expect(new URL((await sheet.locator('iframe').getAttribute('src'))!).searchParams.get('q')).toContain(`Synthetic shop ${id}`);await page.keyboard.press('Escape');await expect(sheet).toHaveCount(0);}
 expect(places).toBe(0);expect(context.pages()).toHaveLength(1);
});
for(const named of [true,false])test(`competitor mini maps work for ${named?'named':'unnamed'} mapped features without Places`,async({page})=>{
 let places=0;await page.route('**/api/places',r=>{places++;return r.abort();});await page.route('**/api/suggest',r=>r.fulfill({json:{categoryId:'cafe',explanation:'Synthetic category'}}));await page.route('**/api/analyze',r=>r.fulfill({json:result([{type:'node',id:42,lat:40.7308,lon:-73.9973,tags:{amenity:'cafe',...(named?{name:'Synthetic different café'}:{})}}],r.request().postDataJSON())}));
 await page.goto('/');await page.getByLabel('What are you opening?').fill('coffee shop');await page.getByRole('button',{name:'Analyze this area'}).click();await page.locator('.feature').click();await page.getByRole('button',{name:'Open mini map',exact:true}).click();const sheet=page.getByRole('dialog',{name:'Business mini map'});const src=await sheet.locator('iframe').getAttribute('src');expect(new URL(src!).searchParams.get('q')).toContain(named?'Synthetic different café':'40.7308,-73.9973');expect(places).toBe(0);await page.keyboard.press('Escape');await expect(page.getByRole('region',{name:'Competitor details'})).toBeVisible();
});

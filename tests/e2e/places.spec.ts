import {test,expect} from '@playwright/test';
import {result} from '../fixtures';
for(const fail of [false,true])test(`Google extra info is optional and explicitly requested (${fail?'quota unavailable':'listing returned'})`,async({page,context})=>{
 let lookups=0;
 await context.route('https://tile.openstreetmap.org/**',r=>r.abort());
 await context.route('**/api/suggest',r=>r.fulfill({json:{categoryId:'cafe',explanation:'Synthetic mapping.'}}));
 await context.route('**/api/analyze',r=>r.fulfill({json:result(undefined,r.request().postDataJSON())}));
 await context.route('**/api/places',r=>{lookups++;return fail?r.fulfill({status:429,json:{code:'DEMO_QUOTA',message:'Google demo quota unavailable. Core analysis still works.'}}):r.fulfill({json:{request:r.request().postDataJSON(),provider:'Google Maps',fetchedAt:new Date().toISOString(),remainingRequests:4,matches:[{id:'ChIJfixture',name:'Synthetic Google listing',address:'Synthetic address',businessStatus:'OPERATIONAL',primaryType:'cafe',mapsUrl:'https://maps.google.com/?cid=123',attributions:[]}]}});});
 await page.goto('/');await page.getByLabel('What are you opening?').fill('Coffee shop');await page.getByRole('button',{name:'Analyze this area'}).click();await page.locator('.feature').click();expect(lookups).toBe(0);
 const popup=page.waitForEvent('popup');await page.getByRole('link',{name:'Extra info (Google)'}).click();const extra=await popup;await expect(extra.getByRole('button',{name:'Get Google place info'})).toBeVisible();expect(lookups).toBe(0);await expect(extra.locator('.leaflet-container')).toHaveCount(0);await extra.getByRole('button',{name:'Get Google place info'}).click();
 if(fail){await expect(extra.getByRole('region',{name:'Optional Google place information'}).getByRole('alert')).toContainText('Google demo quota unavailable');await expect(extra.locator('.google-place-results')).toHaveCount(0);}else{await expect(extra.getByRole('heading',{name:'Synthetic Google listing'})).toBeVisible();await expect(extra.getByRole('button',{name:'Lookup complete'})).toBeDisabled();await expect(extra.locator('.google-maps-attribution')).toHaveText('Google Maps');await expect(extra.getByText(/branch identity is unverified/)).toBeVisible();}
 await page.getByRole('button',{name:'Close competitor details'}).click();await page.getByRole('button',{name:'Pin for comparison',exact:true}).click();await expect(page.getByLabel('Area comparison')).toContainText('Your first area is pinned.');expect(lookups).toBe(1);await extra.close();
});

import { test,expect } from '@playwright/test';
import { normalize } from '../../src/server/normalize';
import { buildQuery,hashQuery } from '../../src/server/overpass';
test.beforeEach(async({page})=>{await page.route('https://tile.openstreetmap.org/**',route=>route.abort());await page.route('https://fonts.googleapis.com/**',route=>route.abort());});
test('initial desktop layout and keyboard access',async({page})=>{
 await page.goto('/');await page.keyboard.press('Tab');await expect(page.getByRole('link',{name:'Skip to analysis'})).toBeFocused();await page.keyboard.press('Enter');await expect(page.getByRole('heading',{name:/Explore a market/})).toBeVisible();await expect(page.locator('.leaflet-container')).toBeVisible();await page.screenshot({path:'test-results/atlas-desktop.png',fullPage:true,animations:'disabled'});
});
test('four cities, source evidence, comparison, and browser save',async({page})=>{
 await page.route('**/api/analyze',async route=>{const request=route.request().postDataJSON();const response=normalize(request,{elements:[{type:'node',id:123,...request.scope.center,tags:{amenity:'cafe',name:'Synthetic browser fixture'}}],fetchedAt:new Date().toISOString(),osmBaseTimestamp:null,queryHash:hashQuery(buildQuery(request))});await route.fulfill({json:response});});
 await page.goto('/');
 for(const city of ['nyc','london','dubai','singapore']){await page.getByRole('button',{name:'Search',exact:true}).click();await page.getByLabel('City preset').selectOption(city);await page.getByRole('button',{name:'Analyze this area'}).click();await expect(page.getByRole('heading',{name:/Café ·/})).toBeVisible();await expect(page.locator('.feature-name').filter({hasText:'Synthetic browser fixture'})).toBeVisible();}
 await page.locator('.feature-name').filter({hasText:'Synthetic browser fixture'}).click();await expect(page.getByRole('link',{name:'node/123'})).toHaveAttribute('href','https://www.openstreetmap.org/node/123');
 await page.getByRole('button',{name:'Close competitor details'}).click();await page.getByRole('button',{name:'Pin for comparison'}).click();await page.getByRole('button',{name:'Search',exact:true}).click();await page.getByLabel('City preset').selectOption('nyc');await page.getByRole('button',{name:'Analyze this area'}).click();await page.getByRole('button',{name:/^Compare/}).click();await expect(page.getByLabel('Area comparison')).toContainText('CURRENT AREA');await page.getByRole('button',{name:/^Competitors/}).click();
 await page.getByRole('button',{name:'Save in this browser'}).click();await page.reload();await page.getByRole('button',{name:'Saved analysis',exact:true}).click();await expect(page.locator('.feature-name').filter({hasText:'Synthetic browser fixture'})).toBeVisible();
});
test('pharmacy and supermarket suggestions return exact mapped evidence',async({page})=>{
 await page.route('**/api/analyze',async route=>{const request=route.request().postDataJSON();const tags=request.categoryId==='pharmacy'?{amenity:'pharmacy',healthcare:'pharmacy',name:'Synthetic pharmacy fixture'}:{shop:'supermarket',name:'Synthetic supermarket fixture'};await route.fulfill({json:normalize(request,{elements:[{type:'node',id:124,...request.scope.center,tags}],fetchedAt:new Date().toISOString(),osmBaseTimestamp:null,queryHash:hashQuery(buildQuery(request))})});});
 await page.goto('/');await page.getByLabel('What are you opening?').fill('pharmacy');await page.getByRole('button',{name:'Suggest category'}).click();await page.getByRole('button',{name:'Pharmacy',exact:true}).click();await page.getByRole('button',{name:'Analyze this area'}).click();await expect(page.getByRole('heading',{name:'Pharmacy · New York'})).toBeVisible();await expect(page.locator('.feature-name').filter({hasText:'Synthetic pharmacy fixture'})).toBeVisible();
 await page.getByRole('button',{name:'Search',exact:true}).click();await page.getByLabel('What are you opening?').fill('supermarket');await page.getByRole('button',{name:'Suggest category'}).click();await page.getByRole('button',{name:'Supermarket',exact:true}).click();await page.getByRole('button',{name:'Analyze this area'}).click();await expect(page.getByRole('heading',{name:'Supermarket · New York'})).toBeVisible();await expect(page.locator('.feature-name').filter({hasText:'Synthetic supermarket fixture'})).toBeVisible();
});

test('bakery and bubble tea categories render and analyze with their reviewed evidence',async({page})=>{
 await page.route('**/api/analyze',async route=>{const request=route.request().postDataJSON();const tags=request.categoryId==='bakery'?{shop:'bakery',name:'Synthetic bakery fixture'}:{amenity:'cafe',cuisine:'tea; bubble_tea',name:'Synthetic bubble tea fixture'};await route.fulfill({json:normalize(request,{elements:[{type:'node',id:125,...request.scope.center,tags}],fetchedAt:new Date().toISOString(),osmBaseTimestamp:null,queryHash:hashQuery(buildQuery(request))})});});
 await page.goto('/');await page.getByLabel('Confirmed category').selectOption('bakery');await page.getByText('Advanced settings',{exact:true}).click();await expect(page.locator('fieldset').nth(1).getByText('Café',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Analyze this area'}).click();await expect(page.getByRole('heading',{name:'Bakery · New York'})).toBeVisible();await expect(page.locator('.feature-name').filter({hasText:'Synthetic bakery fixture'})).toBeVisible();
 await page.getByRole('button',{name:'Search',exact:true}).click();await page.getByLabel('Confirmed category').selectOption('bubble-tea');await expect(page.locator('fieldset').nth(1).getByText('Café',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Analyze this area'}).click();await expect(page.getByRole('heading',{name:'Bubble tea · New York'})).toBeVisible();await expect(page.locator('.feature-name').filter({hasText:'Synthetic bubble tea fixture'})).toBeVisible();
});

test('NVIDIA category helper applies a type automatically and preserves unsupported descriptions',async({page})=>{
 await page.route('**/api/suggest',async route=>{const {description}=route.request().postDataJSON();await route.fulfill({json:description.includes('online-only')?{categoryId:null,explanation:'An online-only venture has no mapped storefront type.'}:{categoryId:'cafe',explanation:'A neighborhood coffee shop maps to café.'}});});
 await page.goto('/');await page.getByLabel('What are you opening?').fill('A neighborhood coffee shop');await page.getByRole('button',{name:'Suggest with AI'}).click();await expect(page.locator('.suggestion[role="status"]')).toContainText('Selected by AI: Café');await expect(page.getByLabel('Confirmed category')).toHaveValue('cafe');
 await page.getByLabel('What are you opening?').fill('An online-only venture');await page.getByRole('button',{name:'Suggest with AI'}).click();await expect(page.locator('.suggestion[role="status"]')).toContainText('Outside current mapped categories');
});
test('unsupported categories, failure and valid empty remain distinct on mobile',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await page.getByLabel('What are you opening?').fill('online-only venture');await page.getByRole('button',{name:'Suggest category'}).click();await expect(page.getByText('No supported match. Choose a category below.')).toBeVisible();
 await page.route('**/api/analyze',route=>route.fulfill({status:503,json:{code:'UNAVAILABLE',message:'No exact fallback.'}}));await page.getByRole('button',{name:'Analyze this area'}).click();await expect(page.locator('.error[role=alert]')).toContainText('Analysis unavailable');await expect(page.getByLabel('Analysis results')).toHaveCount(0);
 await page.unroute('**/api/analyze');await page.route('**/api/analyze',async route=>{const request=route.request().postDataJSON();await route.fulfill({json:normalize(request,{elements:[],fetchedAt:new Date().toISOString(),osmBaseTimestamp:null,queryHash:hashQuery(buildQuery(request))})});});await page.getByRole('button',{name:'Analyze this area'}).click();await expect(page.getByText(/This is a valid empty result/)).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/atlas-mobile.png',fullPage:true,animations:'disabled'});
});
test('partial response cannot yield aggregate comparison',async({page})=>{
 await page.route('**/api/analyze',async route=>{const request=route.request().postDataJSON();await route.fulfill({json:normalize(request,{elements:[{type:'node',id:1,lat:999,lon:0,tags:{amenity:'cafe'}}],fetchedAt:new Date().toISOString(),osmBaseTimestamp:null,queryHash:hashQuery(buildQuery(request))})});});await page.goto('/');await page.getByRole('button',{name:'Analyze this area'}).click();await expect(page.getByText('Partial data',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Pin for comparison'}).click();await expect(page.getByLabel('Area comparison')).toContainText('Partial results cannot be compared.');await page.getByRole('button',{name:/^Competitors/}).click();await expect(page.locator('.metrics strong')).toHaveText(['—','—','—']);
});
test('theme persists and markers support hover, keyboard details, and scope reset',async({page})=>{
 let requests=0;
 await page.route('**/api/analyze',async route=>{requests++;const request=route.request().postDataJSON();await route.fulfill({json:normalize(request,{elements:[{type:'node',id:129,...request.scope.center,tags:{amenity:'cafe',name:'Synthetic marker fixture'}}],fetchedAt:new Date().toISOString(),osmBaseTimestamp:null,queryHash:hashQuery(buildQuery(request))})});});
 await page.goto('/');await expect(page.locator('.app-shell')).toHaveAttribute('data-theme','dark');
 await page.getByRole('button',{name:'Switch to light theme'}).click();await page.reload();await expect(page.locator('.app-shell')).toHaveAttribute('data-theme','light');
 await page.screenshot({path:'test-results/atlas-light.png',fullPage:true,animations:'disabled'});
 await page.getByRole('button',{name:'Switch to dark theme'}).click();await page.getByRole('button',{name:'Analyze this area'}).click();
 const marker=page.locator('.competitor-marker');await marker.hover();await expect(page.locator('.marker-preview')).toContainText('Synthetic marker fixture');
 await marker.focus();await page.keyboard.press('Enter');await expect(page.getByRole('region',{name:'Competitor details',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Close competitor details'})).toBeFocused();await expect(marker).toHaveAttribute('aria-pressed','true');expect(requests).toBe(1);
 await page.screenshot({path:'test-results/atlas-selected.png',fullPage:true,animations:'disabled'});
 await page.keyboard.press('Escape');await expect(page.getByRole('region',{name:'Competitor details',exact:true})).toHaveCount(0);await expect(marker).toBeFocused();
 await page.locator('.feature').click();await expect(page.getByRole('region',{name:'Competitor details',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Search',exact:true}).click();await page.getByLabel('City preset').selectOption('london');await expect(page.getByRole('region',{name:'Competitor details',exact:true})).toHaveCount(0);await expect(marker).toHaveCount(0);expect(requests).toBe(1);
});
test('mobile competitor detail and collapsible controls',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.route('**/api/analyze',async route=>{const request=route.request().postDataJSON();await route.fulfill({json:normalize(request,{elements:[{type:'node',id:130,...request.scope.center,tags:{amenity:'cafe',name:'Synthetic mobile fixture'}}],fetchedAt:new Date().toISOString(),osmBaseTimestamp:null,queryHash:hashQuery(buildQuery(request))})});});
 await page.goto('/');await page.getByRole('button',{name:'Collapse',exact:true}).click();await expect(page.getByLabel('What are you opening?')).toBeHidden();await page.getByRole('button',{name:'Open controls'}).click();await page.getByRole('button',{name:'Analyze this area'}).click();await page.locator('.feature').click();await expect(page.getByRole('region',{name:'Competitor details',exact:true})).toBeVisible();await page.getByRole('heading',{name:'Synthetic mobile fixture'}).click({trial:true});await page.screenshot({path:'test-results/atlas-mobile-detail.png',fullPage:true,animations:'disabled'});await page.getByRole('button',{name:'Close competitor details'}).click();await expect(page.getByRole('region',{name:'Competitor details',exact:true})).toHaveCount(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

async function explorationFixture(page:import('@playwright/test').Page){
 let requests=0;
 await page.route('**/api/analyze',async route=>{requests++;const request=route.request().postDataJSON(),{lat,lon}=request.scope.center;await route.fulfill({json:normalize(request,{elements:[
  {type:'node',id:201,lat,lon,tags:{amenity:'cafe',name:'Alpha Coffee'}},
  {type:'node',id:202,lat,lon,tags:{amenity:'cafe',name:'Beta Coffee'}},
  {type:'node',id:203,lat:lat+.006,lon,tags:{amenity:'cafe',name:'Far Coffee'}},
  {type:'node',id:204,lat:lat+.002,lon,tags:{shop:'bakery',name:'Bread Bakery'}},
  {type:'node',id:205,lat:lat+.001,lon,tags:{amenity:'cafe'}}
 ],fetchedAt:new Date().toISOString(),osmBaseTimestamp:null,queryHash:hashQuery(buildQuery(request))})});});
 await page.goto('/');await page.getByText('Advanced settings',{exact:true}).click();await page.getByRole('checkbox',{name:'Bakery',exact:true}).check();await page.getByRole('button',{name:'Analyze this area'}).click();await expect(page.locator('.feature')).toHaveCount(5);
 return ()=>requests;
}
test('search, relationship filters, and distance sort share the map view without changing totals',async({page})=>{
 const requests=await explorationFixture(page);
 await expect(page.locator('.feature-name')).toHaveText(['Alpha CoffeeCafé · direct','Beta CoffeeCafé · direct','Unnamed mapped featureCafé · direct','Bread BakeryBakery · adjacent','Far CoffeeCafé · direct']);
 await expect(page.locator('.metrics strong').nth(0)).toHaveText('4');await expect(page.locator('.metrics strong').nth(1)).toHaveText('1');
 await page.getByLabel('Search competitors',{exact:true}).fill(' ALPHA ');await expect(page.locator('.feature')).toHaveCount(1);await expect(page.locator('.competitor-marker')).toHaveCount(1);await expect(page.locator('.filter-count')).toHaveText('Showing 1 of 5 retrieved features');await expect(page.locator('.metrics strong').nth(0)).toHaveText('4');
 await page.getByLabel('Search competitors',{exact:true}).fill('no such business');await expect(page.getByText(/No competitors match these filters/)).toBeVisible();await expect(page.locator('.competitor-marker')).toHaveCount(0);await expect(page.getByRole('button',{name:'Fit results'})).toBeDisabled();
 await page.getByRole('button',{name:'Reset filters'}).click();await page.getByLabel('Filter competitors by relationship').selectOption('adjacent');await expect(page.locator('.feature-name')).toContainText('Bread Bakery');await expect(page.locator('.competitor-marker')).toHaveCount(1);
 await page.locator('.feature').click();await expect(page.getByRole('heading',{name:'Bread Bakery',exact:true})).toBeVisible();await page.getByLabel('Filter competitors by relationship').selectOption('direct');await expect(page.getByRole('region',{name:'Competitor details',exact:true})).toHaveCount(0);await expect(page.locator('.feature')).toHaveCount(4);
 await page.getByRole('button',{name:'Reset filters'}).click();await page.getByLabel('Sort competitors by distance').selectOption('farthest');await expect(page.locator('.feature-name').first()).toContainText('Far Coffee');
 await page.getByRole('button',{name:'Save in this browser'}).click();await page.getByRole('button',{name:'Saved analysis',exact:true}).click();await expect(page.locator('.feature')).toHaveCount(5);await expect(page.getByLabel('Sort competitors by distance')).toHaveValue('nearest');expect(requests()).toBe(1);
});
test('overlapping source features remain individually selectable with keyboard and mouse',async({page})=>{
 const requests=await explorationFixture(page);
 for(let i=0;i<4;i++){await page.locator('.leaflet-control-zoom-in').click();await page.waitForTimeout(250);}await expect(page.locator('.atlas-cluster')).toHaveCount(0);const beta=page.locator('.competitor-marker[data-source-id="node/202"]');await beta.click({force:true});const picker=page.getByRole('region',{name:'Overlapping competitors'});await expect(picker).toBeVisible();await expect(picker.getByRole('button')).toHaveCount(2);await page.screenshot({path:'test-results/atlas-overlap.png',fullPage:true,animations:'disabled'});await picker.getByRole('button',{name:/Alpha Coffee/}).click();await expect(page.getByRole('heading',{name:'Alpha Coffee',exact:true})).toBeVisible();await expect(page.locator('.feature[aria-pressed=true]')).toContainText('Alpha Coffee');
 await page.keyboard.press('Escape');await beta.focus();await page.keyboard.press('Enter');await expect(picker).toBeVisible();await picker.getByRole('button',{name:/Beta Coffee/}).press('Enter');await expect(page.getByRole('heading',{name:'Beta Coffee',exact:true})).toBeVisible();expect(requests()).toBe(1);
});
test('map navigation and list selection keep the analysis scope unchanged',async({page})=>{
 const requests=await explorationFixture(page);const scope=(await page.locator('.map-caption').textContent())!;
 await page.getByRole('button',{name:'Fit results'}).click();await page.getByRole('button',{name:'Recenter'}).click();
 await page.locator('.leaflet-container').focus();for(let i=0;i<8;i++)await page.keyboard.press('ArrowRight');
 await page.locator('.feature').filter({hasText:'Far Coffee'}).click();await expect(page.getByRole('heading',{name:'Far Coffee',exact:true})).toBeVisible();
 await expect.poll(async()=>{const marker=await page.locator('.competitor-marker[data-source-id="node/203"]').boundingBox(),map=await page.locator('.map-canvas').boundingBox(),detail=await page.getByRole('region',{name:'Competitor details',exact:true}).boundingBox();return !!(marker&&map&&detail&&marker.x>=map.x&&marker.x+marker.width<detail.x&&marker.y>=map.y&&marker.y+marker.height<map.y+map.height);}).toBe(true);
 await page.getByRole('button',{name:'Recenter'}).click();await expect(page.getByRole('region',{name:'Competitor details',exact:true})).toHaveCount(0);await expect(page.locator('.map-caption')).toHaveText(scope);expect(requests()).toBe(1);
});
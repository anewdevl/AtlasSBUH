import {test,expect} from '@playwright/test';
import {result} from '../fixtures';
for(const sameCity of [false,true])test(`second comparison selection preserves the first pin (${sameCity?'same city, different center':'different cities'})`,async({page})=>{
 await page.route('https://tile.openstreetmap.org/**',r=>r.abort());
 await page.route('**/api/suggest',r=>r.fulfill({json:{categoryId:'cafe',explanation:'Synthetic mapping.'}}));
 await page.route('**/api/analyze',r=>{
  const request=r.request().postDataJSON(),count=request.scope.cityId==='nyc'&&request.scope.center.lat===40.7308?1:2;
  return r.fulfill({json:result(Array.from({length:count},(_,i)=>({type:'node',id:123+i,...request.scope.center,tags:{amenity:'cafe',name:`Synthetic fixture ${i}`}})),request)});
 });
 await page.goto('/');await page.getByLabel('What are you opening?').fill('Coffee shop');await page.getByRole('button',{name:'Analyze this area'}).click();await expect(page.locator('.metrics strong').first()).toHaveText('1');
 await page.getByRole('button',{name:'Pin for comparison',exact:true}).click();const comparison=page.getByLabel('Area comparison');await expect(comparison).toContainText('Your first area is pinned.');await expect(comparison.locator('.compare-grid')).toHaveCount(0);
 await page.getByRole('button',{name:'Search',exact:true}).click();
 if(sameCity){await page.getByText('Advanced settings',{exact:true}).click();await page.getByLabel('Latitude',{exact:true}).fill('40.7408');}else await page.getByLabel('City preset').selectOption('london');
 await page.getByRole('button',{name:'Analyze this area'}).click();await expect(page.locator('.metrics strong').first()).toHaveText('2');
 await page.getByRole('button',{name:'Compare with pinned area',exact:true}).click();const cards=comparison.locator('.compare-grid>div');await expect(cards).toHaveCount(2);
 await expect(cards.nth(0)).toContainText('New York');await expect(cards.nth(0)).toContainText('40.7308, -73.9973');await expect(comparison.locator('.compare-row').first().locator('strong').nth(0)).toHaveText('1');await expect(comparison.locator('.compare-row').first().locator('strong').nth(1)).toHaveText('2');await expect(cards.nth(1)).toContainText(sameCity?'40.7408, -73.9973':'London');
 // Repeated clicks on the second result must not change the baseline either.
 await page.getByRole('button',{name:/^Competitors/}).click();await page.getByRole('button',{name:'Compare with pinned area',exact:true}).click();await expect(comparison.locator('.compare-row').first().locator('strong').nth(0)).toHaveText('1');await expect(comparison.locator('.compare-row').first().locator('strong').nth(1)).toHaveText('2');
 await page.getByRole('button',{name:'Clear pin',exact:true}).click();await expect(page.getByText('Two areas. Equal terms.')).toBeVisible();await page.getByRole('button',{name:/^Competitors/}).click();await page.getByRole('button',{name:'Pin for comparison',exact:true}).click();await expect(comparison).toContainText(sameCity?'40.7408':'London');await expect(comparison.locator('.compare-grid')).toHaveCount(0);
});

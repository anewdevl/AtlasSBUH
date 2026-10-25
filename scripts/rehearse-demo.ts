import {chromium,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
async function main(){
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  await mkdir('.atlas-local',{recursive:true});
  await page.goto('http://127.0.0.1:3000/');
  await page.getByLabel('Find a location',{exact:true}).fill('Washington Square Park');
  const lookup=page.waitForResponse(r=>r.url().includes('/api/locations?'));
  await page.getByRole('button',{name:'Search locations'}).click();
  const response=await lookup;const places=await response.json();
  console.log(JSON.stringify({step:'live address lookup',status:response.status(),results:places.results?.length??0}));
  if(response.ok()&&places.results?.length){await page.getByRole('button',{name:places.results[0].label,exact:true}).click();await expect(page.getByRole('region',{name:'Analysis settings'}).locator('.selected-location')).toContainText(places.results[0].label);}
  await page.getByLabel('City preset').selectOption('london');await page.getByLabel('City preset').selectOption('nyc');
  await page.getByLabel('What are you opening?').fill('A neighborhood supermarket');
  await page.getByRole('button',{name:'Analyze this area'}).click();
  await expect(page.getByRole('heading',{name:'Supermarket · New York'})).toBeVisible({timeout:60000});
  console.log(JSON.stringify({step:'NYC supermarket',metrics:await page.locator('.metrics').innerText()}));
  await page.getByRole('button',{name:'Save in this browser'}).click();
  if(await page.locator('.feature').count()){await page.locator('.feature').first().click();await expect(page.getByRole('region',{name:'Competitor details',exact:true})).toBeVisible();await page.screenshot({path:'.atlas-local/demo-competitor.png'});await page.getByRole('button',{name:'Close competitor details'}).click();}
  await page.getByRole('button',{name:'Pin for comparison'}).click();await page.getByRole('button',{name:'Search',exact:true}).click();await page.getByLabel('City preset').selectOption('london');await page.getByRole('button',{name:'Analyze this area'}).click();await expect(page.getByRole('heading',{name:'Supermarket · London'})).toBeVisible({timeout:60000});
  await page.getByRole('navigation',{name:'Explorer views'}).getByRole('button',{name:/^Compare/}).click();await expect(page.getByLabel('Area comparison')).toContainText('CURRENT AREA');await page.screenshot({path:'.atlas-local/demo-comparison.png'});
  console.log(JSON.stringify({step:'live comparison',passed:true}));
 }finally{await browser.close();}
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Demo rehearsal failed.');process.exitCode=1;});


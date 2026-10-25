import { classify } from '../../src/lib/classify';
import { test, expect } from '@playwright/test';
import { shortlistBusinesses } from '../../src/lib/business-shortlist';
import { stages } from '../../src/lib/research-contracts';
import { result } from '../fixtures';

test.beforeEach(async({page})=>{await page.route('**/api/suggest',route=>{const matches=classify(route.request().postDataJSON().description).matches;return route.fulfill({json:{categoryId:matches.length===1?matches[0]:null,explanation:'Synthetic classification fixture.'}});});});

test('location search moves the center and recenter restores its viewport position', async ({ page }) => {
  await page.route('https://tile.openstreetmap.org/**', route => route.abort());
  await page.route('**/api/locations?**', route => route.fulfill({ json: { results: [{ id: 'fixture-park', label: 'Washington Square Park, New York', coordinates: { lat: 40.731, lon: -73.997 } }] } }));
  await page.goto('/'); await page.getByLabel('Find a location', { exact: true }).fill('Washington Square');
  await page.getByRole('button', { name: 'Search locations' }).click();
  await page.getByRole('button', { name: 'Washington Square Park, New York', exact: true }).click();
  await expect(page.locator('.map-caption')).toContainText('40.7310, -73.9970');
  const map = page.locator('.map-canvas'); await map.focus(); for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
  await page.getByRole('button', { name: 'Recenter' }).click();
  await expect.poll(async () => {
    const area = await map.boundingBox(), center = await page.locator('.search-center-marker').boundingBox();
    return area && center ? Math.hypot(center.x + center.width / 2 - area.x - area.width / 2, center.y + center.height / 2 - area.y - area.height / 2) : 999;
  }).toBeLessThan(3);
  await expect(page.locator('.map-caption')).toContainText('40.7310, -73.9970');
});

test('research presents the local shortlist when web evidence is unavailable', async ({ page }) => {
  await page.route('https://tile.openstreetmap.org/**', route => route.abort());
  await page.route('**/api/research', async route => {
    const request = route.request().postDataJSON(); expect(request.localOnly).toBe(true);
    const mapped = result(undefined, request.osmRequest);
    const report = { request, status: 'partial', startedAt: new Date().toISOString(), evidence: [], findings: [], insights: [], shortlist: shortlistBusinesses(mapped, request.description), stages: stages.map(stage => ({ stage, status: 'partial', message: 'Web evidence unavailable; mapped candidates retained.' })), warnings: [], unknowns: [] };
    await route.fulfill({ contentType: 'application/x-ndjson', body: JSON.stringify({ type: 'report', report }) + '\n' });
  });
  await page.goto('/'); await page.getByRole('button', { name: 'Research', exact: true }).click();
  await page.getByLabel('Business description', { exact: true }).fill('Coffee shop'); await page.getByRole('button', { name: 'Generate insights' }).click();
  const shortlist = page.getByRole('region', { name: 'Ranked local shortlist' });
  await expect(shortlist).toContainText('Synthetic test café'); await expect(shortlist).toContainText('Category, specialty text and distance ordering');
  await expect(shortlist.getByRole('link', { name: 'Map evidence' })).toHaveAttribute('href', 'https://www.openstreetmap.org/node/123');
  await page.screenshot({ path: 'test-results/local-shortlist.png' });
});

// Synthetic upstream data only; no paid provider calls.
test('specialty research does not present broad clothing shops as confident desi competitors', async ({page})=>{
  await page.route('https://tile.openstreetmap.org/**',route=>route.abort());
  await page.route('**/api/research',async route=>{
    const request=route.request().postDataJSON(); expect(request.description).toBe('desi clothing store'); expect(request.osmRequest.categoryId).toBe('clothing');
    const mapped=result([{type:'node',id:12,lat:40.7308,lon:-73.9973,tags:{shop:'clothes',name:'Synthetic Generic Boutique'}}],request.osmRequest);
    await route.fulfill({contentType:'application/x-ndjson',body:JSON.stringify({type:'report',report:{request,status:'partial',startedAt:new Date().toISOString(),evidence:[],findings:[],insights:[],shortlist:shortlistBusinesses(mapped,request.description),stages:stages.map(stage=>({stage,status:'partial',message:'Synthetic bounded result.'})),warnings:[],unknowns:[]}})+'\n'});
  });
  await page.goto('/');await page.getByRole('button',{name:'Research',exact:true}).click();
  await page.getByLabel('Business description',{exact:true}).fill('desi clothing store');await page.getByRole('button',{name:'Generate insights'}).click();
  const report=page.getByLabel('Research report',{exact:true});await expect(report).toContainText('Insufficient evidence');
  const shortlist=page.getByRole('region',{name:'Ranked local shortlist'});await expect(shortlist).toContainText('specialty requirements (desi) remain unverified');await expect(shortlist).not.toContainText('/100');await expect(shortlist).toContainText('No specialty evidence');
});

test('Research offers optional Google context without replacing its report or opening a browser tab',async({page,context})=>{
 let lookups=0;
 await page.route('https://tile.openstreetmap.org/**',r=>r.abort());
 await page.route('**/api/places',r=>{lookups++;return r.fulfill({status:429,json:{code:'DEMO_QUOTA',message:'Google demo quota unavailable. Research remains available.'}});});
 await page.route('**/api/research',async route=>{
  const request=route.request().postDataJSON(),mapped=result(undefined,request.osmRequest);
  await route.fulfill({contentType:'application/x-ndjson',body:JSON.stringify({type:'report',report:{request,status:'partial',startedAt:new Date().toISOString(),evidence:[],findings:[],insights:[],shortlist:shortlistBusinesses(mapped,request.description),stages:stages.map(stage=>({stage,status:'partial',message:'Synthetic bounded report.'})),warnings:[],unknowns:[]}})+'\n'});
 });
 await page.goto('/');await page.getByRole('button',{name:'Research',exact:true}).click();await page.getByLabel('Business description',{exact:true}).fill('coffee shop');await page.getByRole('button',{name:'Generate insights'}).click();
 const report=page.getByLabel('Research report',{exact:true});await expect(report).toBeVisible();expect(lookups).toBe(0);
 await report.getByRole('button',{name:'Google details for Synthetic test café'}).click();
 const sheet=page.getByRole('dialog',{name:'Google listing context'});await expect(sheet.getByRole('alert')).toContainText('Research remains available');expect(lookups).toBe(1);expect(context.pages()).toHaveLength(1);
 await page.keyboard.press('Escape');await expect(sheet).toHaveCount(0);await expect(report).toBeVisible();await expect(report.getByRole('button',{name:'Download PDF'})).toBeEnabled();expect(lookups).toBe(1);
});

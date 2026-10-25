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
  await expect(shortlist).toContainText('Synthetic test café'); await expect(shortlist).toContainText('80% relevance / 20% proximity');
  await expect(shortlist.getByRole('link', { name: 'Map evidence' })).toHaveAttribute('href', 'https://www.openstreetmap.org/node/123');
  await page.screenshot({ path: 'test-results/local-shortlist.png' });
});

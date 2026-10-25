import { test, expect } from '@playwright/test';
import { normalize } from '../../src/server/normalize';
import { buildQuery, hashQuery } from '../../src/server/overpass';

test.beforeEach(async ({ page }) => {
  await page.route('https://tile.openstreetmap.org/**', route => route.abort());
  await page.route('**/api/analyze', async route => {
    const request = route.request().postDataJSON(), { lat, lon } = request.scope.center;
    await route.fulfill({ json: normalize(request, { elements: [
      { type: 'node', id: 301, lat, lon, tags: { amenity: 'cafe', name: 'Detail Coffee', 'addr:housenumber': '12', 'addr:street': 'Bleecker St', website: 'https://detail.example/menu', opening_hours: 'Mo-Su 07:00-19:00', phone: '+1 212 555 0100', takeaway: 'yes' } },
      { type: 'node', id: 302, lat: lat + 0.001, lon, tags: { amenity: 'cafe', name: 'Detail Coffee' } },
      { type: 'node', id: 303, lat: lat + 0.005, lon, tags: { amenity: 'cafe', name: 'Plain Cafe', website: 'javascript:alert(1)' } },
    ], fetchedAt: new Date().toISOString(), osmBaseTimestamp: null, queryHash: hashQuery(buildQuery(request)) }) });
  });
});

test('detail card shows rank, neighbors, and mapped facts', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Analyze this area' }).click();
  await page.locator('.feature').filter({ hasText: 'Detail Coffee' }).first().click();
  const card = page.getByRole('region', { name: 'Competitor details', exact: true });
  await expect(card.getByRole('heading', { name: 'Detail Coffee', exact: true })).toBeVisible();
  await expect(card.getByLabel('How this business compares')).toContainText('#1');
  await expect(card.getByLabel('How this business compares')).toContainText('Rivals next door');
  await expect(card).toContainText('12 Bleecker St');
  await expect(card).toContainText('Mo-Su 07:00-19:00');
  await expect(card.getByRole('link', { name: /detail\.example/ })).toHaveAttribute('href', 'https://detail.example/menu');
  await expect(card).toContainText('Closest rival: Detail Coffee');
});

test('a business without details says so and unsafe links are never rendered', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Analyze this area' }).click();
  await page.locator('.feature').filter({ hasText: 'Plain Cafe' }).click();
  const card = page.getByRole('region', { name: 'Competitor details', exact: true });
  await expect(card).toContainText('No address, hours, or website is recorded');
  await expect(card.locator('a[href^="javascript"]')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(card).toHaveCount(0);
});
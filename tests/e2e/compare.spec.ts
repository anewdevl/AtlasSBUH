import { test, expect } from '@playwright/test';
import { normalize } from '../../src/server/normalize';
import { buildQuery, hashQuery } from '../../src/server/overpass';

let call = 0;
test.beforeEach(async ({ page }) => {
  call = 0;
  await page.route('https://tile.openstreetmap.org/**', route => route.abort());
  await page.route('**/api/analyze', async route => {
    const request = route.request().postDataJSON(), { lat, lon } = request.scope.center;
    call++;
    const many = call === 1;
    const elements = many
      ? [1, 2, 3, 4].map(i => ({ type: 'node', id: i, lat: lat + i * 0.0005, lon, tags: { amenity: 'cafe', name: i < 3 ? 'Twin Coffee' : `Solo ${i}` } }))
      : [{ type: 'node', id: 9, lat, lon, tags: { amenity: 'cafe', name: 'Only One' } }];
    await route.fulfill({ json: normalize(request, { elements, fetchedAt: new Date().toISOString(), osmBaseTimestamp: null, queryHash: hashQuery(buildQuery(request)) }) });
  });
});

test('first screen explains the steps and disappears after analysis', async ({ page }) => {
  await page.goto('/');
  const welcome = page.locator('.map-welcome-card');
  await expect(welcome).toContainText('See who you are up against');
  await welcome.getByRole('button', { name: /Show competitors/ }).click();
  await expect(page.locator('.feature').first()).toBeVisible();
  await expect(welcome).toHaveCount(0);
});

test('compare shows bars, neutral wording, and repeated names', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Analyze this area' }).click();
  await page.getByRole('button', { name: 'Pin for comparison' }).click();
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByRole('button', { name: 'Analyze this area' }).click();
  await page.getByRole('button', { name: /^Compare/ }).click();
  const panel = page.getByLabel('Area comparison');
  await expect(panel).toContainText('CURRENT AREA');
  await expect(panel).toContainText('PINNED AREA');
  await expect(panel.locator('.compare-row')).toHaveCount(4);
  await expect(panel).toContainText('fewer direct competitors per km² than the pinned area');
  await expect(panel).toContainText('Twin Coffee (2)');
  await expect(panel).toContainText('do not recommend a winner');
});

test('the first-screen hint stays gone after an AI suggestion or any change', async ({ page }) => {
  await page.route('**/api/suggest', route => route.fulfill({ json: { categoryId: 'bakery', explanation: 'A bakery maps to the bakery type.' } }));
  await page.goto('/');
  await expect(page.locator('.map-welcome-card')).toBeVisible();
  await page.getByLabel('What are you opening?').fill('A small neighborhood bakery');
  await page.getByRole('button', { name: 'Suggest with AI' }).click();
  await expect(page.getByLabel('Confirmed category')).toHaveValue('bakery');
  await expect(page.locator('.map-welcome-card')).toHaveCount(0);
  await page.getByLabel('Confirmed category').selectOption('cafe');
  await expect(page.locator('.map-welcome-card')).toHaveCount(0);
});

test('the first-screen hint can be dismissed', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Dismiss tips' }).click();
  await expect(page.locator('.map-welcome-card')).toHaveCount(0);
});
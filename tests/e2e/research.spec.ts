import { classify } from '../../src/lib/classify';
import { test, expect } from '@playwright/test';
import { stages, type ResearchRequest } from '../../src/lib/research-contracts';

test.beforeEach(async({page})=>{await page.route('**/api/suggest',route=>{const matches=classify(route.request().postDataJSON().description).matches;return route.fulfill({json:{categoryId:matches.length===1?matches[0]:null,explanation:'Synthetic classification fixture.'}});});});

test('research-only software flow exposes sources and clears when scope changes', async ({ page }) => {
  await page.route('https://tile.openstreetmap.org/**', route => route.abort());
  await page.route('**/api/research', async route => {
    const request = route.request().postDataJSON() as ResearchRequest;
    const report = { request, status: 'partial', startedAt: new Date().toISOString(),
      evidence: [{ id: 'web-test', provider: 'tavily', url: 'https://fixture.example/software', title: 'Synthetic software source', retrievedAt: new Date().toISOString(), excerpt: 'Synthetic software company offers analytics in New York.', contentKind: 'page', placeId: null, coordinates: null }],
      findings: [{ id: 'f-test', claim: 'The source describes analytics software.', kind: 'offering', business: 'Synthetic software company', relation: 'direct', evidence: [{ sourceId: 'web-test', quote: 'Synthetic software company offers analytics in New York.' }], geographicRelevance: 'New York; precise location unverified.', limitations: ['One source only.'], reviewSampleSize: null, reviewDates: null }],
      insights: [], agentRuns: [{ role: 'writer', task: 'report preparation', model: 'nvidia/nemotron-3.5-lightning-30b-a3b', status: 'complete', durationMs: 1200, tools: ['order_verified_records'] }], stages: stages.map(stage => ({ stage, status: stage === 'maps' ? 'unavailable' : 'complete', message: stage === 'maps' ? 'Maps unavailable.' : `${stage} processed.` })), warnings: ['Maps unavailable.'], unknowns: ['No representative review sample.'] };
    await route.fulfill({ contentType: 'application/x-ndjson', body: [{ type: 'stage', stage: { stage: 'web', status: 'running', message: 'Researching competitors and customer feedback.' } }, { type: 'report', report }].map(e => JSON.stringify(e)).join('\n') + '\n' });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Research', exact: true }).click();
  await page.getByLabel('Business description', { exact: true }).fill('Software company offering analytics');
  await page.getByRole('button', { name: 'Generate insights' }).click();
  const report = page.getByLabel('Research report', { exact: true });
  await expect(report.getByRole('heading', { name: 'Research report · partial' })).toBeVisible();
  await expect(report.getByText('The source describes analytics software.', { exact: false })).toBeVisible();
  await report.getByText('Agent activity', { exact: true }).click();
  await expect(report.getByText('Model: nvidia/nemotron-3.5-lightning-30b-a3b.', { exact: false })).toBeVisible();
  await page.getByText('Synthetic software source · tavily').click();
  await expect(report.getByRole('link', { name: 'Synthetic software source', exact: true })).toHaveAttribute('href', 'https://fixture.example/software');
  await expect(page.getByLabel('Analysis results')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/research-dark.png', animations: 'disabled' });
  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await expect(page.locator('.app-shell')).toHaveAttribute('data-theme', 'light');
  await expect(report.getByRole('heading', { name: 'Research report · partial' })).toBeVisible();
  await page.screenshot({ path: 'test-results/research-light.png', animations: 'disabled' });
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByLabel('City preset').selectOption('london');
  await page.getByRole('button', { name: 'Research', exact: true }).click();
  await expect(report).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('research errors are visible and do not disable OSM analysis controls', async ({ page }) => {
  await page.route('https://tile.openstreetmap.org/**', route => route.abort());
  await page.route('**/api/research', route => route.fulfill({ status: 429, json: { error: 'Research capacity reached. Try again shortly.' } }));
  await page.goto('/'); await page.getByRole('button', { name: 'Research', exact: true }).click(); await page.getByLabel('Business description', { exact: true }).fill('Specialty coffee shop');
  await page.getByRole('button', { name: 'Generate insights' }).click();
  await expect(page.getByRole('region', { name: 'Business research' }).getByRole('alert')).toContainText('Research capacity reached');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Analyze this area' })).toBeEnabled();
});

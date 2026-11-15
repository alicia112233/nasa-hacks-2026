import { test, expect } from '@playwright/test';

test('mission view covers all 17 NASA risks with working region links and real NASA ISS data', async ({ page }) => {
  await page.goto('/#mission');
  const rows = page.getByRole('region', { name: 'Risk coverage table' }).locator('tbody tr');
  await expect(rows).toHaveCount(17);
  const hrefs = await rows.locator('th a').evaluateAll(links => links.map(a => (a as HTMLAnchorElement).href));
  expect(hrefs.every(h => h.startsWith('https://www.nasa.gov/reference/risk-'))).toBe(true);
  await expect(page.getByText('0.227', { exact: true })).toBeVisible();
  await expect(page.getByText('mGy over 43 days')).toBeVisible();
  await expect(page.getByText('3,659', { exact: true })).toBeVisible();
  await expect(page.getByText(/sha256 [0-9a-f]{12}/)).toBeVisible();
  await rows.filter({ hasText: 'Neuro-ocular syndrome' }).getByRole('button', { name: 'B Eyes' }).click();
  await expect(page).toHaveURL(/#body$/);
  await expect(page.getByRole('heading', { name: 'Eyes', level: 2 })).toBeVisible();
});

test('personal records never use the demo ghost, and clearing needs a confirmation', async ({ page }) => {
  await page.goto('/#mission');
  await page.getByRole('button', { name: 'My records' }).click();
  // The built-in records are never labelled in the top bar.
  await expect(page.getByRole('button', { name: 'Demo data' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Body' }).click();
  await expect(page.locator('.region-list .flag')).toHaveCount(0);
  await expect(page.getByText('Response 18% slower')).toHaveCount(0);
  await page.getByRole('link', { name: 'Mission' }).click();
  await page.getByRole('button', { name: 'Clear personal records' }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: 'Built-in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Demo data' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Body' }).click();
  await expect(page.locator('.region-list .flag').first()).toBeVisible();
});

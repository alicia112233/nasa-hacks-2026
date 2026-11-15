import { test, expect } from '@playwright/test';

test('Risks covers all 17 NASA risks with working region links; Cabin shows the NASA ISS record; Sources names it', async ({ page }) => {
  await page.goto('/#risks');
  const rows = page.getByRole('table', { name: 'Risk coverage table' }).locator('tbody tr');
  await expect(rows).toHaveCount(17);
  const hrefs = await rows.locator('th a').evaluateAll(links => links.map(a => (a as HTMLAnchorElement).href));
  expect(hrefs.every(h => h.startsWith('https://www.nasa.gov/reference/risk-'))).toBe(true);
  await rows.filter({ hasText: 'Neuro-ocular syndrome' }).getByRole('button', { name: 'B Eyes' }).click();
  await expect(page).toHaveURL(/#body$/);
  await expect(page.getByRole('heading', { name: 'Eyes', level: 2 })).toBeVisible();
  await page.getByRole('button', { name: /^I Cabin/ }).click();
  await expect(page.getByText('0.227', { exact: true })).toBeVisible();
  await expect(page.getByText('mGy over 43 days')).toBeVisible();
  await expect(page.getByText('3,659', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Sources', exact: true }).click();
  await expect(page.getByText(/sha256 [0-9a-f]{12}/)).toBeVisible();
});

test('one stream of records: a new member starts empty, and deleting everything asks first and restores the sample crew', async ({ page }) => {
  await page.goto('/#body');
  await expect(page.getByRole('button', { name: 'Demo data' })).toHaveCount(0);
  // Sample members come with history; a member you add starts with nothing to flag.
  await expect(page.locator('.region-list .flag').first()).toBeVisible();
  await page.locator('.crew-switch-btn').click();
  await page.getByRole('button', { name: 'Add crew member', exact: true }).click();
  await page.getByRole('dialog', { name: 'Edit profile' }).getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.locator('.region-list .flag')).toHaveCount(0);
  await page.getByRole('link', { name: 'Sources' }).click();
  await expect(page.getByRole('button', { name: 'My records' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Delete all records' }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: 'Delete all records' }).click();
  await page.getByRole('button', { name: 'Delete everything' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'All records deleted. Sample crew restored.' })).toBeVisible();
  await page.locator('.crew-switch-btn').click();
  await expect(page.getByRole('list', { name: 'Crew' }).getByRole('button')).toHaveCount(4);
});

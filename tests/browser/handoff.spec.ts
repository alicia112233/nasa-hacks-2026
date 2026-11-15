import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fillCarePlan, openSection } from './care-helpers';

test('blackout handoff persists, downloads the body index and never claims transmission', async ({ page }) => {
  await page.goto('/#report');
  await openSection(page, 'details.report-link');
  await page.getByLabel('Blackout drill').check();
  await expect(page.locator('details.report-link summary')).toHaveText('Link · blackout drill');
  await page.getByLabel('Note for the medical team').fill('Vision blur since sol 41.');
  await fillCarePlan(page);
  await page.getByRole('button', { name: 'Hand off today’s report' }).click();
  await expect(page.locator('.handoff-done')).toContainText('Handed off at');
  await expect(page.getByRole('button', { name: 'Hand off again' })).toBeVisible();
  await expect(page.getByText(/Saved on this device · blackout drill/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Saved on this device · blackout drill/)).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Download Sol \d+ handoff/ }).click()]);
  const packet = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(packet.communication).toMatchObject({ blackoutDrill: true, transmitted: false });
  expect(packet.context).toBe('Vision blur since sol 41.');
  expect(packet.analysis.bodyIndex).toHaveLength(9);
  expect(packet.analysis.bodyIndex.find((r: { region: string }) => r.region === 'Eyes').state).toBe('flag');
  await expect(page.locator('.care-thread-head small')).toHaveText('Downloaded · blackout drill');
});

test('ground reports carry the body index, instrument gaps and NASA sources', async ({ page }) => {
  await page.goto('/#report');
  const [md] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Markdown' }).click()]);
  const text = await readFile((await md.path())!, 'utf8');
  expect(text).toContain('## Body index');
  expect(text).toContain('A · Head — flag');
  expect(text).toContain('Bone density (DXA): not measured (Needs scanner)');
  expect(text).toContain('Not transmitted');
  expect(text).toContain('https://www.nasa.gov/hrp/hazards/');
  const [json] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'JSON' }).click()]);
  const report = JSON.parse(await readFile((await json.path())!, 'utf8'));
  expect(report).toMatchObject({ source: 'recorded', transmitted: false });
  expect(report.notMeasurableOnboard).toEqual(['Radiation-induced cancer']);
});

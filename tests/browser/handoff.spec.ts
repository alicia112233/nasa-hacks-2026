import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('blackout handoff persists, downloads the body index and never claims transmission', async ({ page }) => {
  await page.goto('/#handoff');
  await page.getByLabel('Blackout drill').check();
  await expect(page.getByText('No ground link. Handoffs queue on board.')).toBeVisible();
  await page.getByLabel('Note for the surgeon').fill('Vision blur since sol 41.');
  await page.getByRole('button', { name: 'Save handoff' }).click();
  await expect(page.getByText(/Queued · not sent · blackout/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Queued · not sent · blackout/)).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Download Sol \d+ handoff/ }).click()]);
  const packet = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(packet.communication).toMatchObject({ blackoutDrill: true, transmitted: false });
  expect(packet.context).toBe('Vision blur since sol 41.');
  expect(packet.analysis.bodyIndex).toHaveLength(9);
  expect(packet.analysis.bodyIndex.find((r: { region: string }) => r.region === 'Eyes').state).toBe('reported');
  await expect(page.getByText(/Downloaded · not sent/)).toBeVisible();
});

test('ground reports carry the body index, instrument gaps and NASA sources', async ({ page }) => {
  await page.goto('/#handoff');
  const [md] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Markdown' }).click()]);
  const text = await readFile((await md.path())!, 'utf8');
  expect(text).toContain('## Body index');
  expect(text).toContain('A · Head — flag');
  expect(text).toContain('Bone density (DXA): not measured (Needs scanner)');
  expect(text).toContain('Not transmitted');
  expect(text).toContain('https://www.nasa.gov/hrp/hazards/');
  const [json] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'JSON' }).click()]);
  const report = JSON.parse(await readFile((await json.path())!, 'utf8'));
  expect(report).toMatchObject({ source: 'simulated', transmitted: false });
  expect(report.notMeasurableOnboard).toEqual(['Radiation-induced cancer']);
});

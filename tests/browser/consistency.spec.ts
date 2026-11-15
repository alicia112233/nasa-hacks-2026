import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fillCarePlan } from './care-helpers';

test('a sleep-only check-in keeps attention and shoulder comparisons consistent across views', async ({ page }) => {
  await page.goto('/#body');
  await page.getByRole('button', { name: /Sleep quality/ }).click();
  await page.getByRole('group', { name: 'Sleep quality', exact: true }).getByRole('button', { name: /Good/ }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Response 18% slower than your ghost' })).toBeVisible();
  await page.getByRole('link', { name: 'Trends', exact: true }).click();
  const attention = page.getByRole('row', { name: /^Attention/ });
  await expect(attention).toContainText('369 ms');
  await expect(attention).toContainText('+18%');
  const shoulder = page.getByRole('row', { name: /^L shoulder/ });
  await expect(shoulder).toContainText('134°');
  await expect(shoulder).toContainText('-12%');
});

test('a handoff draft never follows a crew switch into another member’s saved packet', async ({ page }) => {
  await page.goto('/#handoff');
  await page.getByLabel('Observation for medical team').fill('Alex only: shoulder discomfort.');
  await page.locator('.crew-switch-btn').click();
  await page.getByRole('list', { name: 'Crew' }).getByRole('button', { name: /Jordan Lee/ }).click();
  await expect(page.getByLabel('Observation for medical team')).toHaveValue('');
  await page.getByLabel('Observation for medical team').fill('Jordan only: repeat leg outline.');
  await fillCarePlan(page);
  await page.getByRole('button', { name: 'Save handoff', exact: true }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'), page.getByRole('button', { name: /Download Sol \d+ handoff/ }).click(),
  ]);
  const packet = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(packet.crew).toBe('Jordan Lee');
  expect(packet.context).toBe('Jordan only: repeat leg outline.');
  expect(packet.context).not.toContain('Alex');
});

test('a region summary carried to handoff stays with its original crew member', async ({ page }) => {
  await page.goto('/#body');
  await page.getByRole('list', { name: 'Body regions' }).getByRole('button', { name: /^B Eyes/ }).click();
  await page.getByRole('button', { name: 'Begin', exact: true }).click();
  await page.getByRole('group', { name: 'Blurred or changed vision' }).getByRole('button', { name: 'None', exact: true }).click();
  await page.getByRole('status', { name: 'Eyes complete' }).getByRole('button', { name: 'Hand off', exact: true }).click();
  await expect(page.getByLabel('Observation for medical team')).toHaveValue(/^B Eyes: 1 of 1 checks done today\./);
  await page.locator('.crew-switch-btn').click();
  await page.getByRole('list', { name: 'Crew' }).getByRole('button', { name: /Jordan Lee/ }).click();
  await expect(page.getByLabel('Observation for medical team')).toHaveValue('');
});

import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { freshMember } from './crew-helpers';

async function openCheck(page: Page, name: RegExp) {
  const button = page.locator('.steps').getByRole('button', { name });
  if (await button.getAttribute('aria-expanded') !== 'true') await button.click();
}

test('structured readings retain fractions, paired values, units, time and method across reload and export', async ({ page }) => {
  await freshMember(page);
  await page.getByRole('list', { name: 'Body regions' }).getByRole('button', { name: /^A Head/ }).click();
  await openCheck(page, /Sleep duration/);
  const sleep = page.getByRole('form', { name: 'Record sleep duration' });
  await sleep.getByRole('spinbutton').fill('7.25');
  await sleep.getByRole('combobox', { name: 'Method', exact: true }).selectOption('Sleep watch');
  const at = new Date(Date.now() + 8 * 3600000 - 15 * 60000).toISOString().slice(0, 16);
  await sleep.getByLabel('Woke at').fill(at);
  await sleep.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.steps').getByRole('button', { name: /Sleep duration/ })).toContainText('7.25 h');

  await page.getByRole('list', { name: 'Body regions' }).getByRole('button', { name: /^C Chest/ }).click();
  await openCheck(page, /Body temperature/);
  const temperature = page.getByRole('form', { name: 'Record body temperature' });
  await temperature.getByRole('spinbutton').fill('38.2');
  await temperature.getByRole('combobox', { name: 'Method', exact: true }).selectOption('Ear');
  await temperature.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.note')).toContainText('Tell surgeon');
  await openCheck(page, /Blood pressure/);
  const bp = page.getByRole('form', { name: 'Record blood pressure' });
  await bp.getByLabel('Systolic', { exact: true }).fill('145');
  await bp.getByLabel('Diastolic', { exact: true }).fill('95');
  const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(audit.violations.map(v => v.id)).toEqual([]);
  await bp.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.steps').getByRole('button', { name: /Blood pressure/ })).toContainText('145/95 mmHg');

  await page.reload();
  await page.getByRole('link', { name: 'Report', exact: true }).click();
  await expect(page.locator('.report-table')).toContainText('7.25 h');
  await expect(page.locator('.report-table')).toContainText('38.2 °C');
  await expect(page.locator('.report-table')).toContainText('145/95 mmHg');
  await expect(page.locator('.report-attention li').filter({ hasText: 'Body temperature' })).toContainText('Tell surgeon');
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'JSON', exact: true }).click();
  const download = await downloading;
  const data = JSON.parse(await readFile((await download.path())!, 'utf8'));
  const sleepReading = data.checkIns.find((r: any) => r.sleepHours === 7.25);
  expect(sleepReading.measurements.sleepHours).toMatchObject({ unit: 'h', method: 'Sleep watch' });
  expect(sleepReading.measurements.sleepHours.measuredAt ?? sleepReading.date).toBe(new Date(`${at}:00+08:00`).toISOString());
  const cuff = data.checkIns.find((r: any) => r.bpSys === 145);
  expect(cuff.bpDia).toBe(95);
  expect(cuff.measurements.bpSys).toMatchObject({ unit: 'mmHg', method: 'Automatic cuff' });
  expect(cuff.measurements.bpDia).toMatchObject({ unit: 'mmHg', method: 'Automatic cuff' });
  await page.getByRole('link', { name: 'Trends', exact: true }).click();
  await page.getByRole('button', { name: 'Temperature', exact: true }).click();
  await expect(page.locator('.comparison-note')).toContainText('Tell surgeon');
  await expect(page.locator('.comparison-note')).toContainText('38.2');
});

test('invalid cuff pairs are rejected, and unavailable equipment remains a gap after reload', async ({ page }) => {
  await freshMember(page);
  await page.getByRole('list', { name: 'Body regions' }).getByRole('button', { name: /^C Chest/ }).click();
  await openCheck(page, /Blood pressure/);
  const form = page.getByRole('form', { name: 'Record blood pressure' });
  await form.getByLabel('Systolic', { exact: true }).fill('120');
  await form.getByLabel('Diastolic', { exact: true }).fill('140');
  await form.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(form.getByRole('alert')).toContainText('Systolic must be higher');
  await form.getByRole('button', { name: 'No cuff today' }).click();
  await expect(page.locator('.steps').getByRole('button', { name: /Blood pressure/ })).toContainText('Set aside today');
  await page.reload();
  await page.getByRole('link', { name: 'Report', exact: true }).click();
  await expect(page.locator('#report-gaps + p')).toContainText('Blood pressure');
  await expect(page.locator('.report-sheet')).not.toContainText('120/140');
});

test('a rating change has the same reason on the body, trend and report, with no percentage for ratings', async ({ page }) => {
  await page.goto('/#body');
  await page.getByRole('list', { name: 'Body regions' }).getByRole('button', { name: /^A Head/ }).click();
  await expect(page.locator('.note')).toContainText('Mood down 1 point from your ghost (4/5 → 3/5).');
  await page.getByRole('link', { name: 'Trends', exact: true }).click();
  await page.getByRole('button', { name: 'Mood', exact: true }).click();
  await expect(page.locator('.comparison-note')).toContainText('Mood down 1 point from your ghost (4/5 → 3/5).');
  await expect(page.getByRole('row', { name: /^Mood/ })).toContainText('−1 pt');
  await page.getByRole('link', { name: 'Report', exact: true }).click();
  await expect(page.locator('.report-attention li').filter({ hasText: 'Mood' })).toContainText('Mood down 1 point from your ghost (4/5 → 3/5).');
});

import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { freshMember } from './crew-helpers';

async function makeShoulderUnreliable(page: Page) {
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open('ghostpilot-mission', 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    const state = await new Promise<any>((resolve, reject) => { const r = db.transaction('mission').objectStore('mission').get('state'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    const last = state.checkIns.filter((r: any) => r.crewId === state.crewId && typeof r.leftRange === 'number').at(-1);
    last.measurements.leftRange.quality = 'poor'; last.measurements.leftRange.confidentFrames = 4;
    await new Promise<void>((resolve, reject) => { const tx = db.transaction('mission', 'readwrite'); tx.objectStore('mission').put(state, 'state'); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); db.close();
  });
  await page.reload();
}

test('quality drives the next check and suppresses the affected trend without mixing sources', async ({ page }) => {
  await page.goto('/#body');
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
  await makeShoulderUnreliable(page);
  const daily = page.getByRole('region', { name: 'Today' });
  await expect(daily.locator('.today-next')).toContainText('4 confident frames');
  // Start opens the camera check straight away, over its region card.
  await daily.locator('.today-next').getByRole('button', { name: /^Start/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Arms', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Record 12 s' })).toBeVisible();
  await expect(page.locator('.card')).toContainText('Comparison unreliable');
  await page.getByRole('link', { name: 'Trends', exact: true }).click();
  await page.getByRole('button', { name: 'L shoulder', exact: true }).click();
  await expect(page.getByRole('row', { name: /L shoulder/ })).toContainText('Unreliable');
  await expect(page.getByRole('status').filter({ hasText: 'Comparison unreliable' })).toContainText('Recording too unclear');
});

test('shared headache reports lead to current cabin review while archived NASA data stays separate', async ({ page }) => {
  await page.goto('/#body');
  await expect(page.getByText('2 crew reported headaches in the last day.')).toBeVisible();
  await page.getByRole('button', { name: 'Check cabin', exact: true }).click();
  await expect(page.locator('.cabin-review')).toContainText('Latest cabin reading');
  await page.getByRole('button', { name: 'Air-quality steps' }).click();
  await expect(page.locator('.cabin-review')).toContainText('Use your mission’s approved air-quality procedure');
  await page.getByText('Log a cabin reading', { exact: true }).click();
  await page.getByLabel('CO₂ (ppm)', { exact: true }).fill('1250');
  await page.getByLabel('Observed at', { exact: true }).fill(new Date(Date.now() + 8 * 3600000 - 600000).toISOString().slice(0, 16));
  await page.getByLabel('Location / sensor').fill('Cabin A / sensor 3');
  await page.getByRole('button', { name: 'Save reading', exact: true }).click();
  await expect(page.locator('.cabin-current')).toContainText('1250 ppm CO₂');
  await expect(page.locator('.cabin-current')).toContainText('Cabin A / sensor 3');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/cabin-review.png', fullPage: true });
});

test('crew explicitly establish a fixed reference and a changed camera condition explains uncertainty', async ({ page }) => {
  await freshMember(page);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>(resolve => { const r = indexedDB.open('ghostpilot-mission', 1); r.onsuccess = () => resolve(r.result); });
    const state = await new Promise<any>(resolve => { const r = db.transaction('mission').objectStore('mission').get('state'); r.onsuccess = () => resolve(r.result); });
    const ctx = { phase: 'preflight', cameraSetup: 'Camera A', posture: 'Upright', lighting: 'Front lit', clothing: 'Fitted', activity: 'Rested' };
    state.profile.recordingContext = ctx; state.crew = state.crew.map((p: any) => p.id === state.crewId ? { ...p, recordingContext: ctx } : p);
    state.checkIns.push(...Array.from({ length: 6 }, (_, i) => {
      const date = new Date(Date.now() - (6 - i) * 86400000).toISOString();
      return { id: `personal-${i}`, crewId: state.crewId, simulated: false, date, sol: i + 1, reactionMs: null, signals: 0, missed: 0, symptoms: [], notes: '', thighCm: i < 3 ? 16 : 15,
        measurements: { thighCm: { ...ctx, cameraSetup: i < 3 ? 'Camera A' : 'Camera B', measuredAt: date, quality: 'good', confidentFrames: 20 } } };
    }));
    await new Promise<void>(resolve => { const tx = db.transaction('mission', 'readwrite'); tx.objectStore('mission').put(state, 'state'); tx.oncomplete = () => resolve(); }); db.close();
  });
  // Conditions & ghost lives on Trends, beside the comparisons it governs.
  await page.reload(); await page.getByRole('link', { name: 'Trends', exact: true }).click();
  const panel = page.locator('.reference-panel');
  await panel.locator('summary').click();
  await panel.getByLabel('Why set a new ghost?').fill('Preflight measurements reviewed for the demo');
  await panel.getByRole('button', { name: 'Set Preflight ghost', exact: true }).click();
  await expect(panel).toContainText('This phase already has a ghost.');
  await expect(panel.getByRole('button', { name: 'Set Preflight ghost', exact: true })).toBeDisabled();
  await page.getByRole('link', { name: 'Trends', exact: true }).click();
  await page.getByRole('button', { name: 'Thigh', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Comparison unreliable' })).toContainText('Conditions differ from your ghost');
  await expect(page.getByRole('row', { name: /^Thigh/ })).toContainText('Unreliable');
  await page.reload();
  await page.getByRole('link', { name: 'Trends', exact: true }).click(); await panel.locator('summary').click();
  await expect(panel).toContainText('Preflight measurements reviewed for the demo');
});

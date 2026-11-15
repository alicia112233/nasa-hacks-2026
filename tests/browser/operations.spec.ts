import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';

async function makeShoulderUnreliable(page: Page) {
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open('ghostpilot-mission', 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    const state = await new Promise<any>((resolve, reject) => { const r = db.transaction('mission').objectStore('mission').get('state'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    const last = state.checkIns.filter((r: any) => r.crewId === state.crewId && r.simulated).at(-1);
    last.measurements.leftRange.quality = 'poor'; last.measurements.leftRange.confidentFrames = 4;
    await new Promise<void>((resolve, reject) => { const tx = db.transaction('mission', 'readwrite'); tx.objectStore('mission').put(state, 'state'); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); db.close();
  });
  await page.reload();
}

test('emergency response runs offline without personal history, resumes and exports an honest versioned log', async ({ page, context }) => {
  test.setTimeout(90000);
  await page.goto('http://127.0.0.1:4173/#mission');
  await page.getByRole('button', { name: 'My records', exact: true }).click();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: 'Emergency', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Emergency response' });
  await expect(dialog).toContainText('Not clinician-reviewed');
  await expect(dialog.getByRole('heading', { name: 'Activate the onboard emergency response' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Response activated', exact: true }).click();
  await dialog.getByLabel('Observation or helper’s name').fill('Collapsed after reporting chest pain');
  await dialog.getByRole('button', { name: 'Unresponsive', exact: true }).click();
  await dialog.getByRole('button', { name: 'Not breathing normally', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Follow the mission resuscitation procedure now' })).toBeVisible();
  await page.screenshot({ path: 'test-results/emergency-response.png', fullPage: true });
  const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(audit.violations.map(v => v.id)).toEqual([]);
  await page.reload();
  await page.getByRole('button', { name: 'Resume emergency', exact: true }).click();
  await expect(dialog).toContainText('Collapsed after reporting chest pain');
  await dialog.getByRole('button', { name: 'Response underway', exact: true }).click();
  await dialog.getByRole('button', { name: 'No AED available', exact: true }).click();
  await dialog.getByRole('button', { name: 'No trained assistance present', exact: true }).click();
  await expect(dialog).toContainText('without waiting for equipment');
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download log' }).click();
  const file = await download; const packet = JSON.parse(await readFile((await file.path())!, 'utf8'));
  expect(packet.events).toHaveLength(6); expect(packet.transmitted).toBe(false); expect(packet.source).toBe('crew-entered observations');
  expect(packet.procedure.version).toBe('0.1.0'); expect(packet.procedure.review.clinician).toBe(null);
  expect(packet.events[1].note).toContain('chest pain');
  await dialog.getByRole('button', { name: 'Care transferred to medical lead' }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Report', exact: true }).click();
  await expect(page.getByText('Alex Morgan · Care transferred')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Review log' })).toBeVisible();
});

test('quality drives the next check and suppresses the affected trend without mixing sources', async ({ page }) => {
  await page.goto('/#body');
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
  await makeShoulderUnreliable(page);
  const daily = page.getByRole('region', { name: 'Today' });
  await expect(daily.locator('.today-next')).toContainText('4 confident frames');
  await daily.locator('.today-next').getByRole('button', { name: /^Start/ }).click();
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
  await expect(page.locator('.cabin-review')).toContainText('Use your mission’s approved procedure');
  await page.getByRole('link', { name: 'Mission', exact: true }).click();
  await page.getByRole('button', { name: 'My records', exact: true }).click();
  await page.getByRole('link', { name: 'Body', exact: true }).click();
  await page.getByRole('list', { name: 'Body regions' }).getByRole('button', { name: /^I Cabin/ }).click();
  await expect(page.locator('.cabin-review')).toContainText('No cabin reading logged');
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
  await page.goto('/#mission');
  await page.getByRole('button', { name: 'My records', exact: true }).click();
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

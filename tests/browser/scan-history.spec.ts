import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';

const holdout = JSON.parse(readFileSync('tests/fixtures/scan-holdout.json', 'utf8')).holdout;

async function mission(page: Page, change?: string) {
  return page.evaluate(async (change) => {
    const db = await new Promise<IDBDatabase>(resolve => { const r = indexedDB.open('ghostpilot-mission', 1); r.onsuccess = () => resolve(r.result); });
    const state = await new Promise<any>(resolve => { const r = db.transaction('mission').objectStore('mission').get('state'); r.onsuccess = () => resolve(r.result); });
    if (change) {
      new Function('state', change)(state);
      await new Promise<void>(resolve => { const tx = db.transaction('mission', 'readwrite'); tx.objectStore('mission').put(state, 'state'); tx.oncomplete = () => resolve(); });
    }
    db.close();
    return state;
  }, change);
}

test('scan history lists every scan, and deleting one asks first and reverts the figure', async ({ page }) => {
  await page.goto('/#body');
  await expect.poll(async () => !!(await mission(page))).toBe(true);
  const scans = [
    { ...holdout.holdout_f_heavier.scan, id: 's1', mode: 'setup', date: '2026-11-07T09:00:00.000Z', detected: { sex: 'female', build: 'average', sure: { sex: false, build: true } } },
    { ...holdout.holdout_f_heavier.scan, id: 's2', mode: 'legs', date: '2026-11-10T09:00:00.000Z' },
    { ...holdout.holdout_f_heavier.scan, id: 's3', mode: 'setup', date: '2026-11-14T09:00:00.000Z', detected: { sex: 'female', build: 'average', sure: { sex: false, build: true } } },
  ];
  await mission(page, `
    const scans = ${JSON.stringify(scans)};
    const patch = { sex: 'female', heightCm: 170, scans, scan: scans[2] };
    state.profile = { ...state.profile, ...patch };
    state.crew = state.crew.map(c => c.id === state.crewId ? { ...c, ...patch } : c);
    state.checkIns.push({ id: 'linked', crewId: state.crewId, simulated: false, date: scans[2].date, sol: 40, reactionMs: null, missed: 0, signals: 0, symptoms: [], notes: '', thighCm: 15.3,
      measurements: { thighCm: { phase: 'unknown', cameraSetup: '', posture: '', lighting: '', clothing: '', activity: '', measuredAt: scans[2].date, quality: 'good' } } });
  `);
  await page.reload();
  await expect(page.getByText(/^Figure fitted to scan · 14 Nov/)).toBeVisible();
  await page.locator('.crew-switch-btn').click();
  await page.getByRole('button', { name: 'Edit profile' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit profile' });
  const history = dialog.getByRole('region', { name: /Scan history/ });
  await expect(history.locator('tbody tr')).toHaveCount(3);
  // Newest first; the scan shaping the figure is marked; leg outlines are listed too.
  await expect(history.locator('tbody tr').first()).toContainText('Shapes figure');
  await expect(history.locator('tbody tr').nth(1)).toContainText('Legs');
  await expect(history.locator('tbody tr').first()).toContainText(/\d+(\.\d)? cm/);
  await page.screenshot({ path: 'test-results/scan-history-1440.png' });
  // On a phone the table scrolls inside its own region; the page itself never scrolls sideways.
  await page.setViewportSize({ width: 390, height: 844 });
  await history.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/scan-history-390.png' });
  await page.setViewportSize({ width: 1440, height: 1050 });

  // Cancel leaves everything and returns focus to that row's delete button.
  const deleteNewest = history.getByRole('button', { name: /^Delete scan from 14 Nov/ });
  await deleteNewest.click();
  const confirm = dialog.getByRole('group', { name: 'Confirm scan deletion' });
  await expect(confirm).toContainText('Its 15.3 cm thigh reading leaves Trends too.');
  await expect(confirm).toContainText('The figure goes back to your previous scan.');
  await expect(confirm.getByRole('button', { name: 'Cancel' })).toBeFocused();
  const axe = await new AxeBuilder({ page }).include('.dialog').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(axe.violations.map(v => v.id)).toEqual([]);
  await confirm.getByRole('button', { name: 'Cancel' }).click();
  await expect(confirm).toHaveCount(0);
  await expect(deleteNewest).toBeFocused();
  await expect(history.locator('tbody tr')).toHaveCount(3);

  await deleteNewest.click();
  await confirm.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(history.locator('tbody tr')).toHaveCount(2);
  await expect(history.locator('tbody tr').filter({ hasText: '7 Nov' })).toContainText('Shapes figure');
  await expect.poll(async () => {
    const state = await mission(page);
    const entry = state.checkIns.find((c: any) => c.id === 'linked');
    return { thigh: entry.thighCm ?? null, shaping: state.profile.scan?.id, kept: state.profile.scans.map((s: any) => s.id) };
  }).toEqual({ thigh: null, shaping: 's1', kept: ['s1', 's2'] });
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByText(/^Figure fitted to scan · 7 Nov/)).toBeVisible();
});

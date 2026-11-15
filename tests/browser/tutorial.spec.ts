import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.use({ storageState: { cookies: [], origins: [] } });
const guide = (page: Page) => page.getByRole('dialog', { name: 'Tutorial', exact: true });
/** Intro (Start), then Spot, Check, Compare (Trends, then a look at the chart with Next) and Act. */
const steps = ['intro', 'spot', 'check', 'trends', 'trend-chart', 'report'] as const;
const buttonStep = (step: number) => steps[step] === 'intro' ? 'Start' : steps[step] === 'trend-chart' ? 'Next' : null;
const label = (step: number) => step === 0 ? 'Introduction' : `Step ${step} of ${steps.length - 1}`;

async function savedMission(page: Page) {
  return page.evaluate(() => new Promise<string | null>((resolve, reject) => {
    const open = indexedDB.open('ghostpilot-mission');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction('mission');
      const request = tx.objectStore('mission').get('state');
      tx.oncomplete = () => { db.close(); resolve(request.result ? JSON.stringify(request.result) : null); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    };
  }));
}

/** Complete one step the way a user would: its Start/Next button, or the highlighted real control. */
async function advance(page: Page, step: number, keyboard = false) {
  await expect(guide(page)).toContainText(label(step));
  const name = buttonStep(step);
  const goal = name ? guide(page).getByRole('button', { name, exact: true }) : page.locator(`[data-tour="${steps[step]}"]`);
  if (steps[step] === 'trend-chart') await expect(page.locator('[data-tour="trend-chart"]')).toBeVisible();
  await expect(goal).toBeVisible();
  await expect(goal).toBeFocused();
  if (keyboard) await page.keyboard.press('Enter');
  else await goal.click();
}
async function finishTour(page: Page) {
  for (let step = 0; step < steps.length; step++) await advance(page, step);
  await expect(guide(page).getByRole('heading', { name: 'That’s the loop' })).toBeVisible();
}

test('the tour follows one flagged reading through spot, check, compare and act, and saves nothing', async ({ page }) => {
  const outside: string[] = [];
  page.on('request', request => { if (/^https?:/.test(request.url()) && !request.url().startsWith('http://127.0.0.1:5173/')) outside.push(request.url()); });
  await page.goto('/');
  await expect(guide(page)).toBeVisible();
  await expect.poll(() => savedMission(page)).not.toBeNull();
  const before = await savedMission(page);
  await expect(guide(page).getByRole('heading', { name: 'Your first check, start to finish' })).toBeVisible();
  await advance(page, 0);
  // Goal steps have no Next: even a forced click on another control cannot skip ahead.
  await expect(guide(page).getByRole('button', { name: 'Next', exact: true })).toHaveCount(0);
  await page.locator('[data-tour="trends"]').evaluate((element: HTMLElement) => element.click());
  await expect(guide(page)).toContainText('Step 1 of 5');
  await expect(page).toHaveURL(/#body$/);
  // The demo's first flagged region is Head, because sleep and attention drifted from the ghost.
  await expect(page.locator('[data-tour="spot"]')).toContainText('Head');
  await advance(page, 1);
  await expect(page.locator('[data-tour="check"]')).toContainText('Sleep quality');
  await advance(page, 2);
  await expect(page.locator('[data-tour="check"]')).toHaveAttribute('aria-expanded', 'true');
  await advance(page, 3);
  await expect(page.locator('[data-tour="trend-chart"] h2')).toContainText('Sleep');
  await advance(page, 4);
  await advance(page, 5);
  await expect(guide(page).getByRole('heading', { name: 'That’s the loop' })).toBeVisible();
  await guide(page).getByRole('button', { name: 'Finish', exact: true }).click();
  await expect(guide(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Tutorial', exact: true })).toBeFocused();
  expect(await savedMission(page)).toBe(before);
  expect(outside).toEqual([]);
  await page.reload();
  await expect(page.locator('main h1')).toBeAttached();
  await expect(guide(page)).toHaveCount(0);
});

test('Back restores the starting point and the reopened goal must be used again', async ({ page }) => {
  await page.goto('/');
  for (let step = 0; step <= 2; step++) await advance(page, step);
  await expect(page.locator('[data-tour="check"]')).toHaveAttribute('aria-expanded', 'true');
  await guide(page).getByRole('button', { name: 'Back', exact: true }).click();
  await expect(guide(page)).toContainText('Step 2 of 5');
  await expect(page.locator('[data-tour="check"]')).toHaveAttribute('aria-expanded', 'false');
  await advance(page, 2);
  await expect(guide(page)).toContainText('Step 3 of 5');
});

test('keyboard users can finish the tour and cannot tab into unrelated controls', async ({ page }) => {
  await page.goto('/');
  await expect(guide(page)).toBeVisible();
  for (let step = 0; step < steps.length; step++) {
    const name = buttonStep(step);
    const goal = name ? guide(page).getByRole('button', { name, exact: true }) : page.locator(`[data-tour="${steps[step]}"]`);
    await expect(goal).toBeFocused();
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('.tour-coach, [data-tour]'))).toBe(true);
    await page.keyboard.press('Shift+Tab');
    await advance(page, step, true);
  }
  await expect(guide(page).getByRole('button', { name: 'Finish', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(guide(page)).toHaveCount(0);
});

for (const dismissal of ['Skip tutorial', 'Close tutorial', 'Escape']) {
  test(`${dismissal} leaves the app usable and replay starts at the introduction`, async ({ page }) => {
    await page.goto('/');
    await advance(page, 0);
    if (dismissal === 'Escape') await page.keyboard.press('Escape');
    else await guide(page).getByRole('button', { name: dismissal, exact: true }).click();
    await expect(guide(page)).toHaveCount(0);
    await page.getByRole('link', { name: 'Trends', exact: true }).click();
    await page.reload();
    await expect(page.locator('main h1')).toBeAttached();
    await expect(guide(page)).toHaveCount(0);
    await page.getByRole('button', { name: 'Tutorial', exact: true }).click();
    await expect(guide(page)).toContainText('Introduction');
  });
}

test('replay for a new member preserves the current crew, page and unsaved handoff draft', async ({ page }) => {
  await page.goto('/');
  await guide(page).getByRole('button', { name: 'Skip tutorial' }).click();
  await page.locator('.crew-switch-btn').click();
  await page.getByRole('button', { name: 'Add crew member', exact: true }).click();
  await page.getByRole('dialog', { name: 'Edit profile' }).getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('link', { name: 'Report', exact: true }).click();
  await page.getByLabel('Note for the medical team').fill('Unsaved private observation');
  const before = await savedMission(page);
  await page.getByRole('button', { name: 'Tutorial', exact: true }).click();
  // With no readings yet, nothing is red: the tour still runs on a region and check that exist.
  await advance(page, 0);
  await expect(guide(page).getByRole('heading', { name: 'Pick a region' })).toBeVisible();
  for (let step = 1; step < steps.length; step++) await advance(page, step);
  await guide(page).getByRole('button', { name: 'Finish', exact: true }).click();
  await expect(page).toHaveURL(/#report$/);
  await expect(page.getByLabel('Note for the medical team')).toHaveValue('Unsaved private observation');
  expect(await savedMission(page)).toBe(before);
});

test('unavailable preference storage still allows skipping and replaying the tour', async ({ page }) => {
  await page.addInitScript(() => {
    const get = Storage.prototype.getItem, set = Storage.prototype.setItem;
    Storage.prototype.getItem = function (key) { if (key === 'ghostpilot-tutorial-v1') throw new DOMException('Unavailable', 'SecurityError'); return get.call(this, key); };
    Storage.prototype.setItem = function (key, value) { if (key === 'ghostpilot-tutorial-v1') throw new DOMException('Unavailable', 'SecurityError'); return set.call(this, key, value); };
  });
  await page.goto('/');
  await guide(page).getByRole('button', { name: 'Skip tutorial' }).click();
  await page.getByRole('button', { name: 'Tutorial', exact: true }).click();
  await expect(guide(page)).toContainText('Introduction');
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 1024, height: 600 }, { width: 320, height: 240 }]) {
  test(`tour steps remain operable at ${viewport.width} × ${viewport.height}`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    for (let step = 0; step < steps.length; step++) {
      await expect(guide(page)).toContainText(label(step));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (viewport.height > 240 && [0, 1, 2, 4, 5].includes(step)) {
        const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
        expect(audit.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, detail: n.failureSummary })) }))).toEqual([]);
      }
      if ([0, 2, 4].includes(step)) await page.screenshot({ path: `test-results/interactive-tour-${viewport.width}-${step}.png` });
      await advance(page, step);
    }
    await guide(page).getByRole('button', { name: 'Finish', exact: true }).click();
    await expect(guide(page)).toHaveCount(0);
  });
}

test('the full tour works offline in the production build', async ({ page, context }) => {
  test.setTimeout(90000);
  await page.goto('http://127.0.0.1:4173/');
  await expect(guide(page)).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise<void>(resolve => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }));
  });
  await context.setOffline(true);
  await page.reload();
  await finishTour(page);
  await guide(page).getByRole('button', { name: 'Finish', exact: true }).click();
  await expect(page.getByText('Offline', { exact: true })).toBeVisible();
});

import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.use({ storageState: { cookies: [], origins: [] } });
const guide = (page: Page) => page.getByRole('dialog', { name: 'Interactive tutorial', exact: true });
const goals = ['crew', 'profile', 'profile-done', 'chest', 'heart-check', 'trends', 'heart-trend', 'handoff', 'observation'];

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

async function clickGoal(page: Page, step: number, keyboard = false) {
  await expect(guide(page)).toContainText(`Step ${step + 1} of 9`);
  const goal = page.locator(`[data-tour="${goals[step]}"]`);
  await expect(goal).toBeVisible();
  await expect(goal).toBeFocused();
  if (keyboard) await page.keyboard.press('Enter');
  else await goal.click();
}

test('only real goal clicks advance the tour, and completion leaves health records unchanged', async ({ page }) => {
  const outside: string[] = [];
  page.on('request', request => { if (/^https?:/.test(request.url()) && !request.url().startsWith('http://127.0.0.1:5173/')) outside.push(request.url()); });
  await page.goto('/');
  await expect(guide(page)).toBeVisible();
  await expect.poll(() => savedMission(page)).not.toBeNull();
  const before = await savedMission(page);
  await expect(guide(page).getByRole('button', { name: 'Next', exact: true })).toHaveCount(0);
  await expect(guide(page).getByRole('button', { name: 'Finish', exact: true })).toHaveCount(0);
  // Even a forced/programmatic click on another navigation control cannot bypass a goal.
  await page.locator('[data-tour="trends"]').evaluate((element: HTMLElement) => element.click());
  await expect(guide(page)).toContainText('Step 1 of 9');
  await expect(page).toHaveURL(/#body$/);
  for (let step = 0; step < goals.length; step++) await clickGoal(page, step);
  await expect(guide(page).getByRole('heading', { name: 'You’re ready' })).toBeVisible();
  await guide(page).getByRole('button', { name: 'Finish', exact: true }).click();
  await expect(guide(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Tutorial', exact: true })).toBeFocused();
  expect(await savedMission(page)).toBe(before);
  expect(outside).toEqual([]);
  await page.reload();
  await expect(page.locator('main h1')).toBeAttached();
  await expect(guide(page)).toHaveCount(0);
});

test('Back restores prerequisites and each reopened goal must be clicked again', async ({ page }) => {
  await page.goto('/');
  await clickGoal(page, 0);
  await guide(page).getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.locator('[data-tour="crew"]')).toHaveAttribute('aria-expanded', 'false');
  for (let step = 0; step <= 4; step++) await clickGoal(page, step);
  await expect(page.locator('[data-tour="heart-check"]')).toHaveAttribute('aria-expanded', 'true');
  await guide(page).getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.locator('[data-tour="heart-check"]')).toHaveAttribute('aria-expanded', 'false');
  await clickGoal(page, 4);
  await expect(guide(page)).toContainText('Step 6 of 9');
});

test('keyboard users can complete all goals and cannot tab into unrelated controls', async ({ page }) => {
  await page.goto('/');
  await expect(guide(page)).toBeVisible();
  for (let step = 0; step < goals.length; step++) {
    const target = page.locator(`[data-tour="${goals[step]}"]`);
    await expect(target).toBeFocused();
    await page.keyboard.press('Tab');
    expect(await guide(page).evaluate(element => element.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Shift+Tab');
    await clickGoal(page, step, true);
  }
  await expect(guide(page).getByRole('button', { name: 'Finish', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(guide(page)).toHaveCount(0);
});

for (const dismissal of ['Skip tutorial', 'Close tutorial', 'Escape']) {
  test(`${dismissal} leaves the app usable and replay starts at the first goal`, async ({ page }) => {
    await page.goto('/');
    await clickGoal(page, 0);
    if (dismissal === 'Escape') await page.keyboard.press('Escape');
    else await guide(page).getByRole('button', { name: dismissal, exact: true }).click();
    await expect(guide(page)).toHaveCount(0);
    await page.getByRole('link', { name: 'Trends', exact: true }).click();
    await page.reload();
    await expect(page.locator('main h1')).toBeAttached();
    await expect(guide(page)).toHaveCount(0);
    await page.getByRole('button', { name: 'Tutorial', exact: true }).click();
    await expect(guide(page)).toContainText('Step 1 of 9');
  });
}

test('replay preserves the current crew, source, page and unsaved handoff draft', async ({ page }) => {
  await page.goto('/');
  await guide(page).getByRole('button', { name: 'Skip tutorial' }).click();
  await page.getByRole('link', { name: 'Mission', exact: true }).click();
  await page.getByRole('button', { name: 'My records', exact: true }).click();
  await page.getByRole('link', { name: 'Handoff', exact: true }).click();
  await page.getByLabel('Observation for medical team').fill('Unsaved private observation');
  const before = await savedMission(page);
  await page.getByRole('button', { name: 'Tutorial', exact: true }).click();
  for (let step = 0; step < goals.length; step++) await clickGoal(page, step);
  await guide(page).getByRole('button', { name: 'Finish', exact: true }).click();
  await expect(page).toHaveURL(/#handoff$/);
  await expect(page.getByLabel('Observation for medical team')).toHaveValue('Unsaved private observation');
  expect(await savedMission(page)).toBe(before);
});

test('emergency help is available during a guided profile step and resumes after reload', async ({ page }) => {
  await page.goto('/');
  await clickGoal(page, 0);
  await clickGoal(page, 1);
  await guide(page).getByRole('button', { name: 'Emergency', exact: true }).click();
  await expect(guide(page)).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Emergency response', exact: true })).toBeVisible();
  await expect(page.locator('main')).toHaveAttribute('inert', '');
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Resume emergency', exact: true })).toBeVisible();
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
  await expect(guide(page)).toContainText('Step 1 of 9');
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 1024, height: 600 }, { width: 320, height: 240 }]) {
  test(`guided targets remain operable at ${viewport.width} × ${viewport.height}`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    for (let step = 0; step < goals.length; step++) {
      await expect(guide(page)).toContainText(`Step ${step + 1} of 9`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (viewport.height > 240 && [0, 2, 4, 6, 8].includes(step)) {
        const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
        expect(audit.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, detail: n.failureSummary })) }))).toEqual([]);
      }
      if ([0, 4].includes(step)) await page.screenshot({ path: `test-results/interactive-tour-${viewport.width}-${step}.png` });
      await clickGoal(page, step);
    }
    await guide(page).getByRole('button', { name: 'Finish', exact: true }).click();
    await expect(guide(page)).toHaveCount(0);
  });
}

test('the full interactive tour works offline in the production build', async ({ page, context }) => {
  test.setTimeout(90000);
  await page.goto('http://127.0.0.1:4173/');
  await expect(guide(page)).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise<void>(resolve => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }));
  });
  await context.setOffline(true);
  await page.reload();
  for (let step = 0; step < goals.length; step++) await clickGoal(page, step);
  await guide(page).getByRole('button', { name: 'Finish', exact: true }).click();
  await expect(page.getByText('Offline', { exact: true })).toBeVisible();
});

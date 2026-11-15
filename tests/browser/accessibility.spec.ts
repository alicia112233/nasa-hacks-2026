import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const routes = ['body', 'trends', 'handoff', 'mission'];
const viewports = [
  { width: 1440, height: 900 }, { width: 1366, height: 768 },
  { width: 1024, height: 600 }, { width: 800, height: 600 },
  { width: 390, height: 844 }, { width: 320, height: 568 },
  { width: 568, height: 320 },
  // CSS viewports equivalent to 200% and 400% zoom on a 1280 × 960 display.
  { width: 640, height: 480 }, { width: 320, height: 240 },
];
const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const viewport of viewports) {
  test(`views reflow without horizontal scrolling at ${viewport.width} × ${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    for (const route of routes) {
      await page.goto(`/#${route}`);
      await expect(page.locator('main h1')).toBeAttached();
      expect(await overflow(page), route).toBeLessThanOrEqual(0);
    }
    await page.goto('/#body');
    await page.getByRole('button', { name: /^C Chest/ }).click();
    await page.getByRole('button', { name: /Short of breath/ }).click();
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    await page.getByRole('button', { name: /^A Head/ }).click();
    await page.getByRole('button', { name: /Attention/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('button', { name: 'Stop and discard' })).toBeInViewport();
    const start = dialog.getByRole('button', { name: 'Start' });
    await start.scrollIntoViewIfNeeded();
    await expect(start).toBeInViewport();
  });
}

test('the procedure card and body index share the 1024 × 600 viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 600 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Head', level: 2 })).toBeInViewport();
  await expect(page.getByRole('button', { name: /^A Head/ })).toBeInViewport();
  await expect(page.getByRole('button', { name: /^I Cabin/ })).toBeInViewport();
  await page.screenshot({ path: 'test-results/body-1024x600.png' });
});

for (const width of [1440, 390]) {
  test(`WCAG automated checks across views and dialogs at ${width}px`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const audit = async () => {
      // Audit from the top: rows scrolled under the sticky top bar read as obscured targets, whatever the layout.
      await page.evaluate(() => window.scrollTo(0, 0));
      const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      expect(result.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, detail: n.failureSummary })) }))).toEqual([]);
    };
    for (const route of routes) { await page.goto(`/#${route}`); await audit(); }
    await page.goto('/#body');
    await page.getByRole('button', { name: /^C Chest/ }).click();
    await page.getByRole('button', { name: /Short of breath/ }).click();
    await page.getByRole('button', { name: 'Plan follow-up' }).count();
    await audit();
    await page.getByRole('button', { name: /^I Cabin/ }).click();
    await page.getByRole('button', { name: /Cabin CO₂/ }).click();
    await expect(page.getByText('ppm CO₂ median')).toBeVisible();
    await audit();
    await page.getByRole('button', { name: /^A Head/ }).click();
    await page.getByRole('button', { name: 'Plan follow-up' }).click();
    await audit();
    await page.getByRole('button', { name: /Attention/ }).click();
    await audit();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /^E Arms/ }).click();
    await page.getByRole('button', { name: /Shoulder range/ }).click();
    await page.getByRole('button', { name: 'Record 12 s' }).click();
    await audit();
    await page.keyboard.press('Escape');
    await page.goto('/#body');
    await page.locator('.crew-switch-btn').click();
    // The open crew list floats over the page; check the list itself (what it covers is checked with it closed).
    const menu = await new AxeBuilder({ page }).include('.crew-switch').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect(menu.violations.map(v => v.id)).toEqual([]);
    await page.getByRole('button', { name: 'Edit profile' }).click();
    await expect(page.getByLabel('Height')).toBeVisible();
    await audit();
    const profile = page.getByRole('dialog', { name: 'Edit profile' });
    expect(await profile.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.screenshot({ path: `test-results/profile-${width}.png` });
    await profile.getByRole('button', { name: 'Scan me', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Body scan · 5 s' })).toBeVisible();
    await audit();
  });
}

test('keyboard reaches every region, contains dialog focus and restores it', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Head', level: 2 })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  const head = page.getByRole('button', { name: /^A Head/ });
  await head.focus();
  for (let i = 0; i < 3; i++) await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: /^D Abdomen/ })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Abdomen', level: 2 })).toBeVisible();
  await page.getByRole('button', { name: /^A Head/ }).click();
  const trigger = page.getByRole('button', { name: /Attention/ });
  await trigger.click();
  const dialog = page.getByRole('dialog');
  for (let i = 0; i < 4; i++) { await page.keyboard.press('Tab'); expect(await dialog.evaluate(d => d.contains(document.activeElement))).toBe(true); }
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('text spacing, reduced motion, and forced colors preserve usable controls', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce', forcedColors: 'active' });
  await page.goto('/');
  await page.addStyleTag({ content: '* { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; } p { margin-bottom: 2em !important; }' });
  await page.getByRole('button', { name: /^C Chest/ }).click();
  await page.getByRole('button', { name: /Short of breath/ }).click();
  await expect(page.getByRole('group', { name: 'Short of breath' }).getByRole('button', { name: 'Mild' })).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});

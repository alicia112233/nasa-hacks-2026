import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const routes = ['overview', 'lens', 'movement', 'flight', 'insights', 'actions'];
const viewports = [
  { width: 1440, height: 900 }, { width: 1366, height: 768 },
  { width: 1024, height: 600 }, { width: 800, height: 600 },
  { width: 390, height: 844 }, { width: 320, height: 568 },
  { width: 568, height: 320 },
  // Equivalent CSS viewport for 200% zoom on a 1280 × 960 display.
  { width: 640, height: 480 },
  // Equivalent CSS viewport for 400% zoom on a 1280 × 960 display.
  { width: 320, height: 240 },
];

for (const viewport of viewports) {
  test(`pages and check-in reflow at ${viewport.width} × ${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    for (const route of routes) {
      await page.goto(`/#${route}`);
      await expect(page.locator('main h1')).toBeVisible();
      if (route === 'lens') {
        await page.getByText('Research for this hazard', { exact: true }).click();
        await page.getByText('Explore NASA data sources', { exact: false }).click();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    }
    await page.getByRole('button', { name: 'Start flight check', exact: true }).click();
    await page.getByRole('button', { name: 'Continue without attention task' }).click();
    const save = page.getByRole('button', { name: 'Save my check-in' });
    await expect(save).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('button', { name: 'Close flight check' })).toBeInViewport({ ratio: 1 });
    expect(await page.locator('.flight-body').evaluate(el => el.clientHeight)).toBeGreaterThan(Math.min(60, viewport.height * .15));
    await page.getByLabel('Heart rate', { exact: true }).fill('220');
    await expect(page.getByLabel('Heart rate', { exact: true })).toBeInViewport({ ratio: 1 });
    const fieldFits = await page.getByLabel('Heart rate', { exact: true }).evaluate(el => {
      const input = el as HTMLInputElement;
      const style = getComputedStyle(input);
      const context = document.createElement('canvas').getContext('2d')!;
      context.font = style.font;
      const available = input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 20;
      return available >= context.measureText(input.placeholder).width;
    });
    expect(fieldFits).toBe(true);
    await page.getByPlaceholder('Anything worth remembering?').fill('Crew notes remain readable at this screen size.');
    await expect(page.getByPlaceholder('Anything worth remembering?')).toBeInViewport({ ratio: 1 });
    const unobscured = await page.getByPlaceholder('Anything worth remembering?').evaluate(el => {
      const field = el.getBoundingClientRect();
      const body = el.closest('.flight-body')!.getBoundingClientRect();
      return field.top >= body.top - 1 && field.bottom <= body.bottom + 1;
    });
    expect(unobscured).toBe(true);
    await page.screenshot({ path: `test-results/check-in-${viewport.width}x${viewport.height}.png` });
    await expect(save).toBeInViewport({ ratio: 1 });
    expect(await page.getByRole('dialog').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  });
}

for (const width of [1440, 390]) {
  test(`WCAG automated checks across all views and dialogs at ${width}px`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const audit = async () => {
      const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      expect(result.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, detail: n.failureSummary })) }))).toEqual([]);
    };
    for (const route of routes) {
      await page.goto(`/#${route}`);
      await expect(page.locator('main h1')).toBeVisible();
      await audit();
      if (route === 'lens') {
        await page.getByText('Research for this hazard', { exact: true }).click();
        await page.getByText('Explore NASA data sources', { exact: false }).click();
        await audit();
      }
    }
    await page.getByRole('button', { name: 'Start flight check', exact: true }).click();
    await audit();
    await page.getByRole('button', { name: 'Continue without attention task' }).click();
    await page.getByLabel('Heart rate', { exact: true }).fill('64');
    await page.getByPlaceholder('Anything worth remembering?').fill('Comparable mission conditions.');
    await audit();
    await page.keyboard.press('Escape');
    await page.goto('/');
    await page.getByRole('button', { name: /Review shoulder/ }).click();
    await audit();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Prepare ground report' }).click();
    await audit();
    await page.keyboard.press('Escape');
    if (width < 701) {
      await page.getByRole('button', { name: 'Open navigation' }).click();
      await audit();
    }
  });
}

test('summary puts observations and review actions in the small laptop viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 600 });
  await page.goto('/');
  const summary = page.getByRole('region', { name: 'Health at a glance' });
  await expect(summary).toBeInViewport({ ratio: 1 });
  await expect(summary).toContainText('SIMULATED DATA');
  await expect(summary.locator('dl > div')).toHaveCount(6);
  await expect(summary.getByRole('button', { name: /Review shoulder/ })).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: 'test-results/crew-overview-small-laptop.png' });
});

test('keyboard focus stays in dialogs, restores to the trigger, and skips hidden navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
  const trigger = page.getByRole('button', { name: 'Start flight check', exact: true });
  await trigger.click();
  await expect(page.getByRole('button', { name: 'Close flight check' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Continue without attention task' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#flight-title')).toBeFocused();
  await page.getByRole('button', { name: 'Save my check-in' }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Close flight check' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  expect(await page.locator('.sidebar').evaluate(el => el.inert)).toBe(true);
  const menu = page.getByRole('button', { name: 'Open navigation' });
  await menu.click();
  await expect(page.getByRole('button', { name: 'Close navigation menu' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Alex Morgan Mission specialist' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toBeFocused();
});

test('skipping attention saves an honest personal entry and survives reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Switch to my data' }).click();
  await page.getByRole('button', { name: 'Start flight check', exact: true }).click();
  await page.getByRole('button', { name: 'Continue without attention task' }).click();
  await expect(page.getByRole('dialog')).toContainText('Attention task not recorded');
  await page.getByRole('button', { name: 'Sleep quality: 2 Low', exact: true }).click();
  await page.getByLabel('Heart rate', { exact: true }).fill('66');
  await page.getByPlaceholder('Anything worth remembering?').fill('Manual crew observation.');
  await page.getByRole('button', { name: 'Save my check-in' }).click();
  await page.getByRole('button', { name: 'Back to my mission' }).click();
  await expect(page.getByText('Saved on device')).toBeVisible();
  await page.reload();
  const summary = page.getByRole('region', { name: 'Health at a glance' });
  await expect(summary).toContainText('PERSONAL DATA');
  await expect(summary.locator('dl > div').filter({ hasText: 'Heart rate' })).toContainText('66');
  await expect(summary.locator('dl > div').filter({ hasText: 'Attention' })).toContainText('Not recorded');
  await expect(summary.locator('dl > div').filter({ hasText: 'Left shoulder' })).toContainText('Not recorded');
});

test('text spacing, reduced motion, and forced colors preserve usable controls', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 480 });
  await page.emulateMedia({ reducedMotion: 'reduce', forcedColors: 'active' });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Play movement', exact: true })).toBeVisible();
  await page.addStyleTag({ content: '* { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; } p { margin-bottom: 2em !important; }' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Start flight check', exact: true }).click();
  await page.getByRole('button', { name: 'Continue without attention task' }).click();
  await page.getByLabel('Heart rate', { exact: true }).fill('64');
  await expect(page.getByRole('button', { name: 'Save my check-in' })).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('button', { name: 'Close flight check' })).toBeInViewport({ ratio: 1 });
  expect(await page.getByRole('dialog').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
});

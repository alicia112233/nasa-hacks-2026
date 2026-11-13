import { test, expect } from '@playwright/test';

test('trained 4DGS renders changing geometry, scrubs, orbits and keeps measurements separate', async ({ page }) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const stage = page.locator('.gaussian-stage');
  await expect(stage).toHaveAttribute('data-model-status', 'ready', { timeout: 45000 });
  await expect(page.getByText('Crew shoulder measurements use', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Trained 4DGS', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Play movement', exact: true })).toBeEnabled();
  await page.getByLabel('Movement timeline', { exact: true }).fill('0.1');
  await expect(stage).toHaveAttribute('data-motion-phase', '0.100');
  await page.waitForTimeout(1200);
  const canvas = stage.locator('canvas');
  const first = await canvas.screenshot({ path: 'test-results/4dgs-phase-010.png' });
  await page.getByLabel('Movement timeline', { exact: true }).fill('0.8');
  await page.waitForTimeout(1200);
  const second = await canvas.screenshot({ path: 'test-results/4dgs-phase-080.png' });
  expect(first.equals(second)).toBe(false);
  await canvas.focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(800);
  const orbited = await canvas.screenshot({ path: 'test-results/4dgs-orbit.png' });
  expect(second.equals(orbited)).toBe(false);
  await page.getByRole('button', { name: 'Play movement', exact: true }).click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: 'Pause playback', exact: true }).click();
  const stopped = await stage.getAttribute('data-motion-phase');
  await page.waitForTimeout(300);
  await expect(stage).toHaveAttribute('data-motion-phase', stopped!);
  await page.getByText('Model source and display details', { exact: true }).click();
  await expect(page.locator('.gaussian-provenance')).toContainText('120,007 Gaussians');
  await page.getByRole('button', { name: 'Pose comparison', exact: true }).click();
  await expect(page.getByText('Illustrative 3D replay · not a 4DGS reconstruction')).toBeVisible();
  await expect(page.locator('.range-annotation')).toBeVisible();
  await page.getByRole('button', { name: 'Trained 4DGS', exact: true }).click();
  await expect(stage).toHaveAttribute('data-model-status', 'ready', { timeout: 45000 });
  expect(errors).toEqual([]);
});

test('failed trained assets show an honest error and retry successfully', async ({ page }) => {
  await page.route('**/4dgs/mutant/model.bin', route => route.abort());
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Reconstruction unavailable');
  await expect(page.getByRole('button', { name: /^(Pause playback|Play movement)$/ })).toBeDisabled();
  await expect(page.locator('.gaussian-stage canvas')).toHaveCount(0);
  await page.unroute('**/4dgs/mutant/model.bin');
  await page.getByRole('button', { name: 'Retry reconstruction' }).click();
  await expect(page.locator('.gaussian-stage')).toHaveAttribute('data-model-status', 'ready', { timeout: 45000 });
});

test('trained example fits mobile and pauses with reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#movement');
  await expect(page.locator('.gaussian-stage')).toHaveAttribute('data-model-status', 'ready', { timeout: 45000 });
  await expect(page.getByRole('button', { name: 'Play movement', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.locator('.movement-viewer').screenshot({ path: 'test-results/4dgs-mobile.png' });
});

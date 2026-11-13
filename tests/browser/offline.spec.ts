import { test, expect } from '@playwright/test';

test('production build and local pose assets remain available offline', async ({ page, context }) => {
  test.setTimeout(90000);
  page.on('pageerror', error => console.log('OFFLINE PAGE ERROR:', error.message));
  page.on('requestfailed', request => console.log('FAILED REQUEST:', request.url(), request.failure()?.errorText));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('http://127.0.0.1:4173');
  await expect(page.getByText('Saved on device')).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise<void>(resolve => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }));
  });
  await context.setOffline(true);
  await page.reload();
  await page.screenshot({ path: 'test-results/ghostpilot-offline.png', fullPage: true });
  await expect(page.getByRole('heading', { name: 'Crew health overview.' })).toBeVisible();
  await expect(page.getByText('Offline · saved on device')).toBeVisible();
  const cachedModel = await page.evaluate(async () => (await fetch('/models/pose_landmarker_lite.task')).status);
  expect(cachedModel).toBe(200);
  await expect(page.locator('.gaussian-stage')).toHaveAttribute('data-model-status', 'ready', { timeout: 45000 });
  await page.getByLabel('Movement timeline', { exact: true }).fill('0.7');
  await expect(page.locator('.gaussian-stage')).toHaveAttribute('data-motion-phase', '0.700');
  const trainedAsset = await page.evaluate(async () => (await fetch('/4dgs/mutant/model.bin')).status);
  expect(trainedAsset).toBe(200);
  await page.getByRole('button', { name: /Connect the dots/ }).click();
  await page.getByPlaceholder('Record your action and anything you want to reassess…').fill('An action recorded offline.');
  await page.getByRole('button', { name: 'Log action & schedule check' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Action log', exact: false }).first().click();
  await expect(page.getByText('An action recorded offline.')).toBeVisible();
});

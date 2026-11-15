import { test, expect } from '@playwright/test';
import { fillCarePlan } from './care-helpers';

test('production build keeps the body, NASA data, pose and 4DGS models available offline', async ({ page, context }) => {
  test.setTimeout(90000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('http://127.0.0.1:4173/');
  await expect(page.getByRole('heading', { name: 'Today', level: 2 })).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise<void>(resolve => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }));
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('Offline')).toBeVisible();
  for (const asset of ['/models/body.glb', '/data/nasa-eda-rr-3.json', '/models/pose_landmarker_lite.task', '/4dgs/mutant/model.bin']) {
    expect(await page.evaluate(async url => (await fetch(url)).status, asset), asset).toBe(200);
  }
  await expect(page.locator('.tag[data-region="chest"]')).toHaveCSS('opacity', '1', { timeout: 20000 });
  await page.getByRole('button', { name: /^I Cabin/ }).click();
  await page.getByRole('button', { name: /Radiation dose/ }).click();
  await expect(page.getByText('mGy over 43 days')).toBeVisible();
  await page.getByRole('link', { name: 'Report' }).click();
  await page.getByLabel('Note for the medical team').fill('Crew reports vision blur; repeat under matching lighting.');
  await fillCarePlan(page);
  await page.getByRole('button', { name: 'Hand off today’s report' }).click();
  await expect(page.getByText('Saved on this device', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Saved on this device', { exact: true })).toBeVisible();
});

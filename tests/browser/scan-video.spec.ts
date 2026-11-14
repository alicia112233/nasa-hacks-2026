import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// The fake webcam is a Blender render of the reference body (male, average build, 172 cm) standing 2.6 m away.
test('the crew card scan shapes the body from the camera alone, then the same scan tracks the legs', async ({ page }) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/#body');

  // One tap on the body: the camera starts, and the scan starts itself once it sees the whole body.
  await expect(page.locator('.crew-switch-btn')).toContainText('Alex Morgan');
  await expect(page.getByText('Standard figure · not scanned')).toBeVisible();
  await page.getByRole('button', { name: 'Scan me' }).click();
  let dialog = page.getByRole('dialog', { name: 'Body scan · 5 s' });
  await expect(dialog.getByRole('button', { name: 'Use scan' })).toBeVisible({ timeout: 90000 });
  await expect(dialog.getByRole('group', { name: 'Body' }).getByRole('button', { name: 'Male', exact: true })).toHaveAttribute('aria-pressed', 'true');
  // Five breadths against one fixed baseline, the standard male figure, which is the body on camera.
  await expect(dialog.getByText('0 is the standard male figure')).toBeVisible();
  await expect(dialog.getByText(/\d+ frames agree within ±\d+%\. Tested on 8 rendered bodies, not on people\./)).toBeVisible();
  const values = (await dialog.locator('.scan-value').allTextContents()).map(t => Number(t.split('%')[0].replace('−', '-')));
  expect(values).toHaveLength(5);
  for (const v of values.slice(0, 4)) expect(Math.abs(v)).toBeLessThanOrEqual(4);
  // Build shapes the figure, not the baseline: the measured numbers stay put when it is corrected.
  const you = async () => (await dialog.locator('.scan-value').allTextContents()).map(t => t.split('%')[0]);
  const before = await you();
  await dialog.getByRole('group', { name: 'Build' }).getByRole('button', { name: 'Slight' }).click();
  await expect(dialog.getByText('Your figure · Male · Slight')).toBeVisible();
  expect(await you()).toEqual(before);
  await dialog.getByRole('group', { name: 'Build' }).getByRole('button', { name: 'Average' }).click();

  // The seconds it measured play back, lines included, beside the figure they shaped.
  await expect(dialog.getByText(/^Clip · \d+ s · \d+ of \d+ frames used$/)).toBeVisible();
  const clip = dialog.getByLabel('Recorded scan clip');
  await expect.poll(() => clip.evaluate((v: HTMLVideoElement) => Number.isFinite(v.duration) && v.duration > 3 && v.videoWidth > 0)).toBe(true);
  await dialog.getByRole('button', { name: 'Pause clip' }).click();
  await dialog.getByLabel('Clip position').fill('1');
  await expect.poll(() => clip.evaluate((v: HTMLVideoElement) => v.paused && Math.abs(v.currentTime - 1) < 0.2)).toBe(true);
  await expect(dialog.locator('.figure-canvas canvas')).toBeVisible();
  await expect(dialog.getByText(/Thigh \d+(\.\d)? cm starts your leg ghost/)).toBeVisible();
  const axe = await new AxeBuilder({ page }).include('.dialog').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(axe.violations.map(v => v.id)).toEqual([]);
  await dialog.getByRole('button', { name: 'Use scan' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Rescan' })).toBeVisible();
  await expect(page.getByText(/^Figure fitted to scan · /)).toBeVisible();
  await expect(page.getByRole('group', { name: 'Body' }).getByRole('button', { name: 'Male', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('From the scan')).toBeVisible();

  // Height is the one number a camera can't see. It sets the 0g height.
  await page.getByLabel('Height').fill('172');
  await page.getByLabel('Height').press('Enter');
  await expect(page.getByRole('group', { name: 'Body shown' }).getByRole('button', { name: /^Sol \d+ 177 cm$/ })).toBeVisible();

  // The same scan, run as the Legs check, measures thigh breadth for the ghost.
  await page.getByRole('list', { name: 'Body regions' }).getByRole('button', { name: /^H Legs/ }).click();
  await page.getByRole('button', { name: /Leg outline/ }).click();
  await page.getByRole('button', { name: 'Scan 5 s' }).click();
  dialog = page.getByRole('dialog', { name: 'Leg outline · 5 s' });
  await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeVisible({ timeout: 90000 });
  await expect(dialog.locator('.scan-value')).toHaveText(/^\d+(\.\d)? cm$/);
  await expect(dialog.getByText('None yet. This outline starts your ghost.')).toBeVisible();
  await expect.poll(() => dialog.getByLabel('Recorded scan clip').evaluate((v: HTMLVideoElement) => v.videoWidth > 0)).toBe(true);
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Leg outline saved to your records' })).toBeVisible();

  await page.locator('.crew-switch-btn').click();
  await page.getByRole('button', { name: 'Edit profile' }).click();
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Scan me' })).toBeVisible();
  await expect(page.getByText('Standard figure · not scanned')).toBeVisible();
  expect(errors).toEqual([]);
});

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
  await page.getByRole('button', { name: 'Scan me' }).click();
  let dialog = page.getByRole('dialog', { name: 'Body scan · 5 s' });
  await expect(dialog.getByRole('button', { name: 'Use scan' })).toBeVisible({ timeout: 90000 });
  await expect(dialog.getByRole('group', { name: 'Body' }).getByRole('button', { name: 'Male', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const values = (await dialog.locator('.scan-value').allTextContents()).map(t => Number(t.replace('−', '-').replace('%', '')));
  expect(values).toHaveLength(3);
  for (const v of values) expect(Math.abs(v)).toBeLessThanOrEqual(4);
  await expect(dialog.getByText(/Thigh \d+(\.\d)? cm starts your leg ghost/)).toBeVisible();
  const axe = await new AxeBuilder({ page }).include('.dialog').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(axe.violations.map(v => v.id)).toEqual([]);
  await dialog.getByRole('button', { name: 'Use scan' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Rescan' })).toBeVisible();
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
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Leg outline saved to your records' })).toBeVisible();

  await page.locator('.crew-switch-btn').click();
  await page.getByRole('button', { name: 'Edit profile' }).click();
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Scan me' })).toBeVisible();
  expect(errors).toEqual([]);
});

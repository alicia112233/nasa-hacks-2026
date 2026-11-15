import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// The fake webcam is a Blender render of the reference body (male, average build, 172 cm) standing 2.6 m away.
test('the scan keeps the profile model, refits a chosen model, and tracks the legs', async ({ page }) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  const spoken: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', request => { if (request.url().includes('/audio/scan/')) spoken.push(request.url().split('/').at(-1)!); });
  await page.goto('/#body');

  // One tap on the body: the camera starts, and the scan starts itself once it sees the whole body.
  await expect(page.locator('.crew-switch-btn')).toContainText('Alex Morgan');
  await expect(page.getByText('Standard figure · not scanned')).toBeVisible();
  await page.getByRole('button', { name: 'Scan me' }).click();
  let dialog = page.getByRole('dialog', { name: 'Body scan · 5 s' });
  await expect(dialog.getByRole('button', { name: 'Use scan' })).toBeVisible({ timeout: 90000 });
  await expect(dialog.getByRole('heading', { name: 'Scan complete', exact: true })).toBeVisible();
  await expect.poll(() => spoken).toContain('complete.wav');
  // Alex's female model wins even though the synthetic camera fixture uses the male mesh.
  const model = dialog.getByRole('group', { name: 'Avatar model' });
  await expect(model.getByRole('button', { name: 'Female', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await model.getByRole('button', { name: 'Male', exact: true }).click();
  await expect(model.getByRole('button', { name: 'Male', exact: true })).toHaveAttribute('aria-pressed', 'true');
  // Five breadths against one fixed baseline, the standard male figure, which is the body on camera.
  await expect(dialog.getByText('0 is our standard male figure')).toBeVisible();
  await expect(dialog.getByText(/\d+ frames agree within ±\d+%\. Tested on 8 rendered bodies, not people\./)).toBeVisible();
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
  await expect(dialog.getByText(/^Thigh \d+(\.\d)? cm.*Saved to H Legs\.$/)).toBeVisible();
  const axe = await new AxeBuilder({ page }).include('.dialog').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(axe.violations.map(v => v.id)).toEqual([]);
  await dialog.getByRole('button', { name: 'Use scan' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Rescan' })).toBeVisible();
  await expect(page.getByText(/^Figure fitted to scan · /)).toBeVisible();
  await page.locator('.crew-switch-btn').click();
  await page.getByRole('button', { name: 'Edit profile' }).click();
  await expect(page.getByRole('group', { name: 'Avatar model' }).getByRole('button', { name: 'Male', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Mass')).toBeVisible();

  // Height is the one number a camera can't see. It sets the 0g height.
  await page.getByLabel('Height').fill('172');
  await page.getByLabel('Height').press('Enter');
  await page.getByRole('dialog', { name: 'Edit profile' }).getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Body shown' }).getByRole('button', { name: /^Sol \d+ 177 cm$/ })).toBeVisible();

  // The Legs check is the same body scan: it keeps the chosen model and records thigh breadth in centimetres.
  await page.getByRole('list', { name: 'Body regions' }).getByRole('button', { name: /^H Legs/ }).click();
  await page.getByRole('button', { name: /Thigh breadth/ }).click();
  await page.getByRole('button', { name: 'Scan 5 s' }).click();
  dialog = page.getByRole('dialog', { name: 'Body scan · 5 s' });
  await expect(dialog.getByRole('button', { name: 'Use scan', exact: true })).toBeEnabled({ timeout: 90000 });
  await expect(dialog.getByText(/^Thigh \d+(\.\d)? cm\. Saved to H Legs\.$/)).toBeVisible();
  await expect.poll(() => dialog.getByLabel('Recorded scan clip').evaluate((v: HTMLVideoElement) => v.videoWidth > 0)).toBe(true);
  await dialog.getByRole('button', { name: 'Use scan', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: /Body scan saved · thigh \d/ })).toBeVisible();

  await page.locator('.crew-switch-btn').click();
  await page.getByRole('button', { name: 'Edit profile' }).click();
  // Both scans are in the history; deleting the newest asks first, and the figure goes back to the previous scan.
  const profile = page.getByRole('dialog', { name: 'Edit profile' });
  await expect(profile.getByRole('region', { name: 'Scan history' }).locator('tbody tr')).toHaveCount(2);
  // Each saved scan keeps its recorded seconds on the device, and the history replays them.
  await expect(profile.getByRole('button', { name: /^Play clip from/ })).toHaveCount(2);
  await profile.getByRole('button', { name: /^Play clip from/ }).first().click();
  await expect.poll(() => profile.locator('.scan-history-clip video').evaluate((v: HTMLVideoElement) => v.videoWidth)).toBeGreaterThan(0);
  await profile.getByRole('button', { name: 'Close clip' }).click();
  await profile.getByRole('row').filter({ hasText: 'Shapes figure' }).getByRole('button', { name: /^Delete scan from/ }).click();
  await expect(profile.getByRole('group', { name: 'Confirm scan deletion' })).toContainText('The figure goes back to your previous scan.');
  await profile.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(profile.getByRole('region', { name: 'Scan history' }).locator('tbody tr')).toHaveCount(1);
  await profile.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Rescan' })).toBeVisible();
  await expect(page.getByText(/^Figure fitted to scan · /)).toBeVisible();
  expect(errors).toEqual([]);
});

test('a new crew member chooses a model before saving, and Female survives retakes, reloads and rescans', async ({ page }) => {
  test.setTimeout(180000);
  await page.goto('/');
  await page.locator('.crew-switch-btn').click();
  await page.getByRole('button', { name: 'Add crew member', exact: true }).click();
  await page.getByRole('dialog', { name: 'Edit profile', exact: true }).getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Scan me', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Body scan · 5 s', exact: true });
  const save = dialog.getByRole('button', { name: 'Use scan', exact: true });
  const models = dialog.getByRole('group', { name: 'Avatar model', exact: true });
  await expect(save).toBeVisible({ timeout: 90000 });
  await expect(save).toBeDisabled();
  await expect(models.getByRole('button', { pressed: true })).toHaveCount(0);
  await expect(dialog.getByText('Choose one to save', { exact: true })).toBeVisible();
  await models.getByRole('button', { name: 'Female', exact: true }).click();
  await expect(save).toBeEnabled();
  await dialog.getByRole('group', { name: 'Build', exact: true }).getByRole('button', { name: 'Slight', exact: true }).click();
  await dialog.getByRole('button', { name: 'Retake', exact: true }).click();
  await expect(save).toBeVisible({ timeout: 90000 });
  await expect(models.getByRole('button', { name: 'Female', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog.getByText('Your figure · Female · Slight', { exact: true })).toBeVisible();
  await save.click();
  await page.reload();
  await page.locator('.crew-switch-btn').click();
  await page.getByRole('button', { name: 'Edit profile', exact: true }).click();
  const profile = page.getByRole('dialog', { name: 'Edit profile', exact: true });
  await expect(profile.getByRole('group', { name: 'Avatar model', exact: true }).getByRole('button', { name: 'Female', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await profile.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Rescan', exact: true }).click();
  await expect(save).toBeVisible({ timeout: 90000 });
  await expect(models.getByRole('button', { name: 'Female', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByRole('button', { name: 'Close body scan', exact: true }).click();
});

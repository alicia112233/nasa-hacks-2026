import { test, expect, type Page } from '@playwright/test';

async function personal(page: Page) {
  await page.goto('/#mission');
  await page.getByRole('button', { name: 'My records', exact: true }).click();
  await page.getByRole('link', { name: 'Body' }).click();
}

test('demo body flags head and arms, and every region opens its procedure card', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  // The body page opens on Today; the body is still the way into each region.
  await expect(page.getByRole('heading', { name: 'Today', level: 2 })).toBeVisible();
  await page.getByRole('button', { name: /^A Head/ }).click();
  await expect(page.getByRole('heading', { name: 'Head', level: 2 })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Response 18% slower than your ghost' })).toBeVisible();
  for (const [letter, label, check] of [['B', 'Eyes', 'Eye imaging (OCT)'], ['C', 'Chest', 'Resting heart rate'], ['D', 'Abdomen', 'Appetite and meals'], ['E', 'Arms', 'Shoulder range'], ['F', 'Hands', 'Rash or cold sore'], ['G', 'Back & pelvis', 'Back pain'], ['H', 'Legs', 'Bone density (DXA)'], ['I', 'Cabin', 'Radiation dose']]) {
    await page.getByRole('button', { name: new RegExp(`^${letter} ${label.replace('&', '&')}`) }).click();
    await expect(page.getByRole('heading', { name: label, level: 2 })).toBeVisible();
    await expect(page.getByRole('button', { name: new RegExp(check.replace(/[()]/g, '\\$&')) })).toBeVisible();
  }
  await expect(page.locator('.tabs a')).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('clicking the Blender body selects the region under the pointer', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const tag = page.locator('.tag[data-region="abdomen"]');
  await expect(tag).toHaveCSS('opacity', '1', { timeout: 20000 });
  // The leader line starts on the anatomy; click that point on the 3D canvas.
  const stage = (await page.locator('.body-stage').boundingBox())!;
  const [x, y] = (await page.locator('.body-leaders polyline').nth(3).getAttribute('points'))!.split(' ')[0].split(',').map(Number);
  await page.mouse.click(stage.x + x, stage.y + y);
  await expect(page.getByRole('heading', { name: 'Abdomen', level: 2 })).toBeVisible();
  await expect(page.getByRole('button', { name: /^D Abdomen/ })).toHaveAttribute('aria-pressed', 'true');
});

test('a personal self-check saves to today, marks the region and survives reload', async ({ page }) => {
  await personal(page);
  await page.getByRole('button', { name: /^B Eyes/ }).click();
  await page.getByRole('button', { name: 'Begin' }).click();
  await page.getByRole('group', { name: 'Blurred or changed vision' }).getByRole('button', { name: 'Mild' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'blurred or changed vision (mild)' })).toBeVisible();
  // Eyes has one self-check (OCT needs an imager), so it is finished: the done panel points at the next region.
  const done = page.getByRole('status', { name: 'Eyes complete' });
  await expect(done).toContainText('Done.');
  await expect(done.getByRole('button', { name: 'Next: A Head' })).toBeVisible();
  await page.getByRole('button', { name: /^C Chest/ }).click();
  await page.getByRole('button', { name: /Resting heart rate/ }).click();
  await page.getByRole('spinbutton').fill('71');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Done: 71 bpm' })).toBeVisible();
  await page.waitForTimeout(400); // let the IndexedDB write settle before reloading
  await page.reload();
  await page.getByRole('button', { name: /^C Chest/ }).click();
  await expect(page.getByRole('img', { name: 'Done: 71 bpm' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^B Eyes/ })).toHaveClass(/reported/);
  await page.getByRole('link', { name: 'Trends' }).click();
  await expect(page.getByRole('region', { name: 'Check-in history' })).toContainText('71');
});

test('attention task records real responses over the full 60 seconds', async ({ page }) => {
  test.setTimeout(120000);
  await personal(page);
  await page.getByRole('button', { name: /^A Head/ }).click();
  await page.getByRole('button', { name: /Attention/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Start', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const target = page.getByRole('button', { name: 'Target' });
  let answered = 0;
  while (await dialog.count()) {
    if (await target.isVisible().catch(() => false)) { await page.keyboard.press('Space'); answered++; }
    await page.waitForTimeout(150);
  }
  expect(answered).toBeGreaterThan(5);
  await expect(page.locator('.toast')).toContainText('Attention saved');
  await page.waitForTimeout(400);
  await page.reload();
  await page.getByRole('button', { name: /^A Head/ }).click();
  await expect(page.getByRole('img', { name: /Done: \d+ ms/ })).toBeVisible();
});

test('stopping the attention task early saves nothing', async ({ page }) => {
  await personal(page);
  await page.getByRole('button', { name: /^A Head/ }).click();
  await page.getByRole('button', { name: /Attention/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByRole('button', { name: 'Stop and discard' }).click();
  await expect(page.getByRole('img', { name: 'Not done today' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Attention/ })).toBeFocused();
});

test('shoulder capture uses the local model with a fake camera and keeps the video on the device', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('/');
  await page.getByRole('button', { name: /^E Arms/ }).click();
  await page.getByRole('button', { name: /Shoulder range/ }).click();
  await page.getByRole('button', { name: 'Record 12 s' }).click();
  await page.getByRole('button', { name: 'Enable camera' }).click();
  await expect(page.getByRole('button', { name: 'Record', exact: true })).toBeVisible({ timeout: 60000 });
  await page.getByRole('button', { name: 'Record', exact: true }).click();
  await page.getByRole('button', { name: 'Stop and save' }).click();
  await expect(page.getByRole('dialog').getByText('Saved.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  const stored = await page.evaluate(() => new Promise<number>(resolve => { const r = indexedDB.open('ghostpilot-mission'); r.onsuccess = () => { const q = r.result.transaction('recordings').objectStore('recordings').count(); q.onsuccess = () => resolve(q.result); }; }));
  expect(stored).toBe(1);
});

test('movement comparison keeps the trained 4DGS model as a secondary reference', async ({ page }) => {
  test.setTimeout(90000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: /^E Arms/ }).click();
  await page.getByRole('button', { name: /Shoulder range/ }).click();
  await page.getByRole('button', { name: 'Compare movement' }).click();
  const dialog = page.getByRole('dialog', { name: 'Movement' });
  await expect(dialog.locator('.movement-panel')).toBeVisible();
  await expect(dialog.locator('.gaussian-stage')).toHaveCount(0);
  await dialog.getByText('4DGS model · public reference', { exact: true }).click();
  const stage = dialog.locator('.gaussian-stage');
  await expect(stage).toHaveAttribute('data-model-status', 'ready', { timeout: 45000 });
  await dialog.locator('.technical-demo').getByLabel('Movement timeline', { exact: true }).fill('0.7');
  await expect(stage).toHaveAttribute('data-motion-phase', '0.700');
  await expect(dialog.getByText('Not crew data.')).toBeVisible();
  await dialog.getByText('4DGS model · public reference', { exact: true }).click();
  await expect(dialog.locator('.range-annotation')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Compare movement' })).toBeFocused();
});

test('the profile popup saves edits and preserves the current page and region', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const seg = page.getByRole('group', { name: 'Body shown' });
  // Demo crew member: 168 cm preflight, +3% spinal elongation in flight (NASA HIDH Table 4.3-4).
  await expect(seg.getByRole('button', { name: 'Preflight 168 cm' })).toHaveAttribute('aria-pressed', 'false');
  await expect(seg.getByRole('button', { name: /^Sol \d+ 173 cm$/ })).toHaveAttribute('aria-pressed', 'true');
  await seg.getByRole('button', { name: 'Preflight 168 cm' }).click();
  await expect(seg.getByRole('button', { name: 'Preflight 168 cm' })).toHaveAttribute('aria-pressed', 'true');

  await expect(page.locator('.crew-profile')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Profile', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /^H Legs/ }).click();
  // Editing floats above the selected region; it never replaces the health checks.
  const who = page.locator('.crew-switch-btn');
  await expect(who).toContainText('Alex Morgan');
  await who.click();
  await page.getByRole('button', { name: 'Edit profile' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit profile' });
  await expect(dialog).toBeVisible();
  await expect(page.locator('main')).toHaveAttribute('inert', '');
  await expect(page.locator('main .crew-profile')).toHaveCount(0);
  for (let i = 0; i < 18; i++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate(d => d.contains(document.activeElement))).toBe(true);
  }

  // Click the name to edit it; the plate and initials follow.
  await page.getByRole('button', { name: /Alex Morgan · edit name/ }).click();
  await page.getByLabel('Name', { exact: true }).fill('Sam Rivera');
  await page.keyboard.press('Enter');
  await expect(dialog.getByRole('heading', { name: /Sam Rivera/, level: 3 })).toBeVisible();
  await expect(who).toContainText('Sam Rivera');
  await expect(who).toContainText('SR');

  // Body facts edit in one list, with no Save buttons.
  await page.getByRole('group', { name: 'Avatar model' }).getByRole('button', { name: 'Male', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Avatar model' }).getByRole('button', { name: 'Male', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('Height').fill('188');
  await page.getByLabel('Height').press('Enter');
  await expect(page.getByLabel('Height')).toHaveValue('188');
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(who).toBeFocused();
  await expect(page.getByRole('button', { name: /^H Legs/ })).toHaveAttribute('aria-pressed', 'true');
  // The body uses the saved height: 188 cm preflight, 194 cm in flight.
  await expect(seg.getByRole('button', { name: 'Preflight 188 cm' })).toBeVisible();
  await expect(seg.getByRole('button', { name: /^Sol \d+ 194 cm$/ })).toBeVisible();
  await page.reload();
  await expect(seg.getByRole('button', { name: /^Sol \d+ 194 cm$/ })).toBeVisible();
  await page.locator('.crew-switch-btn').click();
  await page.getByRole('button', { name: 'Edit profile' }).click();
  await expect(page.getByLabel('Height')).toHaveValue('188');
  // Escape cancels a text edit before it closes the popup.
  await dialog.getByRole('button', { name: /Sam Rivera · edit name/ }).click();
  await dialog.getByLabel('Name', { exact: true }).fill('Unsaved name');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: /Sam Rivera · edit name/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(who).toBeFocused();
  await page.getByRole('button', { name: /^H Legs/ }).click();
  await expect(page.getByRole('heading', { name: 'Legs', level: 2 })).toBeVisible();
  // The same editor works on every other page without navigating away.
  for (const route of ['trends', 'report', 'mission']) {
    await page.goto(`/#${route}`);
    await who.click();
    await page.getByRole('button', { name: 'Edit profile' }).click();
    await expect(page).toHaveURL(new RegExp(`#${route}$`));
    await expect(dialog.getByLabel('Height')).toHaveValue('188');
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(who).toBeFocused();
    await expect(page).toHaveURL(new RegExp(`#${route}$`));
  }
  await page.goto('/#body');
  await expect(page.locator('.tag[data-region="head"]')).toHaveCSS('opacity', '1', { timeout: 20000 });
});

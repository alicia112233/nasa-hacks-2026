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
  await page.getByRole('button', { name: 'Plan follow-up' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Follow-up set: repeat this check tomorrow.')).toBeVisible();
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
  await page.getByRole('button', { name: /Attention/ }).click();
  await page.getByRole('button', { name: 'Start' }).click();
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
  await expect(page.getByRole('img', { name: /Done: \d+ ms/ })).toBeVisible();
});

test('stopping the attention task early saves nothing', async ({ page }) => {
  await personal(page);
  await page.getByRole('button', { name: /Attention/ }).click();
  await page.getByRole('button', { name: 'Start' }).click();
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
  await expect(dialog.getByRole('button', { name: '4DGS reference' })).toHaveAttribute('aria-pressed', 'true');
  const stage = dialog.locator('.gaussian-stage');
  await expect(stage).toHaveAttribute('data-model-status', 'ready', { timeout: 45000 });
  await dialog.getByLabel('Movement timeline', { exact: true }).fill('0.7');
  await expect(stage).toHaveAttribute('data-motion-phase', '0.700');
  await expect(dialog.getByText('Not crew data.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Pose comparison' }).click();
  await expect(dialog.locator('.range-annotation')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Compare movement' })).toBeFocused();
});

test('the crew profile reshapes the body, and preflight compares it with the 0g stature', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const seg = page.getByRole('group', { name: 'Body shown' });
  // Demo crew member: 168 cm preflight, +3% spinal elongation in flight (NASA HIDH Table 4.3-4).
  await expect(seg.getByRole('button', { name: 'Preflight 168 cm' })).toHaveAttribute('aria-pressed', 'false');
  await expect(seg.getByRole('button', { name: /^Sol \d+ 173 cm$/ })).toHaveAttribute('aria-pressed', 'true');
  await seg.getByRole('button', { name: 'Preflight 168 cm' }).click();
  await expect(seg.getByRole('button', { name: 'Preflight 168 cm' })).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('link', { name: 'Mission' }).click();
  await page.getByLabel('Sex').selectOption('male');
  await page.getByLabel('Height cm').fill('188');
  await page.getByLabel('Mass kg').fill('95');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('BMI 26.9')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Height cm')).toHaveValue('188');
  await page.getByRole('link', { name: 'Body' }).click();
  await expect(seg.getByRole('button', { name: /^Sol \d+ 194 cm$/ })).toBeVisible();
  await expect(page.locator('.tag[data-region="head"]')).toHaveCSS('opacity', '1', { timeout: 20000 });
});

import { test, expect } from '@playwright/test';

test('the top bar names who is shown on every page, and switching crew switches their body and records', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#body');
  const who = page.locator('.crew-switch-btn');
  await expect(who).toContainText('Alex Morgan');
  await expect(page.getByText(/MIN ONE WAY/)).toHaveCount(0);
  for (const name of ['Trends', 'Handoff', 'Mission']) {
    await page.getByRole('link', { name }).click();
    await expect(who).toContainText('Alex Morgan');
  }
  await page.getByRole('link', { name: 'Body' }).click();

  // Keyboard: the list opens on the current member, Escape closes it and returns focus.
  await who.focus();
  await page.keyboard.press('Enter');
  await expect(who).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('list', { name: 'Crew' }).getByRole('button', { name: /Alex Morgan/ })).toBeFocused();
  await expect(page.getByRole('list', { name: 'Crew' }).getByRole('button', { name: /Alex Morgan/ })).toHaveAttribute('aria-current', 'true');
  await page.keyboard.press('Escape');
  await expect(who).toHaveAttribute('aria-expanded', 'false');
  await expect(who).toBeFocused();

  // Jordan's demo history has the leg-outline trend, so the body opens on Legs, and his trends are his own.
  await who.click();
  await page.getByRole('list', { name: 'Crew' }).getByRole('button', { name: /Jordan Lee/ }).click();
  await expect(who).toContainText('Jordan Lee');
  await expect(page.getByRole('heading', { name: 'Legs', level: 2 })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Thigh breadth 6% below your ghost' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Body shown' }).getByRole('button', { name: 'Preflight 181 cm' })).toBeVisible();
  await page.getByRole('link', { name: 'Trends' }).click();
  await expect(page.getByRole('row', { name: /Attention/ })).not.toContainText('382');

  // A new member starts empty, named from the top bar, and their checks don't touch anyone else's.
  await who.click();
  await page.getByRole('button', { name: 'Add crew member' }).click();
  await expect(page.getByLabel('Name', { exact: true })).toBeFocused();
  await page.keyboard.type('Priya Nair');
  await page.keyboard.press('Enter');
  await expect(who).toContainText('Priya Nair');
  await expect(who).toContainText('PN');
  await page.getByRole('dialog', { name: 'Edit profile' }).getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page).toHaveURL(/#trends$/);
  await page.goto('/#mission');
  await page.getByRole('button', { name: 'My records', exact: true }).click();
  await page.getByRole('link', { name: 'Body' }).click();
  await page.getByRole('list', { name: 'Body regions' }).getByRole('button', { name: /^C Chest/ }).click();
  await page.getByRole('button', { name: /Resting heart rate/ }).click();
  await page.getByRole('spinbutton').fill('61');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Done: 61 bpm' })).toBeVisible();
  await page.reload();
  await expect(who).toContainText('Priya Nair');
  await page.getByRole('list', { name: 'Body regions' }).getByRole('button', { name: /^C Chest/ }).click();
  await expect(page.getByRole('img', { name: 'Done: 61 bpm' })).toBeVisible();
  await who.click();
  await page.getByRole('list', { name: 'Crew' }).getByRole('button', { name: /Alex Morgan/ }).click();
  await page.getByRole('list', { name: 'Body regions' }).getByRole('button', { name: /^C Chest/ }).click();
  await expect(page.getByRole('img', { name: 'Done: 61 bpm' })).toHaveCount(0);

  // Removing a member asks first, then removes them and their records.
  await who.click();
  await page.getByRole('list', { name: 'Crew' }).getByRole('button', { name: /Priya Nair/ }).click();
  await who.click();
  await page.getByRole('button', { name: 'Edit profile' }).click();
  await page.getByRole('button', { name: 'Remove from crew' }).click();
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(who).not.toContainText('Priya Nair');
  await who.click();
  await expect(page.getByRole('list', { name: 'Crew' }).getByRole('button')).toHaveCount(2);
});

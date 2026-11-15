import { test, expect } from '@playwright/test';

test('a region checklist shows progress, the next check, and finishes with reassess or hand off', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#mission');
  await page.getByRole('button', { name: 'My records', exact: true }).click();
  await page.getByRole('link', { name: 'Body' }).click();
  const regions = page.getByRole('list', { name: 'Body regions' });

  // Instrument checks stay outside the count: Chest has 3 actionable checks and a blood pressure row that needs a cuff.
  await regions.getByRole('button', { name: /^C Chest/ }).click();
  const progress = page.locator('.card-progress');
  await expect(progress).toContainText('0 of 3 complete');
  const begin = page.getByRole('button', { name: 'Begin', exact: true });
  await expect(begin).toHaveAccessibleDescription('Next: Resting heart rate');
  await expect(page.locator('li.next')).toContainText('Resting heart rate');
  await expect(page.locator('li.instrument .n')).toHaveText('');

  // Each save advances the count and the NEXT marker.
  await begin.click();
  await page.getByRole('spinbutton').fill('62');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(progress).toContainText('1 of 3 complete');
  await expect(page.locator('li.next')).toContainText('Short of breath');
  await page.getByRole('group', { name: 'Short of breath' }).getByRole('button', { name: /None/ }).click();
  await expect(progress).toContainText('2 of 3 complete');
  await page.getByRole('group', { name: 'Joint pain after a spacewalk' }).getByRole('button', { name: /None/ }).click();

  // Finished: the done panel sends you to the next region with checks left; nothing is pending, so there is no Begin.
  await expect(progress).toContainText('3 of 3 complete');
  const done = page.getByRole('status', { name: 'Chest complete' });
  await expect(done).toContainText('All 3 done.');
  await expect(page.getByRole('button', { name: /^(Begin|Continue)$/ })).toHaveCount(0);
  await expect(done.getByRole('button', { name: 'Reassess tomorrow' })).toHaveCount(0);
  await done.getByRole('button', { name: /^Next: A Head/ }).click();
  await expect(page.getByRole('heading', { name: 'Head', level: 2 })).toBeVisible();

  // A region with no self-checks is reference only.
  await page.getByRole('link', { name: 'Body' }).click();
  await regions.getByRole('button', { name: /^I Cabin/ }).click();
  await expect(page.locator('.card-time')).toHaveText('Reference');
  await expect(page.locator('.card-progress')).toHaveCount(0);
});

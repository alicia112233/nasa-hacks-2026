import { test, expect } from '@playwright/test';

test('checks explain how and why, results say what they mean, and off readings give plain next steps', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // A demo trend: the steps say what to do, with a way to act on each.
  await page.goto('/#body');
  const note = page.getByRole('status').filter({ hasText: 'Response 18% slower than your ghost' });
  await expect(note).toContainText('Trend');
  const steps = note.getByRole('list', { name: 'What to do' });
  await expect(steps.getByRole('listitem')).toHaveCount(3);
  await expect(steps).toContainText('Retake it after a rest');
  await expect(steps.getByRole('button', { name: 'Retake' })).toBeVisible();
  await expect(steps.getByRole('button', { name: 'Plan follow-up' })).toBeVisible();

  // An opened check says how to take it and why it matters.
  await page.goto('/#mission');
  await page.getByRole('button', { name: 'My records', exact: true }).click();
  await page.getByRole('link', { name: 'Body' }).click();
  await page.getByRole('list', { name: 'Body regions' }).getByRole('button', { name: /^C Chest/ }).click();
  await page.getByRole('button', { name: 'Begin', exact: true }).click();
  await expect(page.locator('.how-why')).toContainText('Rest 5 min. Count your wrist pulse for 30 s and double it.');
  await expect(page.locator('.how-why')).toContainText('Fluid shifts and deconditioning change heart rate in flight.');

  // A clearly off value says what to do; a strong symptom escalates to act now, with hand off one press away.
  await page.getByRole('spinbutton').fill('108');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('button', { name: /Resting heart rate/ })).toContainText('high at rest: rest 5 min, recheck');
  await page.getByRole('group', { name: 'Short of breath' }).getByRole('button', { name: /Strong/ }).click();
  const urgent = page.getByRole('status').filter({ hasText: 'short of breath (strong)' });
  await expect(urgent).toContainText('Act now');
  await expect(urgent).toContainText('Stop what you are doing and tell a crewmate.');
  await urgent.getByRole('button', { name: 'Hand off' }).click();
  await expect(page.getByLabel('Observation for medical team')).toHaveValue(/^C Chest: 2 of 3 checks done today\. Reported short of breath \(strong\)\./);
});

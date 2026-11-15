import type { Page } from '@playwright/test';

type Answer = 'Clear' | 'Blurry' | 'Can’t see';

/** Run the Eyes check's letter chart: answers for the left eye, then the right, then save the result. */
export async function eyeTest(page: Page, left: Answer[], right: Answer[]) {
  const answer = (a: Answer) => page.getByRole('group', { name: /^Can you read line \d\?$/ }).getByRole('button', { name: a, exact: true }).click();
  for (const a of left) await answer(a);
  await page.getByRole('button', { name: 'Start right eye' }).click();
  for (const a of right) await answer(a);
  await page.getByRole('button', { name: 'Save result' }).click();
}

export const ALL_CLEAR: Answer[] = Array(6).fill('Clear');

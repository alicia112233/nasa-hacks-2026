import type { Locator, Page } from '@playwright/test';

export async function fillCarePlan(target: Page | Locator, next = 'Repeat the recorded check under matching conditions') {
  await target.getByLabel('What needs checking again', { exact: true }).fill(next);
  const future = new Date(Date.now() + 8 * 3600000 + 2 * 3600000).toISOString().slice(0, 16);
  await target.getByLabel('Reassess at', { exact: true }).fill(future);
  await target.getByLabel('Information still missing', { exact: true }).fill('Symptom onset time not yet confirmed.');
}

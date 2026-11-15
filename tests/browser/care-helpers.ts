import type { Locator, Page } from '@playwright/test';

/** Open a collapsed section of the Report page's Hand off sheet (Follow-up plan, Link). */
export async function openSection(target: Page | Locator, selector: 'details.report-plan' | 'details.report-link') {
  const section = target.locator(selector);
  if (await section.count() && !(await section.evaluate(d => (d as HTMLDetailsElement).open))) await section.locator('summary').click();
}

export async function fillCarePlan(target: Page | Locator, next = 'Repeat the recorded check under matching conditions') {
  await openSection(target, 'details.report-plan');
  await target.getByLabel('What needs checking again', { exact: true }).fill(next);
  const future = new Date(Date.now() + 8 * 3600000 + 2 * 3600000).toISOString().slice(0, 16);
  await target.getByLabel('Reassess at', { exact: true }).fill(future);
  await target.getByLabel('Information still missing', { exact: true }).fill('Symptom onset time not yet confirmed.');
}

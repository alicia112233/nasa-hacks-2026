import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('mission overview renders 3D, evidence, scheduled actions, and a report', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Crew health overview.' })).toBeVisible();
  await expect(page.getByText('Saved on device')).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(1);
  await expect(page.getByText('2 things to explore')).toBeVisible();
  await page.getByRole('button', { name: 'Pause playback' }).click();
  await page.screenshot({ path: 'test-results/ghostpilot-desktop.png', fullPage: true });
  await page.getByRole('button', { name: /Explore the evidence/ }).click();
  await expect(page.getByRole('dialog')).toContainText('Simulated mission evidence');
  await expect(page.getByRole('dialog')).toContainText('What remains uncertain');
  await page.getByLabel('Review camera position and comparable conditions').check();
  await page.getByPlaceholder('Record your action and anything you want to reassess…').fill('Repeat at the same distance after rest.');
  await page.getByRole('button', { name: 'Log action & schedule check' }).click();
  await page.getByRole('button', { name: 'Action log', exact: false }).first().click();
  await expect(page.getByRole('heading', { name: 'Repeat standardized movement' })).toBeVisible();
  await page.getByRole('button', { name: 'Mark complete' }).click();
  await expect(page.getByRole('button', { name: 'Reopen', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Saved on device')).toBeVisible();
  await page.getByRole('button', { name: 'Action log', exact: false }).first().click();
  await expect(page.getByText('Repeat at the same distance after rest.')).toBeVisible();
  await page.getByRole('button', { name: 'Prepare report', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('SIMULATED DEMONSTRATION');
  await expect(page.getByRole('dialog')).toContainText('Research resources and use');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download report' }).click();
  const reportFile = await download;
  expect(reportFile.suggestedFilename()).toContain('report.md');
  const markdown = await readFile((await reportFile.path())!, 'utf8');
  expect(markdown).toContain('https://www.nasa.gov/hrp/ongoing-hrp-research/');
  expect(markdown).toContain('https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp');
  const jsonDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'JSON data' }).click();
  const structured = JSON.parse(await readFile((await (await jsonDownload).path())!, 'utf8'));
  expect(structured.research.externalMeasurementsImported).toBe(false);
  expect(structured.sources.some((source: { id: string }) => source.id === 'hazards')).toBe(true);
  expect(errors).toEqual([]);
});

test('docking game records real inputs and persists the simulated crew check', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start flight check', exact: true }).click();
  await page.getByLabel('Use a 15-second demo').check();
  await page.getByRole('button', { name: 'Begin demo' }).click();
  for (let i = 0; i < 5; i++) {
    await page.getByRole('button', { name: 'Respond to docking signal' }).waitFor();
    await page.keyboard.press('Space');
  }
  await expect(page.getByText('Docking check complete')).toBeVisible({ timeout: 20000 });
  await page.getByRole('button', { name: 'Sleep quality: 2 Low', exact: true }).click();
  await page.getByRole('button', { name: 'Energy: 2 Low', exact: true }).click();
  await page.getByRole('button', { name: 'Fatigue', exact: true }).click();
  await page.getByLabel('Heart rate', { exact: true }).fill('66');
  await page.getByPlaceholder('Anything worth remembering?').fill('Automated demo check-in');
  await page.getByRole('button', { name: 'Save my check-in' }).click();
  await expect(page.getByRole('heading', { name: 'You’re checked in.' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to my mission' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Personal trends' }).click();
  await expect(page.getByText('15 simulated entries')).toBeVisible();
  await page.getByRole('button', { name: 'Sleep', exact: true }).click();
  await page.getByRole('button', { name: 'Last 14 days' }).click();
  await expect(page.getByRole('button', { name: 'Last 7 days' })).toBeVisible();
});

test('personal data mode excludes all simulated trends and can reload the demo', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Switch to my data' }).click();
  await expect(page.getByText('A quiet radar.')).toBeVisible();
  await expect(page.getByText('0 baseline check-ins')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your next chapter starts with a movement.' })).toBeVisible();
  await page.getByRole('button', { name: 'Personal trends' }).click();
  await expect(page.getByText('0 personal entries')).toBeVisible();
  await page.getByRole('button', { name: 'Alex Morgan Mission specialist' }).click();
  await page.getByLabel('Crew name').fill('Jordan Lee');
  await page.getByRole('button', { name: 'Save mission settings' }).click();
  await expect(page.getByRole('button', { name: 'Jordan Lee Mission specialist' })).toBeVisible();
  await page.getByRole('button', { name: 'Jordan Lee Mission specialist' }).click();
  await page.getByRole('button', { name: 'Load simulated history' }).click();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await expect(page.getByText('14 simulated entries')).toBeVisible();
});

test('movement capture uses a local model and retains an original video', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('/');
  await page.getByRole('button', { name: 'Movement diary', exact: false }).first().click();
  await page.getByRole('button', { name: 'Record movement', exact: true }).click();
  await page.getByRole('button', { name: 'Enable camera & pose tracking' }).click();
  await expect(page.getByRole('button', { name: 'Record 12-second movement' })).toBeVisible({ timeout: 35000 });
  await page.getByRole('button', { name: 'Record 12-second movement' }).click();
  await expect(page.getByRole('button', { name: 'Stop & save recording' })).toBeVisible();
  await page.getByRole('button', { name: 'Stop & save recording' }).click();
  await expect(page.getByText('Movement saved to your diary.')).toBeVisible();
  await page.getByRole('button', { name: 'Open movement diary' }).click();
  await expect(page.getByText('1 personal recordings')).toBeVisible();
  await page.getByRole('button', { name: 'Review original source' }).click();
  await expect(page.locator('video[controls]')).toBeVisible();
});

test('mobile dashboard and navigation fit the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Crew health overview.' })).toBeVisible();
  const widths = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  expect(widths.content).toBeLessThanOrEqual(widths.viewport);
  await page.screenshot({ path: 'test-results/ghostpilot-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('button', { name: 'Movement diary', exact: false }).first().click();
  await expect(page.getByRole('heading', { name: 'Every movement tells a story.' })).toBeVisible();
});

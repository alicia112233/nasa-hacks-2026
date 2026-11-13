import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { writeFile } from 'node:fs/promises';

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader'] });
const results = [];
for (const viewport of [{ width: 1024, height: 600 }, { width: 320, height: 568 }]) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  const page = await context.newPage();
  for (const route of ['overview', 'lens', 'movement', 'flight', 'insights', 'actions']) {
    await page.goto(`http://127.0.0.1:5173/#${route}`);
    await page.locator('main h1').waitFor();
    const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    const overflow = await page.evaluate(() => ({ width: window.innerWidth, scroll: document.documentElement.scrollWidth, elements: [...document.querySelectorAll('main *')].filter(el => el.getBoundingClientRect().right > window.innerWidth + 1 && el.getClientRects().length).slice(0, 12).map(el => `${el.tagName}.${el.className}`) }));
    results.push({ viewport, route, overflow, violations: scan.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })) });
    if (route === 'overview') await page.screenshot({ path: `test-results/overview-${viewport.width}.png` });
  }
  await page.goto('http://127.0.0.1:5173/');
  await page.getByRole('button', { name: 'Start flight check', exact: true }).click();
  await page.getByRole('button', { name: 'Continue without attention task' }).click();
  await page.getByLabel('Heart rate', { exact: true }).fill('220');
  await page.getByPlaceholder('Anything worth remembering?').fill('Crew check under standard mission conditions.');
  await page.screenshot({ path: `test-results/check-in-${viewport.width}.png` });
  const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  results.push({ viewport, route: 'crew-form', violations: scan.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })) });
  await context.close();
}
await browser.close();
await writeFile('test-results/accessibility-audit.json', JSON.stringify(results, null, 2));
for (const r of results) console.log(`${r.viewport.width} ${r.route}: ${r.violations.map(v => `${v.id} (${v.nodes.length})`).join(', ') || 'no violations'}; page width ${r.overflow?.scroll ?? 'dialog'}`);

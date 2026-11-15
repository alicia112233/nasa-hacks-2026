import { chromium } from 'file:///c:/Users/alici/Downloads/nasa-hacks/node_modules/playwright/index.mjs';
import { pathToFileURL } from 'node:url';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(pathToFileURL(process.cwd() + '/slides.html').href);
await page.evaluate(() => document.fonts.ready);
for (let i = 1; i <= 7; i++) { await page.evaluate(n => window.show(n), i); await page.waitForTimeout(300); await page.screenshot({ path: `slides/s${i}.png` }); }
await browser.close(); console.log('done');

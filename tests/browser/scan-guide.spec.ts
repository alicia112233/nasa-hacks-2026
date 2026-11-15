import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function audioProbe(page: Page, blocked = false) {
  await page.addInitScript(initiallyBlocked => {
    const probe = window as unknown as { scanAudio: { played: string[]; pauses: number; blocked: boolean } };
    probe.scanAudio = { played: [], pauses: 0, blocked: initiallyBlocked };
    const play = HTMLMediaElement.prototype.play, pause = HTMLMediaElement.prototype.pause;
    HTMLMediaElement.prototype.play = function () {
      if (!(this instanceof HTMLAudioElement)) return play.call(this);
      probe.scanAudio.played.push(this.getAttribute('src') ?? '');
      return probe.scanAudio.blocked ? Promise.reject(new DOMException('Playback needs a gesture', 'NotAllowedError')) : Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function () {
      if (this instanceof HTMLAudioElement) probe.scanAudio.pauses++;
      return pause.call(this);
    };
  }, blocked);
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 1024, height: 600 }]) {
  test(`scan fills the window with a large centered guide at ${viewport.width} × ${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await audioProbe(page);
    await page.goto('/');
    const trigger = page.getByRole('button', { name: 'Scan me', exact: true });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Body scan · 5 s', exact: true });
    const heading = dialog.getByRole('heading', { name: 'Step back', exact: true });
    await expect(heading).toBeVisible({ timeout: 20000 });
    const bounds = await dialog.boundingBox();
    expect(bounds).toMatchObject({ x: 0, y: 0, width: viewport.width, height: viewport.height });
    const camera = await dialog.locator('.scan-camera').boundingBox();
    const prompt = await dialog.locator('.scan-prompt').boundingBox();
    expect(Math.abs(prompt!.x + prompt!.width / 2 - viewport.width / 2)).toBeLessThan(2);
    expect(Math.abs(prompt!.y + prompt!.height / 2 - (camera!.y + camera!.height / 2))).toBeLessThan(40);
    expect(await heading.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(36);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(dialog.getByRole('button', { name: 'Close body scan' })).toBeInViewport();
    await expect(dialog.getByRole('button', { name: /^Voice guide (on|off)$/ })).toBeInViewport();
    const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect(audit.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.failureSummary) }))).toEqual([]);
    await page.screenshot({ path: `test-results/scan-guide-${viewport.width}.png` });
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
}

test('spoken positioning can be repeated, muted across visits, and stopped when closing the scan', async ({ page }) => {
  await audioProbe(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Scan me', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Body scan · 5 s', exact: true });
  await expect(dialog.getByRole('heading', { name: 'Step back', exact: true })).toBeVisible({ timeout: 20000 });
  await expect.poll(() => page.evaluate(() => (window as unknown as { scanAudio: { played: string[] } }).scanAudio.played)).toContain('/audio/scan/step-back.wav');
  const before = await page.evaluate(() => (window as unknown as { scanAudio: { played: string[] } }).scanAudio.played.length);
  await dialog.getByRole('button', { name: 'Repeat instruction' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { scanAudio: { played: string[] } }).scanAudio.played.length)).toBeGreaterThan(before);
  await dialog.getByRole('button', { name: /^Voice guide (on|off)$/ }).click();
  await expect(dialog.getByRole('button', { name: /^Voice guide (on|off)$/ })).toHaveAttribute('aria-pressed', 'false');
  await expect(dialog.getByRole('button', { name: 'Repeat instruction' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await page.reload();
  await page.getByRole('button', { name: 'Scan me', exact: true }).click();
  await expect(dialog.getByRole('button', { name: /^Voice guide (on|off)$/ })).toHaveAttribute('aria-pressed', 'false');
  await dialog.getByRole('button', { name: /^Voice guide (on|off)$/ }).click();
  await expect(dialog.getByRole('button', { name: /^Voice guide (on|off)$/ })).toHaveAttribute('aria-pressed', 'true');
  const pauses = await page.evaluate(() => (window as unknown as { scanAudio: { pauses: number } }).scanAudio.pauses);
  await dialog.getByRole('button', { name: 'Close body scan' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { scanAudio: { pauses: number } }).scanAudio.pauses)).toBeGreaterThan(pauses);
});

test('blocked audio offers an explicit playback action and denied fullscreen keeps the full-window guide', async ({ page }) => {
  await audioProbe(page, true);
  await page.addInitScript(() => {
    Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: true });
    Element.prototype.requestFullscreen = () => Promise.reject(new DOMException('Unavailable here', 'NotAllowedError'));
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Scan me', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Body scan · 5 s', exact: true });
  await expect(dialog.getByText('Tap Enable voice guide before stepping back.', { exact: true })).toBeVisible();
  await page.evaluate(() => { (window as unknown as { scanAudio: { blocked: boolean } }).scanAudio.blocked = false; });
  await dialog.getByRole('button', { name: 'Enable voice guide', exact: true }).click();
  await expect(dialog.getByText('Tap Enable voice guide before stepping back.', { exact: true })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Full screen', exact: true }).click();
  await expect(dialog.getByText('Full screen is unavailable here. The scan still fills this window.', { exact: true })).toBeVisible();
  expect((await dialog.boundingBox())!.width).toBe(1440);
});

test('the scan closes only the browser fullscreen session it opened', async ({ page }) => {
  await audioProbe(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Scan me', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Body scan · 5 s', exact: true });
  await dialog.getByRole('button', { name: 'Full screen', exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement === document.documentElement)).toBe(true);
  await dialog.getByRole('button', { name: 'Close body scan', exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
});

test('all spoken prompts are playable files in the production offline cache', async ({ page, context }) => {
  await page.goto('http://127.0.0.1:4173/');
  await expect(page.getByRole('button', { name: 'Scan me', exact: true })).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise<void>(resolve => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }));
  });
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: 'Scan me', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Step back', exact: true })).toBeVisible({ timeout: 20000 });
  const files = ['prepare', 'step-back', 'stand-straight', 'arms-out', 'arms-lower', 'ready', 'scanning', 'more-frames', 'complete', 'retry', 'camera-error', 'height', 'three', 'two', 'one'];
  const decoded = await page.evaluate(async ids => {
    const audio = new AudioContext();
    try {
      return await Promise.all(ids.map(async id => {
        const response = await fetch(`/audio/scan/${id}.wav`);
        const clip = await audio.decodeAudioData(await response.arrayBuffer());
        return { id, status: response.status, duration: clip.duration };
      }));
    } finally { await audio.close(); }
  }, files);
  for (const clip of decoded) {
    expect(clip.status, clip.id).toBe(200);
    expect(clip.duration, clip.id).toBeGreaterThan(0.25);
  }
});

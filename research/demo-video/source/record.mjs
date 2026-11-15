// Records the GhostPilot demo: scripted cursor, real clicks, CDP screencast frames + a camera/zoom timeline.
import { chromium } from 'file:///c:/Users/alici/Downloads/nasa-hacks/node_modules/playwright/index.mjs';
import { mkdirSync, writeFileSync, writeFile, rmSync } from 'node:fs';

const OUT = 'rec';
rmSync(OUT, { recursive: true, force: true }); mkdirSync(`${OUT}/frames`, { recursive: true });
const DSF = 1.5;
const SLOW = 2; // record at half speed, compress in post
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist', '--force-device-scale-factor=1.5', '--use-angle=d3d11', '--enable-gpu'] });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: DSF, timezoneId: 'Asia/Singapore', acceptDownloads: true });
await ctx.addInitScript(() => {
  localStorage.setItem('ghostpilot-tutorial-v1', 'seen');
  const install = () => {
    if (document.getElementById('demo-cursor')) return;
    const st = document.createElement('style');
    st.textContent = `
      #demo-cursor{position:fixed;left:0;top:0;width:30px;height:30px;z-index:2147483647;pointer-events:none;will-change:transform;filter:drop-shadow(0 2px 3px rgba(0,0,0,.45))}
      #demo-cursor svg{display:block;transition:transform .18s ease-out;transform-origin:4px 3px}
      #demo-cursor.down svg{transform:scale(.82)}
      .demo-ripple{position:fixed;z-index:2147483646;pointer-events:none;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;border:3px solid #c8102e;background:rgba(200,16,46,.18);animation:demoRip 1.1s cubic-bezier(.2,.7,.3,1) forwards}
      @keyframes demoRip{from{transform:scale(.4);opacity:1}to{transform:scale(4.2);opacity:0}}`;
    document.head.appendChild(st);
    const c = document.createElement('div'); c.id = 'demo-cursor';
    c.innerHTML = `<svg width="30" height="30" viewBox="0 0 30 30"><path d="M4 3 L4 24 L9.5 18.6 L13.2 27 L17 25.4 L13.4 17.2 L21 17.2 Z" fill="#fff" stroke="#111" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
    document.body.appendChild(c);
    let pos = { x: 1500, y: 900 };
    const place = () => { c.style.transform = `translate(${pos.x - 4}px, ${pos.y - 3}px)`; };
    place();
    const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    window.__cur = {
      get: () => pos,
      moveTo: (x, y, ms) => new Promise(res => {
        const a = { ...pos }, t0 = performance.now();
        // slight arc so it feels hand-driven
        const dx = x - a.x, dy = y - a.y, len = Math.hypot(dx, dy) || 1, bow = Math.min(60, len * .12);
        const nx = -dy / len * bow, ny = dx / len * bow;
        const step = () => {
          const k = Math.min(1, (performance.now() - t0) / ms), e = ease(k), arc = Math.sin(Math.PI * e);
          pos = { x: a.x + dx * e + nx * arc, y: a.y + dy * e + ny * arc }; place();
          k < 1 ? requestAnimationFrame(step) : res();
        };
        requestAnimationFrame(step);
      }),
      click: () => {
        c.classList.add('down'); setTimeout(() => c.classList.remove('down'), 280);
        const r = document.createElement('div'); r.className = 'demo-ripple';
        r.style.left = pos.x + 'px'; r.style.top = pos.y + 'px';
        document.body.appendChild(r); setTimeout(() => r.remove(), 1400);
      },
    };
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
});

const page = await ctx.newPage();
console.log('launched'); setTimeout(() => { console.log('TIMEOUT'); process.exit(2); }, 150000);
await page.goto('http://127.0.0.1:5173/#body');
console.log('loaded');
await page.waitForFunction(() => !!window.__cur);
await page.waitForTimeout(5000); // body model + fonts
await page.mouse.move(1500, 900);

// ---- screencast ----
const cdp = await ctx.newCDPSession(page);
const frames = [];
cdp.on('Page.screencastFrame', async f => {
  const idx = frames.length; frames.push({ ts: f.metadata.timestamp });
  writeFile(`${OUT}/frames/${String(idx).padStart(5, '0')}.jpg`, Buffer.from(f.data, 'base64'), () => {});
  cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
});
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1920 * DSF, maxHeight: 1080 * DSF, everyNthFrame: 1 });
// keep the compositor producing frames even when idle (a 1px invisible ticker)
await page.evaluate(() => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;left:0;bottom:0;width:1px;height:1px;opacity:.01;z-index:2147483647;pointer-events:none'; document.body.appendChild(d); let i = 0; const tick = () => { d.style.background = (i++ % 2) ? '#000' : '#111'; requestAnimationFrame(tick); }; tick(); });
await page.waitForTimeout(600);

const events = [];
const T0 = Date.now() / 1000;
const now = () => (Date.now() / 1000 - T0) / SLOW;
const until = async t => { const w = (t - now()) * 1000 * SLOW; if (w > 0) await page.waitForTimeout(w); };
const cam = (z, cx, cy, dur) => events.push({ type: 'cam', t: now(), z, cx, cy, dur });
const move = async (x, y, ms) => {
  const p = page.evaluate(([x, y, ms]) => window.__cur.moveTo(x, y, ms), [x, y, ms * SLOW]);
  await p;
  await page.mouse.move(x, y, { steps: 2 });
};
const click = async (x, y) => {
  events.push({ type: 'click', t: now(), x, y });
  await page.evaluate(() => window.__cur.click());
  await page.mouse.click(x, y);
};
const center = async loc => { const b = await loc.boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };

// ---- beat 1: Today + flagged head (0 – 2.9) ----
console.log("beat 1", now().toFixed(2), "frames", frames.length);
cam(1.0, 960, 540, 0);
await until(0.25); cam(1.22, 930, 470, 1.4);
await until(0.5); await move(563, 262, 1500);
// ---- beat 2: tap the head → what changed + what to do (2.9 – 6.0) ----
console.log("beat 2", now().toFixed(2), "frames", frames.length);
await until(2.7); await click(563, 262);
await until(2.95); cam(1.6, 1290, 345, 0.9);
await until(3.5); await move(1060, 368, 700);
await until(4.6); await move(1180, 400, 600);
// ---- beat 3: every check: how + why (6.0 – 8.9) ----
console.log("beat 3", now().toFixed(2), "frames", frames.length);
const sleepStep = page.locator('button.step').filter({ hasText: 'Sleep quality' }).first();
const [sx, sy] = await center(sleepStep);
await until(5.6); cam(1.45, 1230, 600, 0.8); await move(sx - 220, sy, 650);
await until(6.4); await click(sx - 220, sy);
await until(6.7); cam(1.7, 1180, 670, 0.7);
await until(7.0); await move(1050, 656, 500);
await until(7.9); await move(1050, 682, 300);
// ---- beat 4: Trends, you vs your ghost (8.9 – 13.4) ----
console.log("beat 4", now().toFixed(2), "frames", frames.length);
await until(8.8); cam(1.0, 960, 540, 0.6); await move(278, 28, 650);
await until(9.55); await click(278, 28);
await page.waitForTimeout(250 * SLOW);
const sleepBtn = page.locator('table').first().getByRole('button', { name: 'Sleep', exact: true });
const [bx, by] = await center(sleepBtn);
await move(bx, by, 550);
await until(10.5); await click(bx, by);
await until(10.75); cam(1.5, 1265, 525, 0.9);
await until(11.2); await move(1180, 610, 700);
await until(12.2); await move(1560, 470, 800);
// ---- beat 5: zero-g reshapes the body (13.4 – 16.3) ----
console.log("beat 5", now().toFixed(2), "frames", frames.length);
await until(13.3); cam(1.0, 960, 540, 0.5); await move(204, 28, 500);
await until(13.9); await click(204, 28);
await page.waitForTimeout(200 * SLOW);
await move(316, 792, 450);
await until(14.65); await click(316, 792); cam(1.55, 520, 470, 0.8);
await until(15.45); await move(425, 792, 300);
await until(15.8); await click(425, 792);
// ---- beat 6: real ISS data from NASA (16.3 – 19.2) ----
console.log("beat 6", now().toFixed(2), "frames", frames.length);
await until(16.25); cam(1.0, 960, 540, 0.5); await move(733, 940, 500);
await until(16.8); await click(733, 940);
await until(17.05); cam(1.42, 1270, 760, 0.8);
await until(17.5); await move(1150, 745, 600);
await until(18.3); await move(1500, 752, 700);
// ---- beat 7: one report for the next comms window (19.2 – 23.0) ----
console.log("beat 7", now().toFixed(2), "frames", frames.length);
await until(19.2); cam(1.0, 960, 540, 0.5); await move(360, 28, 500);
await until(19.75); await click(360, 28);
await page.waitForTimeout(250 * SLOW);
const hand = page.getByRole('button', { name: /Hand off today/i });
const [hx, hy] = await center(hand);
await move(hx, hy, 600); cam(1.5, 1385, 330, 0.9);
await until(21.0); await click(hx, hy);
await until(21.6); await move(hx + 40, hy - 150, 700);
await until(23.6);

await cdp.send('Page.stopScreencast');
await page.waitForTimeout(300);
await new Promise(r => setTimeout(r, 1500)); // let pending frame writes finish
writeFileSync(`${OUT}/timeline.json`, JSON.stringify({ T0, frames: frames.map((f, i) => ({ i, t: (f.ts - T0) / SLOW })), events }, null, 1));
console.log('frames', frames.length, 'span', (frames.at(-1).ts - frames[0].ts).toFixed(2), 's  late?', now().toFixed(2));
await browser.close();

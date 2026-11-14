/**
 * Calibrate the body scan with the app's own pose model.
 *
 * scripts/blender/build_body.py renders every basis body shape as 640 x 480 camera frames in the scan pose
 * (.cache/scan-frames). This script runs the bundled MediaPipe Pose Landmarker (lite, CPU, with the person mask,
 * the same options as src/pose.ts) on each frame in headless Chrome, measures it with src/scan.mjs, and writes:
 *  - src/body-calibration.mjs: the reference body's ratios, how each morph changes them, and the arm-angle slope;
 *  - tests/fixtures/scan-holdout.json: scans of bodies left out of the calibration, with the shape they should give.
 *
 *   node scripts/calibrate-scan.mjs
 */
import { chromium } from 'playwright';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const framesDir = process.env.SCAN_FRAMES || join(root, '.cache', 'scan-frames');
const manifest = JSON.parse(readFileSync(join(framesDir, 'manifest.json'), 'utf8'));
const calibrationFile = join(root, 'src', 'body-calibration.mjs');
if (!existsSync(calibrationFile)) writeFileSync(calibrationFile, 'export default { pose: { armsFromVertical: 30 }, reference: [1, 1, 1], armSlope: [0, 0, 0], deltas: {} };\n');
const { MEASURES, frameIssue, summarise, solveScan } = await import(pathToFileURL(join(root, 'src', 'scan.mjs')).href);
const { physique } = await import(pathToFileURL(join(root, 'src', 'physique.mjs')).href);

const ARMS = 30;
const CROSS = ['heavy', 'light', 'muscular', 'slight'];
const OWN = MEASURES.flatMap(m => [`${m}_wide`, `${m}_narrow`]);
/** Bodies left out of the calibration: the profile a crew member would enter, and the scan morphs they should get. */
const HOLDOUT = {
  holdout_female_heavier: { body: 'female, weight macro 0.8', profile: { sex: 'female', heightCm: 160, massKg: 72.2 }, expected: { shoulders: 0, waist: 0, hips: 0 } },
  holdout_shoulders_wide_hips_narrow: { body: 'reference, shoulders +0.5, hips -0.5', profile: {}, expected: { shoulders: 0.5, waist: 0, hips: -0.5 } },
  holdout_muscular_woman_waist_narrow: { body: 'female, muscle macro 0.88, waist -0.6', profile: { sex: 'female', build: 'muscular' }, expected: { shoulders: 0, waist: -0.6, hips: 0 } },
};

const types = { '.mjs': 'text/javascript', '.js': 'text/javascript', '.wasm': 'application/wasm', '.png': 'image/png', '.html': 'text/html' };
const served = {
  '/index.html': { text: '<!doctype html><meta charset="utf-8"><title>scan calibration</title>' },
  '/vision.mjs': { file: join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'vision_bundle.mjs') },
  '/scan.mjs': { file: join(root, 'src', 'scan.mjs') },
  '/body-calibration.mjs': { text: 'export default {};' },
  '/models/pose_landmarker_lite.task': { file: join(root, 'public', 'models', 'pose_landmarker_lite.task') },
};
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
await page.route('http://calibrate.local/**', route => {
  const path = decodeURIComponent(new URL(route.request().url()).pathname);
  const entry = served[path] ?? (path.startsWith('/wasm/') ? { file: join(root, 'public', path) }
    : path.startsWith('/frames/') ? { file: join(framesDir, path.slice('/frames/'.length)) } : null);
  if (!entry) return route.fulfill({ status: 404 });
  return route.fulfill({ status: 200, contentType: types[extname(path)] ?? 'application/octet-stream', body: entry.text ?? readFileSync(entry.file) });
});
await page.goto('http://calibrate.local/index.html');
const measured = await page.evaluate(async frames => {
  const { FilesetResolver, PoseLandmarker } = await import('/vision.mjs');
  const { measureFrame } = await import('/scan.mjs');
  const vision = await FilesetResolver.forVisionTasks('/wasm');
  const landmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: '/models/pose_landmarker_lite.task', delegate: 'CPU' },
    runningMode: 'IMAGE', numPoses: 1, minPoseDetectionConfidence: .6, minTrackingConfidence: .6, outputSegmentationMasks: true,
  });
  const out = [];
  for (const f of frames) {
    const img = new Image();
    img.src = '/frames/' + f.file;
    await img.decode();
    const r = landmarker.detect(img);
    const pose = r.landmarks[0], mask = r.segmentationMasks?.[0];
    out.push(pose && mask ? measureFrame(mask.getAsFloat32Array(), mask.width, mask.height, pose) : null);
    r.close();
  }
  landmarker.close();
  return out;
}, manifest.frames);
await browser.close();

const rows = manifest.frames.map((f, i) => ({ ...f, m: measured[i] }));
const byShape = {};
for (const r of rows) (byShape[r.shape] ??= []).push(r);
const usable = list => list.filter(r => r.m && !frameIssue(r.m));
const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
const median = xs => { const s = [...xs].sort((a, b) => a - b); const k = s.length >> 1; return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; };
const round = (x, d = 5) => Math.round(x * 10 ** d) / 10 ** d;

// Arm-angle slope of each ratio, pooled within the calibration shapes (MediaPipe's own arm angle, not the rendered one).
const shapes = Object.keys(byShape).filter(s => !s.startsWith('holdout_'));
const armSlope = MEASURES.map(k => {
  let num = 0, den = 0;
  for (const s of shapes) {
    const list = usable(byShape[s]);
    const a = mean(list.map(r => r.m.armAngle)), v = mean(list.map(r => r.m[k]));
    for (const r of list) { num += (r.m.armAngle - a) * (r.m[k] - v); den += (r.m.armAngle - a) ** 2; }
  }
  return den ? num / den : 0;
});
const base = {};
for (const s of shapes) {
  const list = usable(byShape[s]);
  if (list.length < 5) throw new Error(`${s}: only ${list.length} usable frames`);
  base[s] = MEASURES.map((k, j) => median(list.map(r => r.m[k] - armSlope[j] * (r.m.armAngle - ARMS))));
}
const sub = (a, b) => a.map((x, j) => x - b[j]);
const r0 = base.reference;
const deltas = { female: sub(base.female, r0) };
for (const k of CROSS) deltas[k] = sub(base[`m_${k}`], r0);
for (const k of CROSS) deltas[`female_${k}`] = sub(sub(base[`f_${k}`], base.female), deltas[k]);
for (const k of OWN) deltas[k] = sub(base[k], r0);
const noise = MEASURES.map(k => { const xs = usable(byShape.reference).map(r => r.m[k]); const m = mean(xs); return Math.sqrt(mean(xs.map(x => (x - m) ** 2))); });

const calibration = {
  model: 'MediaPipe Pose Landmarker lite (bundled), CPU, person mask',
  frames: { used: shapes.reduce((n, s) => n + usable(byShape[s]).length, 0), rendered: shapes.length * manifest.arms.length * manifest.views.length, arms: manifest.arms, views: manifest.views },
  pose: { armsFromVertical: ARMS },
  measures: MEASURES,
  reference: r0.map(x => round(x)),
  armSlope: armSlope.map(x => round(x, 6)),
  noise: noise.map(x => round(x)),
  deltas: Object.fromEntries(Object.entries(deltas).map(([k, v]) => [k, v.map(x => round(x))])),
};
writeFileSync(calibrationFile, '// Generated by scripts/calibrate-scan.mjs from Blender renders measured with the app\'s MediaPipe model. Do not edit by hand.\n'
  + '// Front-view breadth / torso length of the reference body in the scan pose, and how each morph changes it.\n'
  + `export default ${JSON.stringify(calibration, null, 2)};\n`);

// Score the held-out bodies the way the app would: median of the usable frames, compared with the profile's body.
const fixtures = {};
for (const [name, h] of Object.entries(HOLDOUT)) {
  const scan = summarise(byShape[name].map(r => r.m));
  if (!scan) throw new Error(`${name}: too few usable frames`);
  const { amount } = solveScan(scan, physique(h.profile).weights, calibration);
  fixtures[name] = { ...h, scan, recovered: Object.fromEntries(MEASURES.map(m => [m, round(amount[m], 3)])) };
  console.log(name.padEnd(40), MEASURES.map(m => `${m} ${amount[m].toFixed(2)} (want ${h.expected[m]})`).join('  '));
}
mkdirSync(join(root, 'tests', 'fixtures'), { recursive: true });
writeFileSync(join(root, 'tests', 'fixtures', 'scan-holdout.json'), JSON.stringify(fixtures, null, 2) + '\n');
console.log(`calibrated from ${calibration.frames.used}/${calibration.frames.rendered} frames; reference ${calibration.reference.join(', ')}; arm slope ${calibration.armSlope.join(', ')}; noise ${calibration.noise.join(', ')}`);

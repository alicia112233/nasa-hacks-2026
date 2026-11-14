/**
 * Calibrate the body scan with the app's own pose model.
 *
 * scripts/blender/build_body.py renders every basis body shape as 640 x 480 camera frames in the scan pose
 * (.cache/scan-frames). This script runs the bundled MediaPipe Pose Landmarker (lite, CPU, with the person mask,
 * the same options as src/pose.ts) on each frame in headless Chrome, measures it with src/scan.mjs, and writes:
 *  - src/body-calibration.mjs: the reference body's ratios, how each morph changes them, the arm-angle slope,
 *    the measurement scatter, and the validation results below;
 *  - tests/fixtures/scan-holdout.json: scans of bodies left out of the calibration, with the body shape, build and
 *    shoulder / waist / hip morphs they should give, and a body with HIDH's 0g fluid shift for the Legs check;
 *  - tests/fixtures/scan-reference.mjpeg: the reference body at 2.6 m as a fake webcam for Chrome
 *    (--use-file-for-fake-video-capture), so tests/browser/scan-video.spec.ts runs the whole scan in the app.
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
if (!existsSync(calibrationFile)) writeFileSync(calibrationFile, 'export default { pose: { armsFromVertical: 30 }, reference: [1, 1, 1, 1, 1], armSlope: [0, 0, 0, 0, 0], noise: [1, 1, 1, 1, 1], deltas: {} };\n');
const { MEASURES, SHAPE, frameIssue, summarise, thighCm } = await import(pathToFileURL(join(root, 'src', 'scan.mjs')).href);
const { detectShape, physique } = await import(pathToFileURL(join(root, 'src', 'physique.mjs')).href);

const ARMS = 30;
const CROSS = ['heavy', 'light', 'muscular', 'slight'];
const OWN = SHAPE.flatMap(m => [`${m}_wide`, `${m}_narrow`]);
/** A 170 cm profile with the mass that gives MakeHuman weight macro w (BMI 21.7 x (w + 0.5)). */
const profile = w => ({ heightCm: 170, massKg: Math.round(21.7 * (w + 0.5) * 1.7 ** 2 * 10) / 10 });
const fine = (shoulders = 0, waist = 0, hips = 0) => ({ shoulders, waist, hips });
/** Bodies left out of the calibration (build_body.py HOLDOUTS): the height and mass a crew member would enter,
 * and the body shape, build and shoulder / waist / hip morphs the scan should find. */
const HOLDOUT = {
  holdout_f_heavier: { profile: profile(0.8), sex: 'female', build: 'average', fine: fine() },
  holdout_m_shoulders_wide_hips_narrow: { profile: profile(0.5), sex: 'male', build: 'average', fine: fine(0.5, 0, -0.5) },
  holdout_f_muscular_waist_narrow: { profile: profile(0.5), sex: 'female', build: 'muscular', fine: fine(0, -0.6, 0) },
  holdout_m_slight_light: { profile: profile(0.35), sex: 'male', build: 'slight', fine: fine() },
  holdout_f_slight_hips_wide: { profile: profile(0.5), sex: 'female', build: 'slight', fine: fine(0, 0, 0.4) },
  holdout_m_muscular_heavier: { profile: profile(0.65), sex: 'male', build: 'muscular', fine: fine() },
  holdout_f_light_shoulders_wide: { profile: profile(0.3), sex: 'female', build: 'average', fine: fine(0.4, 0, 0) },
  holdout_m_heavy_waist_wide: { profile: profile(0.9), sex: 'male', build: 'average', fine: fine(0, 0.5, 0) },
};
/** HIDH Table 4.3-4: lower-limb circumference down up to 6% from the 0g fluid shift (the model's fluid_0g body). */
const FLUID_THIGH = -0.06;

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
    const m = pose && mask ? measureFrame(mask.getAsFloat32Array(), mask.width, mask.height, pose) : null;
    if (m) delete m.lines;
    out.push(m);
    r.close();
  }
  landmarker.close();
  return out;
}, manifest.frames);
const webcamFrame = await page.evaluate(async file => {
  const img = new Image();
  img.src = '/frames/' + file;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  c.getContext('2d').drawImage(img, 0, 0);
  const blob = await new Promise(resolve => c.toBlob(resolve, 'image/jpeg', 0.92));
  return Array.from(new Uint8Array(await blob.arrayBuffer()));
}, 'reference_a30_d2.6.png');
await browser.close();

const rows = manifest.frames.map((f, i) => ({ ...f, m: measured[i] }));
writeFileSync(join(framesDir, 'measured.json'), JSON.stringify(rows));
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
// Frames with the feet cropped off (the 1.7 m view) must be refused, never measured.
const cropped = rows.filter(r => r.distance < 2);
const refused = cropped.filter(r => frameIssue(r.m) === 'Step back').length;
// Scatter of each ratio within a body across camera positions and arm angles, pooled over the calibration shapes.
const noise = MEASURES.map((k, j) => {
  let ss = 0, n = 0;
  for (const s of shapes) {
    const xs = usable(byShape[s]).map(r => r.m[k] - armSlope[j] * (r.m.armAngle - ARMS)), m = mean(xs);
    for (const x of xs) { ss += (x - m) ** 2; n++; }
  }
  return Math.sqrt(ss / Math.max(1, n - shapes.length));
});

const calibration = {
  model: 'MediaPipe Pose Landmarker lite (bundled), CPU, person mask',
  frames: { used: shapes.reduce((n, s) => n + usable(byShape[s]).length, 0), rendered: rows.length, croppedRefused: `${refused}/${cropped.length}`, arms: manifest.arms, views: manifest.views },
  pose: { armsFromVertical: ARMS },
  measures: MEASURES,
  reference: r0.map(x => round(x)),
  armSlope: armSlope.map(x => round(x, 6)),
  noise: noise.map(x => round(x)),
  deltas: Object.fromEntries(Object.entries(deltas).map(([k, v]) => [k, v.map(x => round(x))])),
};

// Score the held-out bodies the way the app would: median of the usable frames, then the shape guess from height and mass.
const holdout = {};
let sexRight = 0, buildRight = 0, unsure = 0, wrongButSure = 0, worstFine = 0;
for (const [name, h] of Object.entries(HOLDOUT)) {
  const scan = summarise(byShape[name].map(r => r.m));
  if (!scan) throw new Error(`${name}: too few usable frames`);
  const guess = detectShape(h.profile, scan, calibration);
  const amount = physique({ ...h.profile, sex: h.sex, build: h.build, scan }, 0, calibration).scan.amount;
  sexRight += guess.sex === h.sex;
  buildRight += guess.build === h.build;
  unsure += !guess.sure.sex + !guess.sure.build;
  wrongButSure += (guess.sure.sex && guess.sex !== h.sex) + (guess.sure.build && guess.build !== h.build);
  for (const m of SHAPE) worstFine = Math.max(worstFine, Math.abs(amount[m] - h.fine[m]));
  holdout[name] = { ...h, scan,
    detected: { sex: guess.sex, build: guess.build, sure: guess.sure, margin: { sex: round(guess.margin.sex, 2), build: round(guess.margin.build, 2) } },
    recovered: Object.fromEntries(SHAPE.map(m => [m, round(amount[m], 3)])) };
  console.log(name.padEnd(38), `${guess.sex}${guess.sure.sex ? '' : '?'} ${guess.build}${guess.sure.build ? '' : '?'}`.padEnd(20),
    `want ${h.sex} ${h.build}`.padEnd(24), `margins ${guess.margin.sex.toFixed(1)}/${guess.margin.build.toFixed(1)}`.padEnd(18),
    SHAPE.map(m => `${m} ${amount[m].toFixed(2)}/${h.fine[m]}`).join('  '));
}
const count = Object.keys(HOLDOUT).length;
// Legs check: the same person with the 0g fluid shift, against their reference scan.
const refScan = summarise(byShape.reference.map(r => r.m)), fluidScan = summarise(byShape.holdout_fluid_0g.map(r => r.m));
const thighChange = fluidScan.thighOfHeight / refScan.thighOfHeight - 1;
// Repeatability of thigh breadth in centimetres across camera positions and arm angles, for the reference body (172.4 cm).
const cms = usable(byShape.reference).map(r => thighCm({ thighOfHeight: r.m.thighs * r.m.torsoPx / r.m.heightPx }, 172.4));
const cmMean = mean(cms), cmSd = Math.sqrt(mean(cms.map(x => (x - cmMean) ** 2)));
const legs = { referenceThighCm: round(cmMean, 1), thighCmSd: round(cmSd, 2), fluidThighChange: round(thighChange, 4), expectedFluidThighChange: FLUID_THIGH };
calibration.validation = { heldOutBodies: count, sexRight, buildRight, unsureGuesses: unsure, wrongButSure, worstMorphError: round(worstFine, 3), ...legs };

writeFileSync(calibrationFile, '// Generated by scripts/calibrate-scan.mjs from Blender renders measured with the app\'s MediaPipe model. Do not edit by hand.\n'
  + '// Front-view breadth / torso length of the reference body in the scan pose, how each morph changes it, and held-out results.\n'
  + `export default ${JSON.stringify(calibration, null, 2)};\n`);
mkdirSync(join(root, 'tests', 'fixtures'), { recursive: true });
writeFileSync(join(root, 'tests', 'fixtures', 'scan-holdout.json'), JSON.stringify({ holdout, fluid: { reference: refScan, fluid: fluidScan, ...legs } }, null, 2) + '\n');
const jpeg = Buffer.from(webcamFrame);
writeFileSync(join(root, 'tests', 'fixtures', 'scan-reference.mjpeg'), Buffer.concat([jpeg, jpeg]));
console.log(`shape guesses: sex ${sexRight}/${count}, build ${buildRight}/${count}, unsure ${unsure}, wrong but sure ${wrongButSure}; worst morph error ${worstFine.toFixed(2)}`);
console.log(`legs: reference thigh ${cmMean.toFixed(1)} cm, sd ${cmSd.toFixed(2)} cm; fluid shift thigh change ${(thighChange * 100).toFixed(1)}% (HIDH ${FLUID_THIGH * 100}%)`);
console.log(`calibrated from ${calibration.frames.used}/${calibration.frames.rendered} frames (cropped refused ${calibration.frames.croppedRefused}); noise ${calibration.noise.join(', ')}`);

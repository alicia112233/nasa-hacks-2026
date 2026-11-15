import test from 'node:test';
import { documented, referencesFor } from './fixtures/references.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { MEASURES, MIN_FRAMES, SHAPE, compareScan, fitScan, frameIssue, measureFrame, modelBreadths, scanSpread, summarise, thighCm } from '../src/scan.mjs';
import { detectShape, physique } from '../src/physique.mjs';
import { analyze } from '../src/rules.mjs';
import calibration from '../src/body-calibration.mjs';

// A drawn person in a 400 x 600 frame: torso 200 px long (shoulders y 100, hips y 300), shoulders 220 px wide,
// shoulders (with the raised arms) 240 px wide, waist 120, hips 160, thighs 60 each, upper arms 30, arms 30 degrees out.
function figure({ waist = 120, thigh = 30, hole = 0, armsIn = false, armToChest = false } = {}) {
  const W = 400, H = 600, mask = new Float32Array(W * H);
  const rect = (x0, x1, y0, y1) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) mask[y * W + x] = 1; };
  const capsule = (ax, ay, bx, by, r) => {
    for (let y = Math.floor(Math.min(ay, by) - r); y <= Math.max(ay, by) + r; y++) for (let x = Math.floor(Math.min(ax, bx) - r); x <= Math.max(ax, bx) + r; x++) {
      const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
      if (x >= 0 && x < W && y >= 0 && y < H && Math.hypot(x - ax - t * (bx - ax), y - ay - t * (by - ay)) <= r) mask[y * W + x] = 1;
    }
  };
  const a = Math.PI / 6, elbow = side => [200 + side * (90 + Math.sin(a) * 110), 100 + Math.cos(a) * 110], wrist = side => [200 + side * (90 + Math.sin(a) * 210), 100 + Math.cos(a) * 210];
  rect(170, 230, 20, 70); rect(160, 240, 70, 80); rect(80, 320, 80, 130);
  rect(200 - waist / 2, 200 + waist / 2, 130, 280); rect(120, 280, 280, 330);
  for (const side of [1, -1]) {
    capsule(200 + side * 40, 300, 200 + side * 35, 440, thigh); capsule(200 + side * 35, 440, 200 + side * 30, 570, 20);
    if (!armsIn) { capsule(200 + side * 90, 100, ...elbow(side), 15); capsule(...elbow(side), ...wrist(side), 12); }
    else { capsule(200 + side * 90, 100, 200 + side * 50, 220, 15); capsule(200 + side * 50, 220, 200 + side * 55, 300, 12); }
  }
  if (armToChest) rect(255, 300, 140, 180);
  if (hole) for (let y = 200; y < 260; y++) for (let x = 230; x < 230 + hole; x++) mask[y * W + x] = 0;
  const px = (x, y, visibility = 1) => ({ x: x / W, y: y / H, visibility });
  const landmarks = Array.from({ length: 33 }, () => px(200, 300));
  landmarks[0] = px(200, 45);
  landmarks[11] = px(290, 100); landmarks[12] = px(110, 100);
  landmarks[13] = armsIn ? px(250, 220) : px(...elbow(1)); landmarks[14] = armsIn ? px(150, 220) : px(...elbow(-1));
  landmarks[15] = armsIn ? px(255, 300) : px(...wrist(1)); landmarks[16] = armsIn ? px(145, 300) : px(...wrist(-1));
  landmarks[23] = px(240, 300); landmarks[24] = px(160, 300);
  landmarks[25] = px(235, 440); landmarks[26] = px(165, 440);
  landmarks[27] = px(230, 570); landmarks[28] = px(170, 570);
  return { mask, W, H, landmarks };
}
const measure = f => measureFrame(f.mask, f.W, f.H, f.landmarks);
const near = (actual, expected, tol, label) => assert.ok(Math.abs(actual - expected) <= tol, `${label}: ${actual} vs ${expected}`);

test('five breadths are read from the person mask square to the body axes, in torso lengths', () => {
  const m = measure(figure());
  near(m.shoulders, 1.2, 0.01, 'shoulders');
  near(m.waist, 0.6, 0.01, 'waist');
  near(m.hips, 0.8, 0.01, 'hips');
  near(m.thighs, 0.3, 0.015, 'thighs');
  near(m.arms, 0.15, 0.015, 'arms');
  near(m.armAngle, 30, 0.5, 'arm angle');
  near(m.heightPx, 571, 2, 'outline height');
  assert.equal(m.lean, 0);
  assert.ok(m.fullBody && m.armsClear);
  assert.equal(frameIssue(m), null);
  for (const k of [...SHAPE, 'thigh_l', 'thigh_r']) assert.equal(m.lines[k].length, 4, k);
});

test('touching thighs stop at the midline, an arm against the chest is capped, and specks are bridged', () => {
  near(measure(figure({ thigh: 48 })).thighs, (48 + 37.5) / 200, 0.02, 'touching thighs');
  assert.ok(measure(figure({ armToChest: true })).arms < 0.2);
  near(measure(figure({ hole: 2 })).waist, 0.6, 0.01, 'speck');
  assert.ok(measure(figure({ hole: 6 })).waist < 0.5);
});

test('frames are refused when the feet are cut off, the arms touch the body, or the body leans', () => {
  const f = figure();
  const cropped = f.landmarks.map((p, i) => (i === 27 || i === 28 ? { ...p, y: 1.04, visibility: 0.4 } : p));
  assert.equal(frameIssue(measureFrame(f.mask, f.W, f.H, cropped)), 'Step back');
  assert.equal(frameIssue(measure(figure({ armsIn: true }))), 'Arms out a little');
  const m = measure(f);
  assert.equal(frameIssue({ ...m, lean: 20 }), 'Stand straight');
  assert.equal(frameIssue({ ...m, armAngle: 60 }), 'Arms lower');
  assert.equal(frameIssue(null), 'Step back');
});

test('a scan keeps medians of enough usable frames, and the stated height turns thighs into centimetres', () => {
  const m = measure(figure());
  assert.equal(summarise(Array(MIN_FRAMES - 1).fill(m)), null);
  const s = summarise([...Array(MIN_FRAMES).fill(m), { ...m, waist: 2 }, { ...m, fullBody: false, waist: 9 }]);
  assert.equal(s.frames, MIN_FRAMES + 1);
  near(s.waist, 0.6, 0.01, 'median waist');
  near(thighCm(s, 171), m.thighs * m.torsoPx / m.heightPx * 171, 0.06, 'thigh cm');
  assert.equal(thighCm(s, undefined), null);
});

test('a scan reports how far its frames disagree, and that is repeatability, not truth', () => {
  const m = measure(figure());
  const steady = summarise(Array(MIN_FRAMES).fill(m));
  for (const k of MEASURES) assert.equal(steady.spread[k], 0, k);
  assert.equal(scanSpread(steady), 0);
  // Waist readings of 0.57, 0.6 and 0.63 around a 0.6 median: a robust SD of 1.4826 x 0.03, 7.4% of the waist.
  const shaky = summarise([...Array(4).fill({ ...m, waist: 0.57 }), ...Array(4).fill({ ...m, waist: 0.6 }), ...Array(4).fill({ ...m, waist: 0.63 })]);
  near(shaky.spread.waist, 1.4826 * 0.03 / 0.6, 0.002, 'waist spread');
  assert.equal(shaky.spread.hips, 0);
  near(scanSpread(shaky), shaky.spread.waist, 1e-9, 'largest spread');
  assert.equal(scanSpread({ shoulders: 1 }), null);
});

test('the result compares the scan and its fitted figure with one fixed baseline: the standard figure of that body shape', () => {
  const ref = { ...Object.fromEntries(MEASURES.map((m, j) => [m, calibration.reference[j]])), armAngle: 30 };
  // The standard male body against the standard male figure: nothing to report, and the figure sits on it.
  const same = compareScan(ref, {});
  for (const m of MEASURES) { near(same[m].you, 0, 1e-9, m); near(same[m].figure, 0, 1e-9, m); }
  // Build and weight move the figure, not the baseline, so picking another build never changes what "you" reads.
  const muscular = compareScan(ref, { muscular: 0.7, shoulders_wide: 0.5 });
  for (const m of MEASURES) near(muscular[m].you, 0, 1e-9, m);
  near(muscular.shoulders.figure, (0.7 * calibration.deltas.muscular[0] + 0.5 * calibration.deltas.shoulders_wide[0]) / calibration.reference[0], 1e-9, 'figure shoulders');
  // Body shape moves the baseline: the same male scan is wider in the shoulders than the standard female figure.
  const female = compareScan(ref, { female: 1 });
  near(female.shoulders.you, calibration.reference[0] / modelBreadths({ female: 1 })[0] - 1, 1e-9, 'against the female figure');
  assert.ok(female.shoulders.you > 0.04 && female.hips.you < -0.04);
  near(female.shoulders.figure, 0, 1e-9, 'unfitted female figure');
  // A scan 10% wider at the waist: the fitted figure moves toward it and stops short, and the gap is reported.
  const wide = { ...ref, waist: ref.waist * 1.1 };
  const fitted = compareScan(wide, physique({ sex: 'male', scan: wide }).weights);
  near(fitted.waist.you, 0.1, 1e-9, 'measured waist');
  assert.ok(fitted.waist.figure > 0.02 && fitted.waist.figure < fitted.waist.you, `figure waist ${fitted.waist.figure}`);
});

test('calibration comes from the app model on Blender renders, refuses cropped frames, and each shape morph moves its own measure', () => {
  assert.match(calibration.model, /MediaPipe Pose Landmarker/);
  assert.deepEqual(calibration.measures, MEASURES);
  assert.ok(calibration.frames.used >= 100);
  const [refused, cropped] = calibration.frames.croppedRefused.split('/').map(Number);
  assert.ok(cropped > 0 && refused === cropped);
  SHAPE.forEach((m, j) => {
    assert.ok(calibration.deltas[`${m}_wide`][j] > 0 && calibration.deltas[`${m}_narrow`][j] < 0, m);
    for (const k of ['wide', 'narrow']) {
      const d = calibration.deltas[`${m}_${k}`];
      assert.ok(SHAPE.every((_, i) => i === j || Math.abs(d[i]) < Math.abs(d[j])), `${m}_${k} moves another shape measure more`);
    }
  });
  const exact = fitScan({ ...Object.fromEntries(MEASURES.map((m, j) => [m, calibration.reference[j]])), armAngle: 30 }, {});
  for (const m of SHAPE) near(exact.amount[m], 0, 1e-9, m);
});

test('held-out Blender bodies: body shape from height, mass and the scan, never confidently wrong; morphs recovered', async () => {
  const { holdout } = JSON.parse(await readFile(new URL('./fixtures/scan-holdout.json', import.meta.url), 'utf8'));
  assert.equal(Object.keys(holdout).length, 8);
  let buildRight = 0;
  for (const [name, h] of Object.entries(holdout)) {
    const guess = detectShape(h.profile, h.scan);
    assert.equal(guess.sex, h.sex, `${name} sex`);
    buildRight += guess.build === h.build;
    if (guess.sure.build) assert.equal(guess.build, h.build, `${name} build was sure but wrong`);
    const { scan, weights } = physique({ ...h.profile, sex: h.sex, build: h.build, scan: h.scan });
    for (const m of SHAPE) {
      near(scan.amount[m], h.fine[m], 0.4, `${name} ${m}`);
      assert.equal(weights[`${m}_wide`], Math.max(0, scan.amount[m]));
      assert.equal(weights[`${m}_narrow`], Math.max(0, -scan.amount[m]));
    }
  }
  assert.ok(buildRight >= 6, `build right ${buildRight}/8`);

  // Camera alone, as in the crew card: no mass, so weight is guessed too. Body shape stays right and sure.
  const weightOf = { holdout_f_heavier: 0.6, holdout_m_shoulders_wide_hips_narrow: 0, holdout_f_muscular_waist_narrow: 0, holdout_m_slight_light: -0.3,
    holdout_f_slight_hips_wide: 0, holdout_m_muscular_heavier: 0.3, holdout_f_light_shoulders_wide: -0.4, holdout_m_heavy_waist_wide: 0.8 };
  for (const [name, h] of Object.entries(holdout)) {
    const guess = detectShape({ heightCm: 170 }, h.scan);
    assert.equal(guess.sex, h.sex, `${name} sex without mass`);
    assert.ok(guess.sure.sex, `${name} sex sure without mass`);
    near(guess.weight, weightOf[name], 0.35, `${name} weight`);
  }
  // The scan's weight drives the body when no mass is stated, and a stated mass wins.
  const scanned = { ...holdout.holdout_f_heavier.scan, detected: { sex: 'female', build: 'average', weight: 0.6, sure: { sex: true, build: false } } };
  assert.equal(physique({ sex: 'female', heightCm: 170, scan: scanned }).weights.heavy, 0.6);
  assert.ok(physique({ sex: 'female', heightCm: 170, massKg: 50, scan: scanned }).weights.light > 0);
  // Each body shape and build keeps its own best weight, so correcting the guess re-fits the body instead of reusing the wrong weight.
  const guess = detectShape({ heightCm: 170 }, holdout.holdout_m_heavy_waist_wide.scan);
  assert.equal(Object.keys(guess.weights).length, 6);
  assert.equal(guess.weights[`${guess.sex}/${guess.build}`], guess.weight);
  const kept = { ...holdout.holdout_m_heavy_waist_wide.scan, detected: { sex: 'male', build: 'average', weight: 0.8, weights: { 'male/average': 0.8, 'male/slight': 0.4 }, sure: { sex: true, build: false } } };
  assert.equal(physique({ sex: 'male', build: 'average', heightCm: 170, scan: kept }).weights.heavy, 0.8);
  assert.equal(physique({ sex: 'male', build: 'slight', heightCm: 170, scan: kept }).weights.heavy, 0.4);
  assert.equal(physique({ sex: 'female', build: 'slight', heightCm: 170, scan: kept }).weights.heavy, 0.8);
  assert.deepEqual(detectShape({ heightCm: 170, massKg: 70 }, holdout.holdout_f_heavier.scan).weights, {});
  assert.equal(physique({ sex: 'female' }).scan, null);
  assert.equal(physique({ scan: { shoulders: NaN } }).scan, null);
});

test('avatar choice overrides silhouette fit in both directions and keeps model-specific weight estimates', async () => {
  const { holdout } = JSON.parse(await readFile(new URL('./fixtures/scan-holdout.json', import.meta.url), 'utf8'));
  for (const [name, h] of Object.entries(holdout)) {
    const chosen = h.sex === 'female' ? 'male' : 'female';
    const fit = detectShape({ heightCm: 170, sex: chosen }, h.scan);
    assert.equal(fit.sex, chosen, `${name}: chosen model must win`);
    assert.equal(fit.sure.sex, false, 'a model choice is not a camera classification');
    assert.equal(fit.weight, fit.weights[`${chosen}/${fit.build}`]);
    assert.equal(Object.keys(fit.weights).length, 6, 'all model/build weights remain available for corrections');
    const avatar = physique({ heightCm: 170, sex: chosen, build: fit.build, scan: { ...h.scan, detected: fit } });
    assert.equal(avatar.weights.female, chosen === 'female' ? 1 : 0);
  }
});

test('the scan sees fluid shift; the Legs rule flags an outline change, not a diagnosis', async () => {
  const { fluid } = JSON.parse(await readFile(new URL('./fixtures/scan-holdout.json', import.meta.url), 'utf8'));
  near(fluid.fluidThighChange, fluid.expectedFluidThighChange, 0.015, 'fluid shift thigh change');
  assert.ok(fluid.thighCmSd < 0.5, `thigh repeatability ${fluid.thighCmSd} cm`);
  const series = (recent, simulated = false) => [...Array(11).fill(16), ...Array(3).fill(recent)]
    .map((thighCm, i) => ({ id: String(i), date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(), sol: i + 1, simulated, reactionMs: null, missed: 0, signals: 0, symptoms: [], notes: '', thighCm }));
  const records = documented(series(15.1));
  const loss = analyze(records, false, referencesFor(records));
  assert.equal(loss.legDelta, -6);
  assert.equal(loss.legFlag, true);
  const smaller = documented(series(15.5));
  assert.equal(analyze(smaller, false, referencesFor(smaller)).legFlag, false);
});

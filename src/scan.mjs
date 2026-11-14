/**
 * Body scan: front-view proportions of the crew member, read from the camera on the device.
 *
 * MediaPipe's pose landmarks give the torso axis (shoulder midpoint to hip midpoint) and its person mask gives
 * the outline. Each breadth is the width of the outline along a line square to a body axis, divided by the
 * torso length, so distance from the camera cancels out:
 *  - shoulders: widest line within 5% of torso length of MediaPipe's shoulder points (across the deltoids);
 *  - waist: mean width 55% to 85% of the way down the torso;
 *  - hips: mean width 90% to 110% of the way down, around the hip points;
 *  - thighs: mean width square to each thigh (hip to knee), 30% to 50% down it, never past the body midline;
 *  - arms: mean width square to each upper arm (shoulder to elbow), 45% to 65% down it; the inner half is capped at
 *    1.25 times the outer half, so an arm resting against the chest isn't measured as chest.
 * The whole body must be in view: with the feet cut off, MediaPipe places the hips differently and every
 * ratio shifts by 1-4%. The outline's height in pixels, with the crew member's stated height as the ruler,
 * turns thigh breadth into centimetres for the Legs check.
 *
 * Calibration (src/body-calibration.mjs) comes from the same model: scripts/blender/build_body.py renders
 * every basis body shape in the scan pose, and scripts/calibrate-scan.mjs measures those frames with this
 * file. src/physique.mjs compares a scan with the bodies a profile could have, to suggest body shape and
 * build, and fits the shoulder, waist and hip morphs to what is left. Only ratios are kept; no image.
 */
import calibration from './body-calibration.mjs';

export const MEASURES = ['shoulders', 'waist', 'hips', 'thighs', 'arms'];
/** Measures with their own wide / narrow morphs. */
export const SHAPE = ['shoulders', 'waist', 'hips'];
/** Frames needed for a scan; the median of each ratio over them is kept. */
export const MIN_FRAMES = 8;
/** Accepted arm angle from the torso line, in degrees. The Blender body is calibrated at calibration.pose.armsFromVertical. */
export const ARM_RANGE = [15, 45];
/** Largest torso lean from the image vertical, in degrees. */
export const MAX_LEAN = 12;

// [first t, last t, samples, widest or mean], t in torso lengths below the shoulder line.
const BANDS = { shoulders: [-0.05, 0.05, 5, 'max'], waist: [0.55, 0.85, 13, 'mean'], hips: [0.9, 1.1, 9, 'mean'] };
/** Mask gaps up to this many pixels are bridged, so a speck of low confidence inside the body doesn't end a line. */
const GAP = 2;
/** Fit weights, tuned on held-out Blender bodies: measurement scatter is taken as 2.5x the calibration scatter
 * (real scans are noisier than renders), and the shoulder, waist and hip morphs get a prior of ±0.4. */
const FIT = { sigmaScale: 2.5, shapeScale: 1, prior: 0.4 };
const SIGMA_FLOOR = 0.005;

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const median = xs => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * @param {ArrayLike<number>} mask person confidence per pixel, row major (MediaPipe segmentation mask)
 * @param {number} width
 * @param {number} height
 * @param {{ x: number, y: number, visibility?: number }[]} landmarks MediaPipe pose landmarks, normalised to the frame
 * @returns {null | { shoulders: number, waist: number, hips: number, thighs: number, arms: number, armAngle: number, lean: number,
 *   armsClear: boolean, fullBody: boolean, torsoPx: number, heightPx: number, lines: Record<string, number[]> }}
 *   lines: [x1, y1, x2, y2] in pixels, for drawing
 */
export function measureFrame(mask, width, height, landmarks, threshold = 0.5) {
  const P = i => [landmarks[i].x * width, landmarks[i].y * height];
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const sm = mid(P(11), P(12)), hm = mid(P(23), P(24));
  const ax = [hm[0] - sm[0], hm[1] - sm[1]];
  const T = Math.hypot(ax[0], ax[1]);
  if (!(T >= 40)) return null;
  const u = [ax[0] / T, ax[1] / T], n = [-u[1], u[0]], neg = v => [-v[0], -v[1]];
  const inside = (x, y) => x >= 0 && y >= 0 && x < width && y < height && mask[Math.floor(y) * width + Math.floor(x)] >= threshold;
  const reach = (c, dir) => {
    let d = 0, last = 0;
    while (d < width + height) {
      d += 0.5;
      if (inside(c[0] + dir[0] * d, c[1] + dir[1] * d)) last = d;
      else if (d - last > GAP) break;
    }
    return last;
  };
  const extent = t => { const c = [sm[0] + u[0] * t * T, sm[1] + u[1] * t * T]; return inside(c[0], c[1]) ? [reach(c, n), reach(c, neg(n))] : null; };
  const out = {}, lines = {};
  for (const [key, [t0, t1, k, pick]] of Object.entries(BANDS)) {
    const samples = [];
    for (let i = 0; i < k; i++) { const t = t0 + (t1 - t0) * i / (k - 1), e = extent(t); if (e) samples.push({ t, e, w: e[0] + e[1] }); }
    if (samples.length < Math.ceil(k / 2)) return null;
    const widest = samples.reduce((a, b) => (b.w > a.w ? b : a));
    out[key] = (pick === 'max' ? widest.w : mean(samples.map(s => s.w))) / T;
    // The line to draw: the widest sample, or the middle one for a mean.
    const s = pick === 'max' ? widest : samples[samples.length >> 1], c = [sm[0] + u[0] * s.t * T, sm[1] + u[1] * s.t * T];
    lines[key] = [c[0] + n[0] * s.e[0], c[1] + n[1] * s.e[0], c[0] - n[0] * s.e[1], c[1] - n[1] * s.e[1]];
  }
  // Limbs: width square to the bone line. Thighs stop at the body midline, so touching thighs aren't measured as one;
  // an upper arm's inner half stops at 1.25 times its outer half, so an arm against the chest isn't measured as chest.
  const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
  const toMidline = (c, dir) => { const den = cross(dir, u); if (Math.abs(den) < 1e-6) return Infinity; const s = cross([sm[0] - c[0], sm[1] - c[1]], u) / den; return s > 0 ? s : Infinity; };
  const limb = (a, b, f0, f1, isThigh) => {
    const A = P(a), B = P(b), v = [B[0] - A[0], B[1] - A[1]], L = Math.hypot(v[0], v[1]);
    if (!(L >= 10)) return null;
    const d = [-v[1] / L, v[0] / L], e = neg(d), widths = [];
    let line = null;
    for (let i = 0; i < 5; i++) {
      const f = f0 + (f1 - f0) * i / 4, c = [A[0] + v[0] * f, A[1] + v[1] * f];
      if (!inside(c[0], c[1])) continue;
      let r1 = reach(c, d), r2 = reach(c, e);
      const m1 = toMidline(c, d), m2 = toMidline(c, e);
      if (isThigh) { r1 = Math.min(r1, m1); r2 = Math.min(r2, m2); }
      else if (m1 < m2) r1 = Math.min(r1, 1.25 * r2);
      else r2 = Math.min(r2, 1.25 * r1);
      widths.push(r1 + r2);
      if (!line || i === 2) line = [c[0] + d[0] * r1, c[1] + d[1] * r1, c[0] + e[0] * r2, c[1] + e[1] * r2];
    }
    return widths.length >= 3 ? { w: mean(widths), line } : null;
  };
  const thighs = [limb(23, 25, 0.3, 0.5, true), limb(24, 26, 0.3, 0.5, true)];
  const arms = [limb(11, 13, 0.45, 0.65, false), limb(12, 14, 0.45, 0.65, false)];
  if (thighs.some(x => !x) || arms.some(x => !x)) return null;
  out.thighs = (thighs[0].w + thighs[1].w) / 2 / T;
  out.arms = (arms[0].w + arms[1].w) / 2 / T;
  lines.thigh_l = thighs[0].line;
  lines.thigh_r = thighs[1].line;
  // Arms resting on the body would be measured as torso, so elbows and wrists must sit outside the torso's outline.
  let armsClear = true;
  for (const i of [13, 14, 15, 16]) {
    const p = P(i), rel = [p[0] - sm[0], p[1] - sm[1]];
    const t = (rel[0] * u[0] + rel[1] * u[1]) / T, d = rel[0] * n[0] + rel[1] * n[1];
    if (t < 0.3 || t > 1.1) continue;
    const e = extent(t);
    if (e && Math.abs(d) <= (d > 0 ? e[0] : e[1])) armsClear = false;
  }
  const angle = (a, b) => { const v = [P(b)[0] - P(a)[0], P(b)[1] - P(a)[1]]; return Math.acos(clamp((v[0] * u[0] + v[1] * u[1]) / (Math.hypot(v[0], v[1]) || 1), -1, 1)) * 180 / Math.PI; };
  const armAngle = (angle(11, 13) + angle(12, 14)) / 2;
  const lean = Math.abs(Math.atan2(u[0], u[1])) * 180 / Math.PI;
  const seen = i => (landmarks[i].visibility ?? 1) >= 0.7 && landmarks[i].y >= 0.01 && landmarks[i].y <= 0.97;
  const fullBody = seen(0) && seen(27) && seen(28);
  // Outline height in pixels: first and last rows with at least two person pixels.
  const row = y => { let count = 0; for (let x = 0; x < width; x++) if (mask[y * width + x] >= threshold && ++count >= 2) return true; return false; };
  let top = 0, bottom = height - 1;
  while (top < height && !row(top)) top++;
  while (bottom > top && !row(bottom)) bottom--;
  const heightPx = top < height ? bottom - top + 1 : 0;
  return { ...out, armAngle, lean, armsClear, fullBody, torsoPx: T, heightPx, lines };
}

/** What a frame needs before it counts, as a short instruction, or null when it is usable. */
export function frameIssue(m) {
  if (!m || !m.fullBody) return 'Step back';
  if (m.lean > MAX_LEAN) return 'Stand straight';
  if (!m.armsClear || m.armAngle < ARM_RANGE[0]) return 'Arms out a little';
  if (m.armAngle > ARM_RANGE[1]) return 'Arms lower';
  return null;
}

/**
 * Median of the usable frames, or null when there are too few. thighOfHeight: thigh breadth / outline height.
 * @returns {null | { shoulders: number, waist: number, hips: number, thighs: number, arms: number, thighOfHeight: number, armAngle: number, frames: number }}
 */
export function summarise(frames) {
  const good = frames.filter(m => m && !frameIssue(m));
  if (good.length < MIN_FRAMES) return null;
  const pick = (f, d = 4) => Math.round(median(good.map(f)) * 10 ** d) / 10 ** d;
  return {
    ...Object.fromEntries(MEASURES.map(k => [k, pick(m => m[k])])),
    thighOfHeight: pick(m => (m.heightPx ? m.thighs * m.torsoPx / m.heightPx : NaN), 5),
    armAngle: Math.round(median(good.map(m => m.armAngle))), frames: good.length,
  };
}

/** Thigh breadth in centimetres, with the crew member's height as the ruler. */
export const thighCm = (scan, heightCm) => (scan?.thighOfHeight > 0 && heightCm > 0 ? Math.round(scan.thighOfHeight * heightCm * 10) / 10 : null);

function solve3(M, b) {
  const [a, c, d] = M;
  const det = (x, y, z) => x[0] * (y[1] * z[2] - y[2] * z[1]) - y[0] * (x[1] * z[2] - x[2] * z[1]) + z[0] * (x[1] * y[2] - x[2] * y[1]);
  const D = det(a, c, d);
  if (Math.abs(D) < 1e-12) return null;
  return [det(b, c, d) / D, det(a, b, d) / D, det(a, c, b) / D];
}

/**
 * Compare a scan with the body a set of profile morphs predicts, and fit the shoulder, waist and hip morphs to
 * the difference (least squares over all five measures, with a prior that keeps those morphs small).
 * @param {Record<string, any>} scan
 * @param {Record<string, number>} weights profile morph weights (sex, mass, build)
 * @returns {{ amount: Record<string, number>, relative: Record<string, number>, cost: number }} amount: -1 narrow … 1 wide;
 *   relative: each measured breadth against the profile's body, e.g. 0.04 = 4% wider; cost: misfit, lower is better
 */
export function fitScan(scan, weights, cal = calibration) {
  const own = new Set(SHAPE.flatMap(m => [`${m}_wide`, `${m}_narrow`]));
  const predicted = [...cal.reference];
  for (const [k, d] of Object.entries(cal.deltas)) if (!own.has(k) && weights[k]) d.forEach((v, j) => { predicted[j] += weights[k] * v; });
  const armAngle = typeof scan.armAngle === 'number' ? scan.armAngle : cal.pose.armsFromVertical;
  const r = MEASURES.map((m, j) => scan[m] - cal.armSlope[j] * (armAngle - cal.pose.armsFromVertical) - predicted[j]);
  // Scatter per measure; cal.fit can override the weights for tuning (scripts/calibrate-scan.mjs).
  const fit = { ...FIT, ...cal.fit };
  const sigma = cal.noise.map((x, j) => Math.max(fit.sigmaScale * x, SIGMA_FLOOR) * (j < SHAPE.length ? fit.shapeScale : 1));
  const columns = x => SHAPE.map((m, i) => (x[i] >= 0 ? cal.deltas[`${m}_wide`] : cal.deltas[`${m}_narrow`].map(v => -v)));
  let x = [0, 0, 0];
  for (let it = 0; it < 4; it++) {
    const A = columns(x);
    const M = A.map((a, i) => A.map((c, k) => a.reduce((s, v, j) => s + v * c[j] / sigma[j] ** 2, 0) + (i === k ? 1 / fit.prior ** 2 : 0)));
    const next = solve3(M, A.map(a => a.reduce((s, v, j) => s + v * r[j] / sigma[j] ** 2, 0)));
    if (!next) break;
    x = next.map(v => clamp(v, -1, 1));
  }
  const A = columns(x);
  const cost = r.reduce((s, v, j) => s + ((v - A.reduce((t, a, i) => t + a[j] * x[i], 0)) / sigma[j]) ** 2, 0) + x.reduce((s, v) => s + (v / fit.prior) ** 2, 0);
  return {
    amount: Object.fromEntries(SHAPE.map((m, i) => [m, x[i]])),
    relative: Object.fromEntries(MEASURES.map((m, j) => [m, r[j] / predicted[j]])),
    cost,
  };
}

export const validScan = s => !!s && MEASURES.every(m => typeof s[m] === 'number' && Number.isFinite(s[m]) && s[m] > 0.05 && s[m] < 3);

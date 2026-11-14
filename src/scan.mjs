/**
 * Body scan: three front-view proportions of the crew member, read from the camera on the device.
 *
 * MediaPipe's pose landmarks give the torso axis (shoulder midpoint to hip midpoint) and its person mask gives
 * the outline. Each breadth is the width of the outline along a line square to that axis, divided by the
 * torso length, so distance from the camera cancels out:
 *  - shoulders: widest line within 5% of torso length of the shoulder joints (across the deltoids);
 *  - waist: narrowest line 45% to 85% of the way down the torso;
 *  - hips: widest line 85% to 110% of the way down, around the hip joints.
 *
 * scripts/blender/build_body.py measures the Blender body the same way (scan_measure, a line-for-line twin),
 * standing in the scan pose, for the reference body and every morph. That gives src/body-calibration.mjs, so
 * a scan can be compared with the body the profile already predicts, and only the difference moves the
 * shoulder, waist and hip morphs. Only these ratios are kept; no image is stored.
 */
import calibration from './body-calibration.mjs';

export const MEASURES = ['shoulders', 'waist', 'hips'];
/** Frames needed for a scan; the median of each ratio over them is kept. */
export const MIN_FRAMES = 8;
/** Accepted arm angle from the torso line, in degrees. The Blender body is measured at calibration.pose.armsFromVertical. */
export const ARM_RANGE = [15, 45];
/** Largest torso lean from the image vertical, in degrees. */
export const MAX_LEAN = 12;

// [first t, last t, samples, widest or narrowest], t in torso lengths below the shoulder line.
const BANDS = { shoulders: [-0.05, 0.05, 5, 'max'], waist: [0.45, 0.85, 17, 'min'], hips: [0.85, 1.1, 11, 'max'] };
/** Mask gaps up to this many pixels are bridged, so a speck of low confidence inside the body doesn't end a line. */
const GAP = 2;

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const median = xs => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/**
 * @param {ArrayLike<number>} mask person confidence per pixel, row major (MediaPipe segmentation mask)
 * @param {number} width
 * @param {number} height
 * @param {{ x: number, y: number }[]} landmarks MediaPipe pose landmarks, normalised to the frame
 * @returns {null | { shoulders: number, waist: number, hips: number, armAngle: number, lean: number, armsClear: boolean, torsoPx: number }}
 */
export function measureFrame(mask, width, height, landmarks, threshold = 0.5) {
  const P = i => [landmarks[i].x * width, landmarks[i].y * height];
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const sm = mid(P(11), P(12)), hm = mid(P(23), P(24));
  const ax = [hm[0] - sm[0], hm[1] - sm[1]];
  const T = Math.hypot(ax[0], ax[1]);
  if (!(T >= 40)) return null;
  const u = [ax[0] / T, ax[1] / T], n = [-u[1], u[0]];
  const inside = (x, y) => x >= 0 && y >= 0 && x < width && y < height && mask[Math.floor(y) * width + Math.floor(x)] >= threshold;
  const reach = (c, s) => {
    let d = 0, last = 0;
    while (d < width + height) {
      d += 0.5;
      if (inside(c[0] + s * n[0] * d, c[1] + s * n[1] * d)) last = d;
      else if (d - last > GAP) break;
    }
    return last;
  };
  const extent = t => { const c = [sm[0] + u[0] * t * T, sm[1] + u[1] * t * T]; return inside(c[0], c[1]) ? [reach(c, 1), reach(c, -1)] : null; };
  const out = {};
  for (const [key, [t0, t1, k, pick]] of Object.entries(BANDS)) {
    const widths = [];
    for (let i = 0; i < k; i++) { const e = extent(t0 + (t1 - t0) * i / (k - 1)); if (e) widths.push(e[0] + e[1]); }
    if (widths.length < Math.ceil(k / 2)) return null;
    out[key] = (pick === 'max' ? Math.max(...widths) : Math.min(...widths)) / T;
  }
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
  return { ...out, armAngle, lean, armsClear, torsoPx: T };
}

/** What a frame needs before it counts, as a short instruction, or null when it is usable. */
export function frameIssue(m) {
  if (!m) return 'Step back';
  if (m.lean > MAX_LEAN) return 'Stand straight';
  if (!m.armsClear || m.armAngle < ARM_RANGE[0]) return 'Arms out a little';
  if (m.armAngle > ARM_RANGE[1]) return 'Arms lower';
  return null;
}

/** Median of the usable frames, or null when there are too few. */
export function summarise(frames) {
  const good = frames.filter(m => m && !frameIssue(m));
  if (good.length < MIN_FRAMES) return null;
  const pick = k => Math.round(median(good.map(m => m[k])) * 10000) / 10000;
  return { shoulders: pick('shoulders'), waist: pick('waist'), hips: pick('hips'), armAngle: Math.round(median(good.map(m => m.armAngle))), frames: good.length };
}

function solve3(cols, r) {
  const [a, b, c] = cols;
  const det = (x, y, z) => x[0] * (y[1] * z[2] - y[2] * z[1]) - y[0] * (x[1] * z[2] - x[2] * z[1]) + z[0] * (x[1] * y[2] - x[2] * y[1]);
  const D = det(a, b, c);
  if (Math.abs(D) < 1e-9) return null;
  return [det(r, b, c) / D, det(a, r, c) / D, det(a, b, r) / D];
}

/**
 * Compare a scan with the body the profile predicts and solve for the shoulder, waist and hip morphs.
 * @param {{ shoulders: number, waist: number, hips: number, armAngle: number }} scan
 * @param {Record<string, number>} weights profile morph weights (sex, mass, build)
 * @returns {{ amount: Record<string, number>, relative: Record<string, number> }} amount: -1 narrow … 1 wide morph;
 *   relative: measured breadth compared with the profile's body, e.g. 0.04 = 4% wider
 */
export function solveScan(scan, weights, cal = calibration) {
  const own = new Set(MEASURES.flatMap(m => [`${m}_wide`, `${m}_narrow`]));
  const predicted = [...cal.reference];
  for (const [k, d] of Object.entries(cal.deltas)) if (!own.has(k) && weights[k]) d.forEach((v, j) => { predicted[j] += weights[k] * v; });
  const armAngle = typeof scan.armAngle === 'number' ? scan.armAngle : cal.pose.armsFromVertical;
  const measured = MEASURES.map((m, j) => scan[m] - cal.armSlope[j] * (armAngle - cal.pose.armsFromVertical));
  const r = measured.map((m, j) => m - predicted[j]);
  let x = [0, 0, 0];
  for (let i = 0; i < 4; i++) {
    const cols = MEASURES.map((m, j) => x[j] >= 0 ? cal.deltas[`${m}_wide`] : cal.deltas[`${m}_narrow`].map(v => -v));
    const next = solve3(cols, r);
    if (!next) break;
    x = next;
  }
  return {
    amount: Object.fromEntries(MEASURES.map((m, j) => [m, clamp(x[j], -1, 1)])),
    relative: Object.fromEntries(MEASURES.map((m, j) => [m, r[j] / predicted[j]])),
  };
}

export const validScan = s => !!s && MEASURES.every(m => typeof s[m] === 'number' && Number.isFinite(s[m]) && s[m] > 0.1 && s[m] < 3);

/**
 * Crew profile → shape of the Blender body (public/models/body.glb, built by scripts/blender/build_body.py).
 *
 * The reference body is a 35-year-old male in NASA's 0g neutral body posture. Each morph target is the posed
 * difference to another MakeHuman macro shape, so a profile blends them:
 *  - sex picks the female shape (cross terms keep heavy/slight bodies sex-specific);
 *  - height scales the whole body to the stated stature;
 *  - weight comes from the body scan (detectShape), or from mass as BMI when there is no scan: compared with an
 *    average-weight body, ±50% relative BMI is a full morph (MakeHuman's weight macro spans 50% to 150% of average
 *    body weight). This is an approximation for a picture, not a body-composition measurement;
 *  - build picks the muscular or slight shape;
 *  - a body scan (src/scan.mjs) suggests sex and build (detectShape), and sets the shoulder, waist and hip
 *    morphs from how the measured proportions differ from the body the rest of the profile predicts;
 *  - zero-g applies NASA HIDH Table 4.3-4: +3% stature from spinal elongation, and the fluid shift that thins
 *    the legs and fills the face, both within the first days of weightlessness.
 */
import { SHAPE, fitScan, validScan } from './scan.mjs';

export const STATURE = { male: 1.7242, female: 1.5907 };
export const MORPHS = ['female', 'heavy', 'light', 'muscular', 'slight', 'female_heavy', 'female_light', 'female_muscular',
  'female_slight', 'shoulders_wide', 'shoulders_narrow', 'waist_wide', 'waist_narrow', 'hips_wide', 'hips_narrow', 'fluid_0g', 'spine_0g'];
/** BMI of the MakeHuman average-weight body at average height, used as the "average weight" point. */
export const AVERAGE_BMI = 21.7;
export const LIMITS = { heightCm: [140, 210], massKg: [35, 160] };

const clamp = (x, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
const valid = (x, [lo, hi]) => typeof x === 'number' && Number.isFinite(x) && x >= lo && x <= hi;

/**
 * @param {{ sex?: 'female' | 'male', heightCm?: number, massKg?: number, build?: 'slight' | 'average' | 'muscular',
 *   scan?: Record<string, any> }} profile
 * @param {number} [weight] heavy (+) / light (-) morph weight, used instead of mass (the scan's estimate)
 */
function profileWeights(profile, weight = undefined) {
  const weights = Object.fromEntries(MORPHS.map(name => [name, 0]));
  const f = profile.sex === 'female' ? 1 : 0;
  weights.female = f;
  const stature = STATURE.male + f * (STATURE.female - STATURE.male);
  const height = valid(profile.heightCm, LIMITS.heightCm) ? profile.heightCm / 100 : null;
  const scale = height ? height / stature : 1;
  let bmi = null;
  if (typeof weight === 'number') {
    weights.heavy = clamp(weight);
    weights.light = clamp(-weight);
  } else if (height && valid(profile.massKg, LIMITS.massKg)) {
    bmi = profile.massKg / (height * height);
    const relative = bmi / AVERAGE_BMI;
    weights.heavy = clamp((relative - 1) / 0.5);
    weights.light = clamp((1 - relative) / 0.5);
  }
  if (profile.build === 'muscular') weights.muscular = 0.7;
  if (profile.build === 'slight') weights.slight = 0.7;
  for (const k of ['heavy', 'light', 'muscular', 'slight']) weights[`female_${k}`] = f * weights[k];
  return { weights, stature, height, scale, bmi };
}

/**
 * @param {Parameters<typeof profileWeights>[0]} profile
 * @param {number} zeroG 0 = preflight on Earth, 1 = adapted to weightlessness
 * @param {object} [cal] scan calibration (defaults to src/body-calibration.mjs)
 */
export function physique(profile = {}, zeroG = 0, cal = undefined) {
  // A stated mass (a measurement) beats the scan's weight estimate; saving a scan clears mass, so this is rare.
  const massStated = valid(profile.massKg, LIMITS.massKg) && valid(profile.heightCm, LIMITS.heightCm);
  const scanWeight = validScan(profile.scan) && !massStated ? profile.scan.detected?.weight : undefined;
  const { weights, stature, height, scale, bmi } = profileWeights(profile, typeof scanWeight === 'number' ? scanWeight : undefined);
  const scan = validScan(profile.scan) ? fitScan(profile.scan, weights, cal) : null;
  if (scan) for (const m of SHAPE) { weights[`${m}_wide`] = Math.max(0, scan.amount[m]); weights[`${m}_narrow`] = Math.max(0, -scan.amount[m]); }
  // The spine morph adds 3% of the reference stature; weight it so the stretch is 3% of this person's stature.
  weights.spine_0g = clamp(zeroG) * stature / STATURE.male;
  weights.fluid_0g = clamp(zeroG);
  const preflightCm = Math.round((height ?? stature) * 100);
  return { weights, scale, bmi: bmi == null ? null : Math.round(bmi * 10) / 10, preflightCm, statureCm: Math.round(preflightCm * (1 + SPINE_STRETCH * clamp(zeroG))), scan };
}

export const BUILDS = ['slight', 'average', 'muscular'];
/** Misfit margin (in squared standard deviations) the best guess needs over the next one to count as sure. */
export const SURE = 4;

/** Weight levels tried when there is no mass: heavy (+) / light (-) morph weight. */
export const WEIGHTS = [-0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6, 0.8, 1];

/**
 * Which body would explain a scan best: every sex and build (and, without a stated mass, every weight level) is
 * tried, and the shoulder, waist and hip morphs absorb the rest. A guess is only "sure" when it beats the best
 * alternative clearly; otherwise the crew member sets it. This reads body proportions, not gender identity.
 * @param {Parameters<typeof profileWeights>[0]} profile mass is used when stated; sex and build are ignored
 * @param {Record<string, any>} scan
 * @param {object} [cal] scan calibration (defaults to src/body-calibration.mjs)
 * @returns {{ sex: 'female' | 'male', build: 'slight' | 'average' | 'muscular', weight: number | null,
 *   sure: { sex: boolean, build: boolean }, margin: { sex: number, build: number }, fits: object[] }}
 *   weight: the heavy (+) / light (-) estimate, or null when mass was stated
 */
export function detectShape(profile, scan, cal = undefined) {
  const { bmi } = profileWeights(profile);
  const levels = bmi == null ? WEIGHTS : [undefined];
  const fits = [];
  for (const sex of ['female', 'male']) for (const build of BUILDS) for (const weight of levels) {
    fits.push({ sex, build, weight: weight ?? null, ...fitScan(scan, profileWeights({ ...profile, sex, build }, weight).weights, cal) });
  }
  fits.sort((a, b) => a.cost - b.cost);
  const best = fits[0];
  const next = pred => Math.min(...fits.filter(pred).map(f => f.cost)) - best.cost;
  const margin = { sex: next(f => f.sex !== best.sex), build: next(f => f.sex === best.sex && f.build !== best.build) };
  return { sex: best.sex, build: best.build, weight: best.weight, sure: { sex: margin.sex >= SURE, build: margin.build >= SURE }, margin, fits };
}

/** HIDH Table 4.3-4: stature increases about 3% in 0g from spinal elongation. */
export const SPINE_STRETCH = 0.03;

/** HIDH Table 4.3-4: spinal elongation starts in the first day or two of weightlessness and is then retained. */
export const zeroGForSol = sol => clamp((sol - 1) / 2);

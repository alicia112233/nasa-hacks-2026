/**
 * Crew profile → shape of the Blender body (public/models/body.glb, built by scripts/blender/build_body.py).
 *
 * The reference body is a 35-year-old male in NASA's 0g neutral body posture. Each morph target is the posed
 * difference to another MakeHuman macro shape, so a profile blends them:
 *  - sex picks the female shape (cross terms keep heavy/slight bodies sex-specific);
 *  - height scales the whole body to the stated stature;
 *  - mass becomes BMI, compared with an average-weight body. MakeHuman's weight macro spans 50% to 150% of
 *    average body weight, so ±50% relative BMI is a full morph. This is an approximation for a picture, not a
 *    body-composition measurement;
 *  - build picks the muscular or slight shape;
 *  - zero-g applies NASA HIDH Table 4.3-4: +3% stature from spinal elongation, and the fluid shift that thins
 *    the legs and fills the face, both within the first days of weightlessness.
 */

export const STATURE = { male: 1.7242, female: 1.5907 };
export const MORPHS = ['female', 'heavy', 'light', 'muscular', 'slight', 'female_heavy', 'female_light', 'female_muscular',
  'female_slight', 'shoulders_wide', 'shoulders_narrow', 'waist_wide', 'waist_narrow', 'hips_wide', 'hips_narrow', 'fluid_0g', 'spine_0g'];
/** BMI of the MakeHuman average-weight body at average height, used as the "average weight" point. */
export const AVERAGE_BMI = 21.7;
export const LIMITS = { heightCm: [140, 210], massKg: [35, 160] };

const clamp = (x, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
const valid = (x, [lo, hi]) => typeof x === 'number' && Number.isFinite(x) && x >= lo && x <= hi;

/**
 * @param {{ sex?: 'female' | 'male', heightCm?: number, massKg?: number, build?: 'slight' | 'average' | 'muscular' }} profile
 * @param {number} zeroG 0 = preflight on Earth, 1 = adapted to weightlessness
 */
export function physique(profile = {}, zeroG = 0) {
  const weights = Object.fromEntries(MORPHS.map(name => [name, 0]));
  const f = profile.sex === 'female' ? 1 : 0;
  weights.female = f;
  const stature = STATURE.male + f * (STATURE.female - STATURE.male);
  const height = valid(profile.heightCm, LIMITS.heightCm) ? profile.heightCm / 100 : null;
  const scale = height ? height / stature : 1;
  let bmi = null;
  if (height && valid(profile.massKg, LIMITS.massKg)) {
    bmi = profile.massKg / (height * height);
    const relative = bmi / AVERAGE_BMI;
    weights.heavy = clamp((relative - 1) / 0.5);
    weights.light = clamp((1 - relative) / 0.5);
  }
  if (profile.build === 'muscular') weights.muscular = 0.7;
  if (profile.build === 'slight') weights.slight = 0.7;
  for (const k of ['heavy', 'light', 'muscular', 'slight']) weights[`female_${k}`] = f * weights[k];
  // The spine morph adds 3% of the reference stature; weight it so the stretch is 3% of this person's stature.
  weights.spine_0g = clamp(zeroG) * stature / STATURE.male;
  weights.fluid_0g = clamp(zeroG);
  const preflightCm = Math.round((height ?? stature) * 100);
  return { weights, scale, bmi: bmi == null ? null : Math.round(bmi * 10) / 10, preflightCm, statureCm: Math.round(preflightCm * (1 + SPINE_STRETCH * clamp(zeroG))) };
}

/** HIDH Table 4.3-4: stature increases about 3% in 0g from spinal elongation. */
export const SPINE_STRETCH = 0.03;

/** HIDH Table 4.3-4: spinal elongation starts in the first day or two of weightlessness and is then retained. */
export const zeroGForSol = sol => clamp((sol - 1) / 2);

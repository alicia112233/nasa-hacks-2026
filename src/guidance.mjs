/**
 * Plain instructions for every self-check: how to take it, why it matters (each line follows the NASA HRP risk the
 * check already maps to in src/body.mjs), what a result means, and what to do when a reading is off.
 *
 * Guidance stays procedural and conservative: rest and recheck, follow the mission-approved procedure, and hand off
 * to the flight surgeon. It never diagnoses. Levels:
 *  - watch: look after yourself and recheck;
 *  - tell: add it to the next handoff for the flight surgeon;
 *  - now: tell the flight surgeon now (and the crew), and follow the mission procedure.
 */

/** How to take each check, in one line. @type {Record<string, string>} */
export const HOW = {
  headache: 'Headache now? Choose none, mild or strong. Note onset and location for handoff.',
  attention: 'Sit still. Tap the moment the docking light turns green. 60 s.',
  sleep: 'Rate your last sleep period, from 1 (very low) to 5 (great).',
  sleepHours: 'Hours actually asleep last sleep period, from your watch or a best guess.',
  temperature: 'Use your thermometer’s instructions; enter its reading, method and measurement time.',
  bp: 'Sit 5 min, arm resting at heart height, then take the cuff reading.',
  mood: 'Rate how you feel right now.',
  energy: 'Rate your energy right now.',
  dizziness: 'Hold still with eyes open for 10 s. Any spinning or unsteadiness?',
  workload: 'Rate whether today’s tasks fit the time you have.',
  team: 'Rate how well the crew worked together today.',
  vision: 'At arm’s length, read each line until it blurs, one eye at a time.',
  heartRate: 'Rest 5 min. Count your wrist pulse for 30 s and double it.',
  breath: 'At rest, notice any breathlessness or effort to breathe.',
  joint: 'Check shoulders, elbows and knees for aching after a spacewalk; else tap No spacewalk.',
  appetite: 'Rate your appetite and how much of today’s meals you ate.',
  gut: 'Any nausea, cramps or loose stools today?',
  shoulder: 'Hips to elbows in view. Raise both arms slowly, lower, repeat.',
  skin: 'Check hands, face and lips for rash or cold sores.',
  grip: 'Press each fingertip. Any pain or numbness after glove work?',
  back: 'Any back pain at rest, or when you bend or twist?',
  exercise: 'Enter today’s minutes on the treadmill, cycle and resistance device.',
  legs: 'Body scan: feet in view, arms a little out, hold still 5 s.',
};

/** Why each check matters in flight, in one line. @type {Record<string, string>} */
export const WHY = {
  attention: 'Fatigue and poor sleep slow reactions before you notice them.',
  sleep: 'Sleep loss is common in flight and affects every task.',
  sleepHours: 'Crews often sleep under 6 hours in flight; hours show it plainly.',
  temperature: 'A fever can be the first sign of infection; immunity shifts in flight.',
  bp: 'Fluid shifts and deconditioning change blood pressure in flight.',
  mood: 'Isolation and confinement can wear mood down gradually.',
  energy: 'Low energy can be an early sign of poor sleep or illness.',
  dizziness: 'Weightlessness changes how your balance system works.',
  headache: 'Shared headache reports prompt a cabin review; several causes are possible.',
  workload: 'Too much or too little work both raise the risk of errors.',
  team: 'Small frictions grow in isolation; they are worth noticing early.',
  vision: 'Vision changes can be a sign of SANS, linked to fluid shifts.',
  heartRate: 'Fluid shifts and deconditioning change heart rate in flight.',
  breath: 'Breathlessness can mean low oxygen or high cabin CO₂.',
  joint: 'Joint pain after a spacewalk can be decompression sickness.',
  appetite: 'Eating too little speeds bone and muscle loss.',
  gut: 'Microbes behave differently in a closed habitat.',
  shoulder: 'Muscle and joint fitness drop without gravity.',
  skin: 'Immune changes in flight can reactivate viruses such as cold sores.',
  grip: 'Spacewalk gloves can injure fingertips and nails.',
  back: 'The spine lengthens in weightlessness, and back pain is common.',
  exercise: 'The T2 treadmill, CEVIS cycle and ARED load the legs, protecting bone and muscle.',
  legs: 'Thigh breadth tracks fluid shift and leg muscle; narrower alone isn’t muscle loss.',
};

export const LEVELS = { watch: 'Watch', tell: 'Tell surgeon', now: 'Act now' };
/** General adult resting heart rate, 60–100 bpm (American Heart Association); under 50 is treated as low. */
export const RESTING_HR = [60, 100];
/**
 * A reading clearly outside its range, with its urgency, a word for it and a few words of what to do. General adult
 * ranges: resting heart rate 50–100 bpm (AHA); temperature 38 °C and over is a fever; blood pressure from the AHA
 * categories (130/80 raised, 140/90 high, 180/120 very high, under 90/60 low); sleep under 6 hours is short.
 * @returns {null | { level: 'watch' | 'tell' | 'now', word: string, tip: string }}
 */
export function vitalFinding(check, value, dia) {
  if (typeof value !== 'number') return null;
  const d = typeof dia === 'number' ? dia : null;
  switch (check.field) {
    case 'heartRate':
      if (value > RESTING_HR[1]) return { level: 'tell', word: 'high at rest', tip: 'rest 5 min, recheck' };
      if (value < 50) return { level: 'tell', word: 'low', tip: 'recheck; dizzy? hand it off' };
      return null;
    case 'temperatureC':
      if (value >= 38) return { level: 'tell', word: 'fever', tip: 'rest, drink, tell the surgeon' };
      if (value >= 37.5) return { level: 'watch', word: 'slightly raised', tip: 'recheck in 4 h' };
      if (value < 35) return { level: 'tell', word: 'low', tip: 'warm up, recheck' };
      return null;
    case 'bpSys':
      if (value >= 180 || (d ?? 0) >= 120) return { level: 'now', word: 'very high', tip: 'recheck now; tell the surgeon' };
      if (value >= 140 || (d ?? 0) >= 90) return { level: 'tell', word: 'high', tip: 'rest 5 min, recheck' };
      if (value >= 130 || (d ?? 0) >= 80) return { level: 'watch', word: 'raised', tip: 'recheck tomorrow' };
      if (value < 90 || (d != null && d < 60)) return { level: 'watch', word: 'low', tip: 'drink, stand up slowly' };
      return null;
    case 'sleepHours':
      if (value < 5) return { level: 'tell', word: 'very short', tip: 'protect your next sleep' };
      if (value < 6) return { level: 'watch', word: 'short', tip: 'protect your next sleep' };
      return null;
    default: return null;
  }
}
/** A vital sign clearly outside its range. */
export const outOfRange = (check, value, dia) => !!vitalFinding(check, value, dia);
/** A 1–5 rating of 1 (very low) or 2 (low). */
export const lowRating = (check, value) => check.kind === 'scale' && typeof value === 'number' && value <= 2;
/** Steps for a low rating: 2 low, 1 very low. */
const LOW = {
  sleep: [
    { level: 'watch', steps: [{ text: 'Protect your next sleep period: dim light, earplugs, no screens.' }, { text: 'Note what disturbed it: noise, light, schedule or worry.' }, { text: 'Two low nights in a row? Hand it off.', action: 'handoff' }] },
    { level: 'tell', steps: [{ text: 'Tell the medical lead; very poor sleep affects every task.', action: 'handoff' }, { text: 'Protect your next sleep period: dim light, earplugs, no screens.' }] }],
  mood: [
    { level: 'watch', steps: [{ text: 'Talk to a crewmate, or use your next private call home.' }, { text: 'Note what is weighing on you.' }, { text: 'Low for several days? Hand it off.', action: 'handoff' }] },
    { level: 'tell', steps: [{ text: 'Talk to the medical lead or flight surgeon today.', action: 'handoff' }, { text: 'Tell a crewmate how you feel.' }] }],
  energy: [
    { level: 'watch', steps: [{ text: 'Eat, drink water and take a short break.' }, { text: 'Rate it again later today.', action: 'retake' }] },
    { level: 'tell', steps: [{ text: 'Rest, and check sleep and appetite too.' }, { text: 'Still very low later? Hand it off.', action: 'handoff' }] }],
  appetite: [
    { level: 'watch', steps: [{ text: 'Eat a full meal or a snack now.' }, { text: 'Note what put you off: taste, nausea or no time.' }] },
    { level: 'tell', steps: [{ text: 'Eating very little speeds bone and muscle loss: hand it off.', action: 'handoff' }, { text: 'Eat what you can now.' }] }],
  workload: [
    { level: 'watch', steps: [{ text: 'Tell the crew lead which tasks don’t fit; ask for a re-plan.' }, { text: 'Take your scheduled breaks.' }] },
    { level: 'tell', steps: [{ text: 'Raise it with the crew lead and ground today.', action: 'handoff' }] }],
  team: [
    { level: 'watch', steps: [{ text: 'Raise it early, at the next crew debrief.' }, { text: 'Note what happened, without blame.' }] },
    { level: 'tell', steps: [{ text: 'Talk to the crew lead or flight surgeon today.', action: 'handoff' }] }],
};
/** The few words shown on a result that is off, so feedback is instant. */
const TIP = {
  sleep: 'protect your next sleep', mood: 'talk to a crewmate', energy: 'eat, drink, take a break', appetite: 'eat a full meal now', workload: 'ask for a re-plan', team: 'raise it at debrief',
  headache: 'note when it started', dizziness: 'move slowly, hold a rail', vision: 'tell the surgeon', breath: 'rest, check cabin CO₂', joint: 'tell the surgeon',
  gut: 'keep fluids up', skin: 'keep it clean and dry', grip: 'note the glove and task', back: 'stretch gently',
};
/** Steps for an out-of-range vital, by value; the level comes from vitalFinding. */
const VITAL = {
  heartRate: v => v > RESTING_HR[1]
    ? [{ text: 'Rest 5 min, then take it again.', action: 'retake' }, { text: 'Still over 100 at rest? Hand it off.', action: 'handoff' }]
    : [{ text: 'Sit still 5 min, then take it again.', action: 'retake' }, { text: 'Dizzy or faint? Hand it off now.', action: 'handoff' }],
  temperatureC: v => v >= 37.5
    ? [{ text: 'Rest and drink fluids.' }, { text: 'Take it again in 4 hours.', action: 'retake' }, { text: '38 °C or more? Hand it off with your symptoms.', action: 'handoff' }]
    : [{ text: 'Warm up and take it again in 15 min.', action: 'retake' }, { text: 'Still under 35 °C? Hand it off.', action: 'handoff' }],
  bpSys: (v, d) => v >= 180 || (d ?? 0) >= 120
    ? [{ text: 'Tell the medical lead now and follow the mission procedure.', action: 'handoff' }, { text: 'Repeat the cuff reading as the procedure directs.', action: 'retake' }]
    : v >= 130 || (d ?? 0) >= 80
      ? [{ text: 'Sit quietly 5 min and take it again.', action: 'retake' }, { text: 'Headache, chest pain or blurred vision? Tell the surgeon now.', action: 'handoff' }, { text: 'Still high tomorrow? Hand it off.', action: 'handoff' }]
      : [{ text: 'Drink water and stand up slowly.' }, { text: 'Dizzy or faint? Hand it off.', action: 'handoff' }],
  sleepHours: v => LOW.sleep[v < 5 ? 1 : 0].steps,
};
const RANK = { watch: 0, tell: 1, now: 2 };

/** Steps for a trend against the ghost. action: retake | followup | handoff. */
const TREND = {
  reactionMs: { level: 'watch', steps: [
    { text: 'Retake it after a rest, not straight after exercise.', action: 'retake' },
    { text: 'Check last night’s sleep and today’s workload.' },
    { text: 'Still slower tomorrow? Hand it off.', action: 'followup' }] },
  sleep: { level: 'watch', steps: [
    { text: 'Protect your next sleep period: dim light, earplugs, no screens.' },
    { text: 'Note what disturbed it: noise, light, schedule or worry.' },
    { text: 'Two low nights in a row? Hand it off.', action: 'followup' }] },
  leftRange: { level: 'watch', steps: [
    { text: 'Repeat it from the same camera spot.', action: 'retake' },
    { text: 'Do your mobility routine before the next check.' },
    { text: 'Pain or weakness? Hand it off.', action: 'handoff' }] },
  thighCm: { level: 'watch', steps: [
    { text: 'Check today’s exercise against your plan.' },
    { text: 'Rescan in 3 days, same spot and stance.', action: 'followup' },
    { text: 'Still falling? Hand it off.', action: 'handoff' }] },
  heartRate: { level: 'watch', steps: [
    { text: 'Take it again after 5 min rest, at the same time of day.', action: 'retake' },
    { text: 'Check sleep, fluids and stress.' },
    { text: 'Still rising in 3 days? Hand it off.', action: 'followup' }] },
  exerciseMin: { level: 'watch', steps: [
    { text: 'Book today’s sessions on the treadmill, cycle and resistance device.' },
    { text: 'No room in the schedule? Tell the crew lead.' },
    { text: 'Below plan for a week? Hand it off.', action: 'followup' }] },
};
// A rating that slips a point from the ghost, or sleep hours that drop, take the low-rating steps.
for (const k of ['mood', 'energy', 'appetite', 'workload', 'team']) TREND[k] = LOW[k][0];
TREND.sleepHours = LOW.sleep[0];

/** The plan for each kind of finding, so the shared assessment and the region card give the same steps. */
export const trendPlan = field => TREND[field] ?? null;
export const symptomPlan = (field, value) => (SYMPTOM[field] && value > 0 ? SYMPTOM[field][Math.min(value, 2) - 1] : null);
export const lowPlan = (field, value) => (LOW[field] ? LOW[field][value === 1 ? 1 : 0] : null);
export function vitalPlan(check, value, dia) {
  const f = vitalFinding(check, value, dia);
  return f && VITAL[check.field] ? { level: f.level, steps: VITAL[check.field](value, dia) } : null;
}

/** Steps for a reported symptom, by severity: 1 mild, 2 strong. */
const SYMPTOM = {
  headache: [
    { level: 'watch', steps: [{ text: 'Note when and where it started.' }, { text: 'Review current cabin readings in I Cabin; archived NASA data cannot describe today’s air.' }, { text: 'Persisting or worsening? Hand it off.', action: 'handoff' }] },
    { level: 'tell', steps: [{ text: 'Tell the mission medical lead now and follow the onboard procedure.', action: 'handoff' }, { text: 'Check for shared symptoms and obtain current cabin readings.' }] }],
  dizziness: [
    { level: 'watch', steps: [{ text: 'Move slowly and hold a handrail when you start moving.' }, { text: 'Recheck tomorrow.', action: 'followup' }] },
    { level: 'tell', steps: [{ text: 'Avoid hazardous tasks until it settles.' }, { text: 'Hand it off.', action: 'handoff' }] }],
  vision: [
    { level: 'tell', steps: [{ text: 'Vision changes go to the flight surgeon: hand it off.', action: 'handoff' }, { text: 'Recheck daily, same distance and light.', action: 'followup' }] },
    { level: 'now', steps: [{ text: 'Tell the flight surgeon now.', action: 'handoff' }, { text: 'Recheck daily, same distance and light.' }] }],
  breath: [
    { level: 'watch', steps: [{ text: 'Rest, and check cabin CO₂ in I Cabin.' }, { text: 'Recheck in an hour.', action: 'retake' }] },
    { level: 'now', steps: [{ text: 'Stop what you are doing and tell a crewmate.' }, { text: 'Tell the flight surgeon now and follow the mission procedure.', action: 'handoff' }] }],
  joint: [
    { level: 'tell', steps: [{ text: 'After a spacewalk this can be decompression sickness: hand it off.', action: 'handoff' }, { text: 'Recheck in an hour.', action: 'retake' }] },
    { level: 'now', steps: [{ text: 'Tell the flight surgeon now and follow the mission procedure.', action: 'handoff' }] }],
  gut: [
    { level: 'watch', steps: [{ text: 'Keep fluids up and note what you ate.' }, { text: 'Recheck tomorrow.', action: 'followup' }] },
    { level: 'tell', steps: [{ text: 'Hand it off, with when it started.', action: 'handoff' }] }],
  skin: [
    { level: 'watch', steps: [{ text: 'Keep it clean and dry; avoid touching it.' }, { text: 'Recheck tomorrow.', action: 'followup' }] },
    { level: 'tell', steps: [{ text: 'Hand it off, with where it is and when it started.', action: 'handoff' }] }],
  grip: [
    { level: 'watch', steps: [{ text: 'Note which glove and task caused it.' }, { text: 'Recheck tomorrow.', action: 'followup' }] },
    { level: 'tell', steps: [{ text: 'Hand it off before the next spacewalk.', action: 'handoff' }] }],
  back: [
    { level: 'watch', steps: [{ text: 'Stretch gently as in your exercise plan.' }, { text: 'Recheck tomorrow.', action: 'followup' }] },
    { level: 'tell', steps: [{ text: 'Hand it off, with what makes it worse.', action: 'handoff' }] }],
};

/**
 * What to do for a region's off readings: the highest level among them, and up to three steps, each with an optional
 * action. Duplicate steps across readings are merged.
 * @param {{ check: { id: string, field?: string }, flagged: boolean, reported: boolean, last: number | null }[]} items
 * @returns {null | { level: 'watch' | 'tell' | 'now', steps: { text: string, action?: string, checkId: string }[] }}
 */
export function nextSteps(items) {
  const plans = [];
  for (const i of items) {
    // A shared-assessment alert already carries its level and steps.
    if (i.concern) { plans.push({ level: i.concern.level, steps: i.concern.steps, checkId: i.check.id }); continue; }
    if (i.flagged && TREND[i.check.field]) plans.push({ ...TREND[i.check.field], checkId: i.check.id });
    else if (i.reported && symptomPlan(i.check.field, i.last)) plans.push({ ...symptomPlan(i.check.field, i.last), checkId: i.check.id });
    else if (i.reported && vitalPlan(i.check, i.last, i.last2)) plans.push({ ...vitalPlan(i.check, i.last, i.last2), checkId: i.check.id });
    else if (i.reported && LOW[i.check.field] && lowRating(i.check, i.last)) plans.push({ ...lowPlan(i.check.field, i.last), checkId: i.check.id });
  }
  if (!plans.length) return null;
  plans.sort((a, b) => RANK[b.level] - RANK[a.level]);
  const steps = [], seen = new Set();
  for (const p of plans) for (const s of p.steps) if (!seen.has(s.text) && steps.length < 3) { seen.add(s.text); steps.push({ ...s, checkId: p.checkId }); }
  return { level: plans[0].level, steps };
}

/**
 * What a saved result means, in a few words: today's value against the ghost, and a plain warning when a value is
 * clearly off for its kind.
 * @returns {{ text: string, level: 'ok' | 'watch' }}
 */
export function resultLine(check, value, ghost, dia) {
  const unit = check.unit === '°' ? '°' : check.unit ? ` ${check.unit}` : '';
  const show = v => (check.decimals ? trimTo(v, check.decimals) : check.unit === 'cm' ? v.toFixed(1) : Math.round(v));
  if (check.options) {
    const off = (check.kind === 'symptom' && value > 0) || lowRating(check, value);
    return { text: `Today ${check.options[check.kind === 'scale' ? value - 1 : value].toLowerCase()}${off && TIP[check.field] ? ` · ${TIP[check.field]}` : ''}`, level: off ? 'watch' : 'ok' };
  }
  const reading = check.field2 ? `${Math.round(value)}/${dia ?? '—'}` : show(value);
  const finding = vitalFinding(check, value, dia);
  if (finding) return { text: `Today ${reading}${unit} · ${finding.word}: ${finding.tip}`, level: 'watch' };
  return { text: `Today ${reading}${unit}${ghost != null && !check.field2 ? ` · ghost ${show(ghost)}${unit}` : ''}`, level: 'ok' };
}
/** A value to at most this many decimals, without trailing zeros. */
export const trimTo = (v, d) => String(Math.round(v * 10 ** d) / 10 ** d);

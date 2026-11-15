// Body index: NASA's five hazards and 17 Human Research Program risks, mapped to body
// regions and the checks a crew member can run. Links verified 2026-11-14.
import { assess } from './assess.mjs';
import { cameraKeys, measuredAt } from './references.mjs';
import { planState, cadenceLabel, UNWELL } from './plan.mjs';

export const hazards = [
  { id: 'radiation', label: 'Radiation', color: '#8e2a8b', url: 'https://www.nasa.gov/hrp/hazard-space-radiation/' },
  { id: 'isolation', label: 'Isolation', color: '#2e6f9e', url: 'https://www.nasa.gov/hrp/hazard-isolation-and-confinement/' },
  { id: 'distance', label: 'Distance', color: '#1f7a5c', url: 'https://www.nasa.gov/hrp/hazard-distance-from-earth/' },
  { id: 'gravity', label: 'Gravity', color: '#9c5419', url: 'https://www.nasa.gov/hrp/hazard-gravity-fields/' },
  { id: 'environment', label: 'Closed habitat', color: '#0f7c86', url: 'https://www.nasa.gov/hrp/hazard-hostile-closed-environments/' },
];

/** @param {string} id @param {string} label @param {string} slug @param {string[]} riskHazards */
const risk = (id, label, slug, riskHazards) => ({ id, label, url: `https://www.nasa.gov/reference/${slug}/`, hazards: riskHazards });
export const risks = [
  risk('immune', 'Altered immune response', 'risk-of-altered-immune-system-responses', ['environment']),
  risk('sensorimotor', 'Sensorimotor and vestibular change', 'risk-of-altered-sensorimotor-and-vestibular-function', ['gravity']),
  risk('cardiovascular', 'Cardiovascular adaptation', 'risk-of-cardiovascular-adaptations', ['gravity', 'radiation']),
  risk('dcs', 'Decompression sickness', 'risk-of-decompression-sickness', ['environment']),
  risk('microbes', 'Host–microorganism interactions', 'risk-of-host-microorganism-interactions', ['environment']),
  risk('hypoxia', 'Hypoxia', 'risk-of-hypoxia', ['environment']),
  risk('nutrition', 'Inadequate food and nutrition', 'risk-of-inadequate-food-and-nutrition', ['distance']),
  risk('eva', 'Spacewalk injury and performance', 'risk-of-injury-and-compromised-performance-from-extravehicular-activity-eva', ['environment', 'gravity']),
  risk('fitness', 'Reduced cardiorespiratory and muscle fitness', 'risk-of-reduced-cardiorespiratory-and-musculoskeletal-fitness', ['gravity']),
  risk('sans', 'Neuro-ocular syndrome (SANS)', 'risk-of-spaceflight-associated-neuro-ocular-syndrome-sans', ['gravity']),
  risk('bone', 'Bone loss', 'risk-of-spaceflight-induced-bone-changes', ['gravity']),
  risk('behavioral', 'Behavioral conditions', 'risk-of-behavioral-conditions-and-psychiatric-disorders', ['isolation', 'distance']),
  risk('teamwork', 'Inadequate teamwork', 'risk-of-inadequate-teamwork', ['isolation']),
  risk('sleep', 'Inadequate sleep and irregular schedules', 'risk-from-inadequate-sleep-and-irregular-schedules', ['isolation']),
  risk('support', 'Inadequate systems support', 'risk-of-inadequate-systems-operations-support', ['distance']),
  risk('loads', 'Injury from dynamic loads', 'risk-of-injury-from-dynamic-loads', ['gravity']),
  risk('cancer', 'Radiation-induced cancer', 'risk-of-radiation-induced-cancers', ['radiation']),
];
export const risksUrl = 'https://www.nasa.gov/hrp/risks/';

const SCALE = ['Very low', 'Low', 'Okay', 'Good', 'Great'];
const SYMPTOM = ['None', 'Mild', 'Strong'];
/**
 * kind: task (timed attention task) · scale (1–5) · symptom (0–2) · number · bp (two numbers) · camera · instrument · data
 * field: the CheckIn property a result writes (field2: the second, for blood pressure); instrument and data checks write nothing.
 * seconds: recording time. prep: preparation first (rest or camera set-up), shown apart, so "20 s" never hides 5 min of rest.
 * methods: how a structured reading can be taken; the first is the default. Every reading keeps its unit, time and method.
 */
export const checks = [
  { id: 'attention', region: 'head', title: 'Attention', seconds: 60, kind: 'task', field: 'reactionMs', unit: 'ms', risks: ['behavioral', 'sleep', 'support'] },
  { id: 'sleep', region: 'head', title: 'Sleep quality', seconds: 5, kind: 'scale', field: 'sleep', options: SCALE, risks: ['sleep'] },
  { id: 'sleepHours', region: 'head', title: 'Sleep duration', seconds: 10, kind: 'number', field: 'sleepHours', unit: 'h', min: 0, max: 16, step: 0.25, decimals: 2, methods: ['Estimate', 'Sleep watch'], timeLabel: 'Woke at', risks: ['sleep'] },
  { id: 'mood', region: 'head', title: 'Mood', seconds: 5, kind: 'scale', field: 'mood', options: SCALE, risks: ['behavioral'] },
  { id: 'energy', region: 'head', title: 'Energy', seconds: 5, kind: 'scale', field: 'energy', options: SCALE, risks: ['behavioral', 'sleep'] },
  { id: 'dizziness', region: 'head', title: 'Dizziness or poor balance', seconds: 5, kind: 'symptom', field: 'dizziness', options: SYMPTOM, risks: ['sensorimotor'] },
  { id: 'headache', region: 'head', title: 'Headache', seconds: 5, kind: 'symptom', field: 'headache', options: SYMPTOM, risks: ['hypoxia'] },
  { id: 'workload', region: 'head', title: 'Workload is manageable', seconds: 5, kind: 'scale', field: 'workload', options: SCALE, risks: ['support'] },
  { id: 'team', region: 'head', title: 'Crew working well together', seconds: 5, kind: 'scale', field: 'team', options: SCALE, risks: ['teamwork'] },
  { id: 'vision', region: 'eyes', title: 'Blurred or changed vision', seconds: 30, kind: 'symptom', field: 'vision', options: SYMPTOM, risks: ['sans'] },
  { id: 'oct', region: 'eyes', title: 'Eye imaging (OCT)', kind: 'instrument', needs: 'Needs OCT imager', risks: ['sans'] },
  { id: 'heartRate', region: 'chest', title: 'Resting heart rate', seconds: 30, prep: 300, prepLabel: 'Rest', kind: 'number', field: 'heartRate', unit: 'bpm', min: 30, max: 220, methods: ['Wrist pulse', 'Heart-rate monitor'], risks: ['cardiovascular'] },
  { id: 'temperature', region: 'chest', title: 'Body temperature', seconds: 60, kind: 'number', field: 'temperatureC', unit: '°C', min: 34, max: 42, step: 0.1, decimals: 1, methods: ['Oral', 'Ear', 'Forehead'], risks: ['immune', 'microbes'] },
  { id: 'breath', region: 'chest', title: 'Short of breath', seconds: 5, kind: 'symptom', field: 'breath', options: SYMPTOM, risks: ['hypoxia', 'cardiovascular'] },
  { id: 'joint', region: 'chest', title: 'Joint pain after a spacewalk', seconds: 5, kind: 'symptom', field: 'joint', options: SYMPTOM, skip: 'No spacewalk', risks: ['dcs', 'eva'] },
  { id: 'bp', region: 'chest', title: 'Blood pressure', seconds: 60, prep: 300, prepLabel: 'Rest', kind: 'bp', field: 'bpSys', field2: 'bpDia', unit: 'mmHg', min: 60, max: 260, min2: 30, max2: 160, methods: ['Automatic cuff', 'Manual cuff'], skip: 'No cuff today', risks: ['cardiovascular'] },
  { id: 'appetite', region: 'abdomen', title: 'Appetite and meals', seconds: 5, kind: 'scale', field: 'appetite', options: SCALE, risks: ['nutrition'] },
  { id: 'gut', region: 'abdomen', title: 'Stomach upset', seconds: 5, kind: 'symptom', field: 'gut', options: SYMPTOM, risks: ['microbes'] },
  { id: 'mass', region: 'abdomen', title: 'Body mass', kind: 'instrument', needs: 'Needs mass device', risks: ['nutrition'] },
  { id: 'shoulder', region: 'arms', title: 'Shoulder range', seconds: 12, prep: 30, prepLabel: 'Set up', kind: 'camera', field: 'leftRange', unit: '°', risks: ['fitness', 'eva'] },
  { id: 'skin', region: 'hands', title: 'Rash or cold sore', seconds: 5, kind: 'symptom', field: 'skin', options: SYMPTOM, risks: ['immune', 'microbes'] },
  { id: 'grip', region: 'hands', title: 'Fingertip or grip pain', seconds: 5, kind: 'symptom', field: 'grip', options: SYMPTOM, risks: ['eva'] },
  { id: 'immuneAssay', region: 'hands', title: 'Blood and saliva markers', kind: 'instrument', needs: 'Needs lab sample', risks: ['immune'] },
  { id: 'back', region: 'pelvis', title: 'Back pain', seconds: 5, kind: 'symptom', field: 'back', options: SYMPTOM, risks: ['fitness', 'loads'] },
  { id: 'landing', region: 'pelvis', title: 'Landing load check', kind: 'instrument', needs: 'At landing', risks: ['loads'] },
  { id: 'exercise', region: 'legs', title: 'Exercise today', seconds: 10, kind: 'number', field: 'exerciseMin', unit: 'min', min: 0, max: 300, risks: ['fitness', 'bone'] },
  { id: 'legs', region: 'legs', title: 'Thigh breadth', seconds: 5, prep: 20, prepLabel: 'Set up', kind: 'camera', field: 'thighCm', unit: 'cm', risks: ['fitness', 'cardiovascular'] },
  { id: 'dxa', region: 'legs', title: 'Bone density (DXA)', kind: 'instrument', needs: 'Needs scanner', risks: ['bone'] },
  { id: 'dose', region: 'cabin', title: 'Radiation dose', kind: 'data', series: 'dose', needs: 'Needs personal dosimeter', risks: ['cancer'] },
  { id: 'air', region: 'cabin', title: 'Cabin CO₂ and climate', kind: 'data', series: 'air', risks: ['hypoxia', 'microbes'] },
];

/** @type {{ id: string, letter: string, label: string, meshes: string[] }[]} */
const regionDefs = [
  { id: 'head', letter: 'A', label: 'Head', meshes: ['region_head'] },
  { id: 'eyes', letter: 'B', label: 'Eyes', meshes: ['region_eyes'] },
  { id: 'chest', letter: 'C', label: 'Chest', meshes: ['region_chest'] },
  { id: 'abdomen', letter: 'D', label: 'Abdomen', meshes: ['region_abdomen'] },
  { id: 'arms', letter: 'E', label: 'Arms', meshes: ['region_arm_l', 'region_arm_r'] },
  { id: 'hands', letter: 'F', label: 'Hands', meshes: ['region_hand_l', 'region_hand_r'] },
  { id: 'pelvis', letter: 'G', label: 'Back & pelvis', meshes: ['region_pelvis'] },
  { id: 'legs', letter: 'H', label: 'Legs', meshes: ['region_leg_l', 'region_leg_r'] },
  { id: 'cabin', letter: 'I', label: 'Cabin', meshes: ['region_cabin'] },
];
export const regions = regionDefs.map(({ id, letter, label, meshes }) => {
  const own = checks.filter(c => c.region === id);
  const regionRisks = [...new Set(own.flatMap(c => c.risks))];
  const regionHazards = hazards.map(h => h.id).filter(h => regionRisks.some(r => risks.find(x => x.id === r).hazards.includes(h)));
  return { id, letter, label, meshes, checks: own, risks: regionRisks, hazards: regionHazards };
});
export const regionForMesh = name => regions.find(r => r.meshes.some(m => name === m || name.startsWith(`${m}_`) || name.startsWith(`${m}.`)));

/** Every NASA risk must be reachable from at least one region check. */
export function coverage() {
  return risks.map(r => {
    const covering = checks.filter(c => c.risks.includes(r.id));
    const selfChecks = covering.filter(c => c.field);
    return { ...r, checks: covering.map(c => c.id), regions: [...new Set(covering.map(c => c.region))], onboard: selfChecks.length > 0, instrumentOnly: covering.length > 0 && selfChecks.length === 0 };
  });
}

export const dayKey = date => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore' }).format(new Date(date));
const isNum = v => typeof v === 'number' && Number.isFinite(v);
const DAY = 86400000;
/** Every field a check writes. */
const FIELDS = [...new Set(checks.flatMap(c => [c.field, c.field2]).filter(Boolean)), 'rightRange'];

/** The records as they stood before a day began: anything measured on or after it is left out. */
function beforeDay(checkIns, day) {
  return checkIns.map(r => {
    const copy = { ...r };
    copy.measurements = { ...r.measurements };
    for (const f of FIELDS) if (dayKey(measuredAt(r, f)) >= day) { delete copy[f]; delete copy.measurements[f]; }
    if (dayKey(r.date) >= day) { delete copy.skipped; delete copy.planned; }
    return copy;
  });
}

const DEFAULT_METHOD = { task: 'Docking task', scale: 'Self-rating', symptom: 'Self-report', camera: 'Camera', number: 'Entered by crew' };
/** The unit and method a reading of this field keeps. @param {string} field */
export function readingMeta(field) {
  if (cameraKeys.includes(field) && field === 'rightRange') return { unit: '°', method: 'Camera' };
  const c = checks.find(x => x.field === field || x.field2 === field);
  if (!c) return {};
  return { unit: c.unit ?? (c.kind === 'scale' ? '1–5' : c.kind === 'symptom' ? '0–2' : undefined), method: c.id === 'vision' ? 'Letter chart' : c.methods?.[0] ?? DEFAULT_METHOD[c.kind] };
}

/**
 * Status of each region, as of now. Alerts come from the shared assessment (src/assess.mjs), so every page agrees.
 * Each check is in today's routine when the mission plan (src/plan.mjs) makes it due, an alert asks for a recheck, its
 * last recording was too unclear, or a symptom calls for temperature. Membership is decided from the day's start, so a
 * check that is done, or clears its alert, stays in today's count as done.
 */
export function regionStatuses(checkIns, simulated, now = new Date().toISOString(), references = [], { startDate } = {}) {
  const { analysis, concerns } = assess(checkIns, simulated, references, now);
  const today = dayKey(now), nowMs = Date.parse(now);
  const atStart = assess(beforeDay(checkIns, today), simulated, references, new Date(nowMs - 1).toISOString());
  const records = analysis.records;
  const latest = records.at(-1);
  const sol = startDate ? solOn(startDate, nowMs) : latest ? latest.sol + Math.round((Date.parse(today) - Date.parse(dayKey(latest.date))) / DAY) : 1;
  const dayOfSol = s => dayKey(new Date(nowMs - (sol - s) * DAY));
  const forField = field => records.filter(c => isNum(c[field]) || c.measurements?.[field]).sort((a, b) => measuredAt(a, field).localeCompare(measuredAt(b, field)));
  const skipped = new Set(records.filter(r => dayKey(r.date) === today).flatMap(r => r.skipped ?? []));
  const retained = new Set(records.filter(r => dayKey(r.date) === today).flatMap(r => r.planned ?? []));
  const recentSymptom = list => list.some(c => UNWELL.includes(c.field) && c.measuredAt && nowMs - Date.parse(c.measuredAt) <= DAY && c.measuredAt <= now);
  const unwell = recentSymptom(concerns) || recentSymptom(atStart.concerns);
  const unclear = (comparisons, check, record) => check.kind === 'camera' && !!record && (record.measurements?.[check.field]?.quality === 'poor' || comparisons[check.field]?.state === 'unreliable');
  return Object.fromEntries(regions.map(region => {
    const items = region.checks.map(check => {
      const list = check.field ? forField(check.field) : [];
      const lastRecord = list.at(-1);
      const last = lastRecord && isNum(lastRecord[check.field]) ? lastRecord[check.field] : null;
      const paired = !check.field2 || (isNum(lastRecord?.[check.field2]) && measuredAt(lastRecord, check.field2) === measuredAt(lastRecord, check.field));
      const doneToday = !!lastRecord && last != null && paired && dayKey(measuredAt(lastRecord, check.field)) === today && lastRecord.measurements?.[check.field]?.quality !== 'poor';
      const lastBefore = list.filter(r => isNum(r[check.field]) && dayKey(measuredAt(r, check.field)) < today).at(-1);
      const concern = concerns.find(c => c.checkId === check.id) ?? null;
      const startConcern = atStart.concerns.find(c => c.checkId === check.id);
      const before = lastBefore ? lastRecord === lastBefore ? lastRecord : lastBefore : null;
      const repeat = unclear(analysis.comparisons, check, lastRecord) || unclear(atStart.analysis.comparisons, check, before);
      const plan = !check.field ? null : (concern || startConcern) ? { why: 'followup' } : repeat ? { why: 'repeat' }
        : planState({ id: check.id, sol, lastBeforeToday: lastBefore ? dayKey(measuredAt(lastBefore, check.field)) : null, dayOfSol, alert: false, unwell }) ?? (retained.has(check.id) ? { why: 'due' } : null);
      const isSkipped = skipped.has(check.id);
      return { check, value: doneToday ? last : null, value2: doneToday && check.field2 ? lastRecord[check.field2] ?? null : null,
        last, last2: check.field2 && lastRecord ? lastRecord[check.field2] ?? null : null, done: doneToday,
        ever: check.field ? records.some(c => isNum(c[check.field])) : false,
        concern, flagged: !!concern?.trend, reported: !!concern && !concern.trend,
        due: !!plan && !isSkipped, needsRepeat: unclear(analysis.comparisons, check, lastRecord), why: plan?.why ?? null, since: plan?.since ?? null, skipped: isSkipped, cadence: cadenceLabel(check.id),
        method: lastRecord?.measurements?.[check.field]?.method ?? null,
        lastMeasuredAt: lastRecord ? measuredAt(lastRecord, check.field) : null, comparison: analysis.comparisons[check.field] };
    });
    const self = items.filter(i => i.check.field);
    const due = self.filter(i => i.due);
    const state = items.some(i => i.concern) ? 'flag'
      : due.length && due.every(i => i.done) ? 'done' : !self.some(i => i.ever) ? (self.length ? 'none' : 'instrument') : due.some(i => !i.done) ? 'due' : 'clear';
    return [region.id, { state, items, latestDate: latest?.date ?? null }];
  }));
}

export const totalSeconds = list => list.reduce((sum, c) => sum + (c.seconds ?? 0), 0);
/** Preparation before the recordings: one seated rest serves every check that needs it; camera set-ups add up. */
export const prepSeconds = list => Math.max(0, ...list.filter(c => c.prepLabel === 'Rest').map(c => c.prep)) + list.filter(c => c.prep && c.prepLabel !== 'Rest').reduce((sum, c) => sum + c.prep, 0);

/** NASA risks that are about the mind: behaviour, teamwork, sleep and workload. Every other self-check is physical. */
export const MIND_RISKS = ['behavioral', 'teamwork', 'sleep', 'support'];
/** @param {{ risks: string[] }} check @returns {'mental' | 'physical'} */
export const domainOf = check => (check.risks.every(r => MIND_RISKS.includes(r)) ? 'mental' : 'physical');

/** A neutral name for each check, for lists and next steps: "breathing", not "short of breath". */
const TOPICS = { dizziness: 'Balance', headache: 'Headache', vision: 'Vision', heartRate: 'Heart rate', breath: 'Breathing', joint: 'Joints after a spacewalk',
  appetite: 'Appetite', gut: 'Stomach', shoulder: 'Shoulder range', skin: 'Skin', grip: 'Fingertips and grip', back: 'Back', exercise: 'Exercise', legs: 'Thigh breadth',
  attention: 'Attention', sleep: 'Sleep', sleepHours: 'Sleep hours', mood: 'Mood', energy: 'Energy', workload: 'Workload', team: 'Teamwork',
  temperature: 'Temperature', bp: 'Blood pressure' };
/** @param {{ id: string, title: string }} check */
export const topicOf = check => TOPICS[check.id] ?? check.title;

/** The mission day on a date, with the start date as Sol 1. @param {string} startDate @param {number} [now] */
export const solOn = (startDate, now = Date.now()) => Math.max(1, Math.floor((now - new Date(startDate).getTime()) / 86400000) + 1);

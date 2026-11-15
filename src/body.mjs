// Body index: NASA's five hazards and 17 Human Research Program risks, mapped to body
// regions and the checks a crew member can run. Links verified 2026-11-14.
import { analyze } from './rules.mjs';
import { measuredAt } from './references.mjs';
import { lowRating, outOfRange } from './guidance.mjs';

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
 * kind: task (timed attention task) · scale (1–5) · symptom (0–2) · number · camera · instrument · data
 * field: the CheckIn property a result writes; instrument and data checks write nothing.
 */
export const checks = [
  { id: 'attention', region: 'head', title: 'Attention', seconds: 60, kind: 'task', field: 'reactionMs', unit: 'ms', risks: ['behavioral', 'sleep', 'support'] },
  { id: 'sleep', region: 'head', title: 'Sleep quality', seconds: 5, kind: 'scale', field: 'sleep', options: SCALE, risks: ['sleep'] },
  { id: 'mood', region: 'head', title: 'Mood', seconds: 5, kind: 'scale', field: 'mood', options: SCALE, risks: ['behavioral'] },
  { id: 'energy', region: 'head', title: 'Energy', seconds: 5, kind: 'scale', field: 'energy', options: SCALE, risks: ['behavioral', 'sleep'] },
  { id: 'dizziness', region: 'head', title: 'Dizziness or poor balance', seconds: 5, kind: 'symptom', field: 'dizziness', options: SYMPTOM, risks: ['sensorimotor'] },
  { id: 'headache', region: 'head', title: 'Headache', seconds: 5, kind: 'symptom', field: 'headache', options: SYMPTOM, risks: ['hypoxia'] },
  { id: 'workload', region: 'head', title: 'Workload is manageable', seconds: 5, kind: 'scale', field: 'workload', options: SCALE, risks: ['support'] },
  { id: 'team', region: 'head', title: 'Crew working well together', seconds: 5, kind: 'scale', field: 'team', options: SCALE, risks: ['teamwork'] },
  { id: 'vision', region: 'eyes', title: 'Blurred or changed vision', seconds: 30, kind: 'symptom', field: 'vision', options: SYMPTOM, risks: ['sans'] },
  { id: 'oct', region: 'eyes', title: 'Eye imaging (OCT)', kind: 'instrument', needs: 'Needs OCT imager', risks: ['sans'] },
  { id: 'heartRate', region: 'chest', title: 'Resting heart rate', seconds: 20, kind: 'number', field: 'heartRate', unit: 'bpm', min: 30, max: 220, risks: ['cardiovascular'] },
  { id: 'breath', region: 'chest', title: 'Short of breath', seconds: 5, kind: 'symptom', field: 'breath', options: SYMPTOM, risks: ['hypoxia', 'cardiovascular'] },
  { id: 'joint', region: 'chest', title: 'Joint pain after a spacewalk', seconds: 5, kind: 'symptom', field: 'joint', options: SYMPTOM, skip: 'No spacewalk', risks: ['dcs', 'eva'] },
  { id: 'bp', region: 'chest', title: 'Blood pressure', kind: 'instrument', needs: 'Needs cuff', risks: ['cardiovascular'] },
  { id: 'appetite', region: 'abdomen', title: 'Appetite and meals', seconds: 5, kind: 'scale', field: 'appetite', options: SCALE, risks: ['nutrition'] },
  { id: 'gut', region: 'abdomen', title: 'Stomach upset', seconds: 5, kind: 'symptom', field: 'gut', options: SYMPTOM, risks: ['microbes'] },
  { id: 'mass', region: 'abdomen', title: 'Body mass', kind: 'instrument', needs: 'Needs mass device', risks: ['nutrition'] },
  { id: 'shoulder', region: 'arms', title: 'Shoulder range', seconds: 12, kind: 'camera', field: 'leftRange', unit: '°', risks: ['fitness', 'eva'] },
  { id: 'skin', region: 'hands', title: 'Rash or cold sore', seconds: 5, kind: 'symptom', field: 'skin', options: SYMPTOM, risks: ['immune', 'microbes'] },
  { id: 'grip', region: 'hands', title: 'Fingertip or grip pain', seconds: 5, kind: 'symptom', field: 'grip', options: SYMPTOM, risks: ['eva'] },
  { id: 'immuneAssay', region: 'hands', title: 'Blood and saliva markers', kind: 'instrument', needs: 'Needs lab sample', risks: ['immune'] },
  { id: 'back', region: 'pelvis', title: 'Back pain', seconds: 5, kind: 'symptom', field: 'back', options: SYMPTOM, risks: ['fitness', 'loads'] },
  { id: 'landing', region: 'pelvis', title: 'Landing load check', kind: 'instrument', needs: 'At landing', risks: ['loads'] },
  { id: 'exercise', region: 'legs', title: 'Exercise today', seconds: 10, kind: 'number', field: 'exerciseMin', unit: 'min', min: 0, max: 300, risks: ['fitness', 'bone'] },
  { id: 'legs', region: 'legs', title: 'Thigh breadth', seconds: 5, kind: 'camera', field: 'thighCm', unit: 'cm', risks: ['fitness', 'cardiovascular'] },
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

/** Status of each region for the selected data source, as of its latest entry. */
export function regionStatuses(checkIns, simulated, now = new Date().toISOString(), references = []) {
  const analysis = analyze(checkIns, simulated, references);
  const records = analysis.records;
  const latest = records.at(-1);
  const forField = field => records.filter(c => isNum(c[field]) || c.measurements?.[field]).sort((a, b) => measuredAt(a, field).localeCompare(measuredAt(b, field)));
  const valueToday = field => { const c = forField(field).at(-1); return c && dayKey(measuredAt(c, field)) === dayKey(now) && isNum(c[field]) ? c[field] : null; };
  const lastValue = field => { const c = forField(field).at(-1); return c && isNum(c[field]) ? c[field] : null; };
  const trend = { reactionMs: analysis.attentionFlag, sleep: analysis.wellbeingFlag, leftRange: analysis.movementFlag, thighCm: analysis.legFlag };
  return Object.fromEntries(regions.map(region => {
    const items = region.checks.map(check => {
      const value = check.field ? valueToday(check.field) : null;
      const ever = check.field ? records.some(c => isNum(c[check.field])) : false;
      const flagged = !!trend[check.field];
      const last = check.field ? lastValue(check.field) : null;
      const reported = (check.kind === 'symptom' && last != null && last > 0) || outOfRange(check, last) || lowRating(check, last);
      const lastRecord = check.field ? forField(check.field).at(-1) : null;
      return { check, value, last, done: value != null, ever, flagged, reported, lastMeasuredAt: lastRecord ? measuredAt(lastRecord, check.field) : null, comparison: analysis.comparisons[check.field] };
    });
    const self = items.filter(i => i.check.field);
    const state = items.some(i => i.flagged || i.reported) ? 'flag'
      : self.length && self.every(i => i.done) ? 'done' : self.some(i => i.ever) ? 'due' : self.length ? 'none' : 'instrument';
    return [region.id, { state, items, latestDate: latest?.date ?? null }];
  }));
}

export const totalSeconds = list => list.reduce((sum, c) => sum + (c.seconds ?? 0), 0);

/** NASA risks that are about the mind: behaviour, teamwork, sleep and workload. Every other self-check is physical. */
export const MIND_RISKS = ['behavioral', 'teamwork', 'sleep', 'support'];
/** @param {{ risks: string[] }} check @returns {'mental' | 'physical'} */
export const domainOf = check => (check.risks.every(r => MIND_RISKS.includes(r)) ? 'mental' : 'physical');

/** A neutral name for each check, for lists and next steps: "breathing", not "short of breath". */
const TOPICS = { dizziness: 'Balance', headache: 'Headache', vision: 'Vision', heartRate: 'Heart rate', breath: 'Breathing', joint: 'Joints after a spacewalk',
  appetite: 'Appetite', gut: 'Stomach', shoulder: 'Shoulder range', skin: 'Skin', grip: 'Fingertips and grip', back: 'Back', exercise: 'Exercise', legs: 'Thigh breadth',
  attention: 'Attention', sleep: 'Sleep', mood: 'Mood', energy: 'Energy', workload: 'Workload', team: 'Teamwork' };
/** @param {{ id: string, title: string }} check */
export const topicOf = check => TOPICS[check.id] ?? check.title;

/** The mission day on a date, with the start date as Sol 1. @param {string} startDate @param {number} [now] */
export const solOn = (startDate, now = Date.now()) => Math.max(1, Math.floor((now - new Date(startDate).getTime()) / 86400000) + 1);

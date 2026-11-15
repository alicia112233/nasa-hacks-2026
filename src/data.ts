import type { CheckIn, GhostReference, MissionState, Profile, Recording, RecordingContext } from './types';
import { readingMeta } from './body.mjs';

/** Sample crew ids, stable so tests and reloads find the same people. */
export const DEMO_CREW = { alex: 'crew-alex', jordan: 'crew-jordan', mei: 'crew-mei', diego: 'crew-diego' };
/**
 * Bumped when the sample crew changes, so a device that already has the crew catches up once: new members arrive, and
 * from version 3 the members it has get their generated history again (sleep hours, temperature, blood pressure).
 * Readings entered on the device are kept.
 */
export const SAMPLE_VERSION = 3;

type Series = Record<string, number | number[]>;
const NUMERIC = ['reactionMs', 'sleep', 'sleepHours', 'temperatureC', 'bpSys', 'bpDia', 'mood', 'energy', 'heartRate', 'leftRange', 'rightRange', 'workload', 'team', 'appetite', 'exerciseMin', 'thighCm',
  'dizziness', 'headache', 'vision', 'breath', 'joint', 'gut', 'skin', 'grip', 'back'];
const STEADY: Series = { sleepHours: 7.5, temperatureC: 36.8, bpSys: 118, bpDia: 76, dizziness: 0, headache: 0, vision: 0, breath: 0, joint: 0, gut: 0, skin: 0, grip: 0, back: 0 };

/**
 * Four crew members, each with 14 sols of history for every measure, recorded under the same conditions and with a
 * preflight and cruise ghost, so every comparison holds. Alex: attention, sleep and shoulder slipping. Jordan: thigh
 * breadth 6% below the ghost as exercise falls. Mei: mood and teamwork low, resting heart rate rising. Diego: steady,
 * with all of today's checks done.
 */
export function createDemo(): MissionState {
  const missionStart = new Date();
  missionStart.setDate(missionStart.getDate() - 41);
  missionStart.setHours(0, 0, 0, 0);
  const startDate = missionStart.toISOString();
  const day = (i: number) => { const date = new Date(); date.setDate(date.getDate() - 14 + i); date.setHours(9, 0, 0, 0); return date.toISOString(); };
  const context: RecordingContext = { phase: 'cruise', cameraSetup: 'Camera A, floor mark 2, front view', posture: 'Upright, arms clear', lighting: 'Cabin lights, front lit', clothing: 'Fitted exercise clothes', activity: 'Rested, before exercise' };
  const person = (id: string, name: string, initials: string, rest: Partial<Profile>): Profile => ({ id, name, initials, mission: 'Ares I', duration: 180, startDate, recordingContext: context, ...rest });
  const alex = person(DEMO_CREW.alex, 'Alex Morgan', 'AM', { sex: 'female', heightCm: 168, massKg: 62, build: 'muscular' });
  const jordan = person(DEMO_CREW.jordan, 'Jordan Lee', 'JL', { sex: 'male', heightCm: 181, massKg: 79, build: 'average' });
  const mei = person(DEMO_CREW.mei, 'Mei Tanaka', 'MT', { sex: 'female', heightCm: 162, massKg: 55, build: 'slight' });
  const diego = person(DEMO_CREW.diego, 'Diego Alvarez', 'DA', { sex: 'male', heightCm: 176, massKg: 74, build: 'average' });

  /** One crew member's history: a value per sol (or one value for every sol) for every measure, recorded under the same conditions. */
  const history = (p: Profile, prefix: string, series: Series, days = 14, extra: (i: number) => Partial<CheckIn> = () => ({})): CheckIn[] =>
    Array.from({ length: days }, (_, i) => {
      const date = i < 14 ? day(i) : new Date(Date.now() - 5 * 60000).toISOString();
      const values = Object.fromEntries(Object.entries({ ...STEADY, ...series }).map(([k, v]) => [k, Array.isArray(v) ? v[Math.min(i, v.length - 1)] : v]));
      const entry = { id: `${prefix}-${i}`, crewId: p.id, date, sol: 28 + i, simulated: false, missed: 0, signals: 12, symptoms: [], notes: '', ...values, ...extra(i) } as unknown as CheckIn;
      entry.measurements = Object.fromEntries(NUMERIC.filter(k => typeof (entry as unknown as Record<string, unknown>)[k] === 'number').map(k => [k, { ...context, ...readingMeta(k), measuredAt: date, quality: 'good' as const, ...(['leftRange', 'rightRange', 'thighCm'].includes(k) ? { confidentFrames: 40 } : {}) }]));
      return entry;
    });
  const late = (base: number, after: number) => Array.from({ length: 14 }, (_, i) => (i > 10 ? after : base));

  const checkIns = [
    ...history(alex, 'demo', {
      reactionMs: [309, 319, 311, 305, 321, 314, 308, 315, 318, 311, 312, 351, 369, 382], sleep: [4, 4, 5, 4, 4, 4, 5, 4, 4, 4, 4, 3, 3, 2],
      sleepHours: [7.5, 7.25, 7.5, 7.75, 7.5, 7.5, 7.25, 7.5, 7.5, 7.75, 7.5, 6.5, 6, 5.5],
      mood: late(4, 3), energy: late(4, 2), heartRate: late(64, 68), leftRange: [151, 152, 153, 150, 154, 152, 151, 153, 150, 152, 151, 139, 134, 130], rightRange: late(153, 151),
      workload: 4, team: 4, appetite: 4, exerciseMin: [75, 80, 75, 70, 75, 80, 75, 75, 70, 75, 80, 70, 65, 70], thighCm: [15.9, 15.8, 15.9, 15.8, 15.8, 15.9, 15.8, 15.8, 15.7, 15.8, 15.8, 15.6, 15.5, 15.5],
      vision: Array.from({ length: 14 }, (_, i) => (i > 11 ? 1 : 0)), back: Array.from({ length: 14 }, (_, i) => (i > 12 ? 1 : 0)),
    }, 14, i => ({ missed: i > 10 ? 1 : 0, symptoms: i > 11 ? ['Fatigue', 'Shoulder discomfort'] : [], notes: i > 11 ? 'Slight stiffness during shoulder mobility.' : '' })),
    ...history(jordan, 'demo-j', {
      reactionMs: [296, 301, 293, 298, 290, 299, 295, 297, 292, 300, 294, 296, 299, 293], sleep: 4, mood: 4, energy: late(4, 3), heartRate: 60,
      leftRange: Array.from({ length: 14 }, (_, i) => 158 - (i % 3)), rightRange: Array.from({ length: 14 }, (_, i) => 157 - (i % 2)), workload: 4, team: 4, appetite: 4,
      exerciseMin: [90, 85, 95, 90, 80, 90, 85, 90, 75, 80, 70, 40, 30, 25], thighCm: [16.8, 16.9, 16.8, 16.7, 16.8, 16.9, 16.8, 16.7, 16.8, 16.8, 16.7, 15.9, 15.8, 15.7],
    }),
    ...history(mei, 'demo-m', {
      reactionMs: [288, 292, 285, 290, 287, 291, 289, 286, 293, 288, 290, 296, 299, 301], sleep: [4, 4, 4, 5, 4, 4, 4, 4, 4, 3, 4, 3, 4, 3],
      mood: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 2, 2], energy: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 3, 3], heartRate: [62, 61, 62, 63, 62, 61, 62, 63, 62, 62, 63, 70, 74, 78],
      leftRange: [160, 161, 159, 160, 162, 160, 161, 159, 160, 161, 160, 159, 160, 160], rightRange: 161, workload: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 3, 2],
      team: [4, 4, 4, 5, 4, 4, 4, 4, 4, 4, 4, 3, 2, 2], appetite: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 3, 3], exerciseMin: [80, 85, 80, 90, 85, 80, 85, 80, 85, 80, 85, 80, 75, 80],
      thighCm: [15.1, 15.2, 15.1, 15.1, 15.2, 15.1, 15.1, 15.2, 15.1, 15.1, 15.2, 15.1, 15.1, 15.1],
    }),
    ...history(diego, 'demo-d', {
      reactionMs: [301, 298, 303, 299, 300, 302, 297, 301, 299, 300, 298, 301, 299, 300, 298], sleep: [4, 5, 4, 4, 4, 5, 4, 4, 4, 4, 5, 4, 4, 4, 4], mood: 4, energy: 4,
      heartRate: [58, 59, 58, 57, 58, 59, 58, 58, 57, 58, 59, 58, 58, 57, 58], leftRange: [156, 157, 155, 156, 157, 156, 155, 156, 157, 156, 155, 156, 157, 156, 156], rightRange: 157,
      workload: 4, team: [4, 4, 5, 4, 4, 4, 5, 4, 4, 4, 4, 5, 4, 4, 4], appetite: 4, exerciseMin: [95, 90, 100, 95, 90, 95, 100, 90, 95, 95, 90, 95, 100, 95, 95],
      thighCm: [16.2, 16.3, 16.2, 16.2, 16.3, 16.2, 16.2, 16.3, 16.2, 16.2, 16.3, 16.2, 16.2, 16.2, 16.3],
    }, 15),
  ];
  // Each member keeps a preflight ghost and the cruise ghost their comparisons use, built from their first 11 sols.
  const crew = [alex, jordan, mei, diego];
  const references: GhostReference[] = crew.flatMap(p => {
    const own = checkIns.filter(r => r.crewId === p.id);
    return (['preflight', 'cruise'] as const).map(phase => {
      const records = structuredClone(own.slice(0, 11)).map((r, i) => {
        const date = phase === 'preflight' ? new Date(missionStart.getTime() - (11 - i) * 86400000).toISOString() : r.date;
        return { ...r, id: phase === 'preflight' ? `demo-preflight-${p.id}-${i}` : r.id, sol: phase === 'preflight' ? 0 : r.sol, date, measurements: Object.fromEntries(Object.entries(r.measurements ?? {}).map(([k, m]) => [k, { ...m, phase, measuredAt: date }])) };
      });
      return { id: `demo-ref-${p.id}-${phase}`, crewId: p.id, simulated: false, phase, establishedAt: records.at(-1)!.date, reason: `${phase === 'preflight' ? 'Preflight' : 'Cruise'} readings, steady for 11 sols.`, records };
    });
  });
  // Alex and Jordan reported a headache in the last hour: two crew, so the cabin prompt shows.
  const headacheAt = new Date(Date.now() - 3600000).toISOString();
  for (const p of [alex, jordan]) { const last = checkIns.filter(r => r.crewId === p.id).at(-1)!; last.headache = 1; last.measurements!.headache = { ...context, measuredAt: headacheAt, quality: 'good' }; }
  return { demo: false, sampleVersion: SAMPLE_VERSION, profile: alex, crew, crewId: alex.id, checkIns, references, actions: [], packets: [], careUpdates: [], checkRuns: [], cabinReadings: [{ id: 'demo-cabin', date: headacheAt, location: 'Habitat module · sensor 1', co2Ppm: 2400, temperatureC: 23, humidityPct: 43, source: 'manual' }] };
}

/**
 * Sample members this device doesn't have yet, with their history and ghosts. Runs once per sample version on load
 * (so a deleted sample member stays deleted), and on demand from Sources → Restore sample crew.
 */
export function addSamples(state: MissionState, force = false): MissionState {
  if (!force && state.sampleVersion === SAMPLE_VERSION) return state;
  const sample = createDemo();
  const have = new Set((state.crew ?? [state.profile]).map(c => c.id));
  const missing = sample.crew!.filter(p => !have.has(p.id));
  const ids = new Set(missing.map(p => p.id));
  // Older sample history lacks the newer measures: regenerate it for the sample members this device still has.
  const refresh = (state.sampleVersion ?? 0) < 3 ? new Set(sample.crew!.filter(p => have.has(p.id)).map(p => p.id)) : new Set<string>();
  const generated = (id: string) => id.startsWith('demo');
  const kept = state.checkIns.filter(c => !(refresh.has(c.crewId!) && generated(c.id)));
  const keptRefs = (state.references ?? []).filter(r => !(refresh.has(r.crewId!) && generated(r.id)));
  const fresh = (id?: string) => ids.has(id!) || refresh.has(id!);
  return { ...state, sampleVersion: SAMPLE_VERSION, crew: [...(state.crew ?? [state.profile]), ...missing],
    checkIns: [...kept, ...sample.checkIns.filter(c => fresh(c.crewId))],
    references: [...keptRefs, ...(sample.references ?? []).filter(r => fresh(r.crewId))],
    cabinReadings: state.cabinReadings?.length ? state.cabinReadings : sample.cabinReadings };
}

let dbPromise: Promise<IDBDatabase> | undefined;
function database() {
  if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open('ghostpilot-mission', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('mission');
      request.result.createObjectStore('recordings', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { dbPromise = undefined; reject(request.error); };
  });
  return dbPromise;
}

export async function loadMission(): Promise<MissionState | undefined> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db.transaction('mission').objectStore('mission').get('state');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveMission(state: MissionState) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('mission', 'readwrite');
    transaction.objectStore('mission').put(state, 'state');
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? new Error('Saving mission data was aborted.'));
  });
}

export async function saveRecording(recording: Recording) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('recordings', 'readwrite');
    tx.objectStore('recordings').put(recording);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Saving the recording was aborted.'));
  });
}

/** Commit the cleared mission and remove videos/pose data in one transaction. */
export async function clearPersonalRecords(state: MissionState) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['mission', 'recordings'], 'readwrite');
    tx.objectStore('mission').put(state, 'state');
    tx.objectStore('recordings').clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Deleting personal records was aborted.'));
  });
}

export async function loadRecordings(): Promise<Recording[]> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db.transaction('recordings').objectStore('recordings').getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function downloadFile(name: string, content: string, type = 'text/markdown') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const formatDate = (date: string, options?: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Singapore', day: 'numeric', month: 'short', ...options,
}).format(new Date(date));

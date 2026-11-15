import type { CheckIn, GhostReference, MissionState, Profile, Recording, RecordingContext } from './types';

/** Demo crew ids, stable so tests and reloads find the same people. */
export const DEMO_CREW = { alex: 'crew-alex', jordan: 'crew-jordan' };

/**
 * Two synthetic crew members, each with 14 days of labelled demo history. Alex shows attention, sleep and shoulder
 * trends; Jordan shows a leg-outline trend (thigh breadth 6% below the ghost) with falling exercise minutes.
 */
export function createDemo(): MissionState {
  const missionStart = new Date();
  missionStart.setDate(missionStart.getDate() - 41);
  missionStart.setHours(0, 0, 0, 0);
  const startDate = missionStart.toISOString();
  const day = (i: number) => { const date = new Date(); date.setDate(date.getDate() - 14 + i); date.setHours(9, 0, 0, 0); return date.toISOString(); };
  const context: RecordingContext = { phase: 'cruise', cameraSetup: 'Camera A, floor mark 2, front view', posture: 'Upright, arms clear', lighting: 'Cabin lights, front lit', clothing: 'Fitted exercise clothes', activity: 'Rested, before exercise' };
  const alex: Profile = { id: DEMO_CREW.alex, name: 'Alex Morgan', initials: 'AM', mission: 'Ares I', duration: 180, startDate, sex: 'female', heightCm: 168, massKg: 62, build: 'muscular', recordingContext: context };
  const jordan: Profile = { id: DEMO_CREW.jordan, name: 'Jordan Lee', initials: 'JL', mission: 'Ares I', duration: 180, startDate, sex: 'male', heightCm: 181, massKg: 79, build: 'average', recordingContext: context };

  const sleeps = [4, 4, 5, 4, 4, 4, 5, 4, 4, 4, 4, 3, 3, 2];
  const reactions = [309, 319, 311, 305, 321, 314, 308, 315, 318, 311, 312, 351, 369, 382];
  const ranges = [151, 152, 153, 150, 154, 152, 151, 153, 150, 152, 151, 139, 134, 130];
  const thighs = [15.9, 15.8, 15.9, 15.8, 15.8, 15.9, 15.8, 15.8, 15.7, 15.8, 15.8, 15.6, 15.5, 15.5];
  const alexCheckIns: CheckIn[] = Array.from({ length: 14 }, (_, i) => ({
    id: `demo-${i}`, crewId: alex.id, date: day(i), sol: 28 + i, simulated: true,
    reactionMs: reactions[i], missed: i > 10 ? 1 : 0, signals: 12,
    sleep: sleeps[i], mood: i > 10 ? 3 : 4, energy: i > 10 ? 2 : 4,
    symptoms: i > 11 ? ['Fatigue', 'Shoulder discomfort'] : [],
    heartRate: i > 10 ? 68 : 64, notes: i > 11 ? 'Slight stiffness during shoulder mobility.' : '',
    leftRange: ranges[i], rightRange: 153 - (i > 10 ? 2 : 0),
    workload: i > 10 ? 2 : 4, team: 4, appetite: i > 10 ? 3 : 4, exerciseMin: i > 10 ? 35 : 75, thighCm: thighs[i],
    dizziness: 0, vision: i > 11 ? 1 : 0, breath: 0, joint: 0, gut: 0, skin: 0, grip: 0, back: i > 12 ? 1 : 0,
  }));

  const jReactions = [296, 301, 293, 298, 290, 299, 295, 297, 292, 300, 294, 296, 299, 293];
  const jThighs = [16.8, 16.9, 16.8, 16.7, 16.8, 16.9, 16.8, 16.7, 16.8, 16.8, 16.7, 15.9, 15.8, 15.7];
  const jExercise = [90, 85, 95, 90, 80, 90, 85, 90, 75, 80, 70, 40, 30, 25];
  const jordanCheckIns: CheckIn[] = Array.from({ length: 14 }, (_, i) => ({
    id: `demo-j-${i}`, crewId: jordan.id, date: day(i), sol: 28 + i, simulated: true,
    reactionMs: jReactions[i], missed: 0, signals: 12,
    sleep: 4, mood: 4, energy: i > 10 ? 3 : 4, symptoms: [], heartRate: 60, notes: '',
    leftRange: 158 - (i % 3), rightRange: 157 - (i % 2),
    workload: 4, team: 4, appetite: 4, exerciseMin: jExercise[i], thighCm: jThighs[i],
    dizziness: 0, vision: 0, breath: 0, joint: 0, gut: 0, skin: 0, grip: 0, back: 0,
  }));

  const checkIns = [...alexCheckIns, ...jordanCheckIns].map(r => ({ ...r, measurements: Object.fromEntries(Object.entries(r).filter(([, v]) => typeof v === 'number').map(([k]) => [k, { ...context, measuredAt: r.date, quality: 'good' as const, ...(['leftRange', 'rightRange', 'thighCm'].includes(k) ? { confidentFrames: 40 } : {}) }])) }));
  // All reference observations are synthetic too. Preserve preflight alongside the explicitly retained cruise reference.
  const references: GhostReference[] = [alex, jordan].flatMap(p => {
    const own = checkIns.filter(r => r.crewId === p.id);
    return (['preflight', 'cruise'] as const).map(phase => {
      const records = structuredClone(own.slice(0, 11)).map((r, i) => {
        const date = phase === 'preflight' ? new Date(missionStart.getTime() - (11 - i) * 86400000).toISOString() : r.date;
        return { ...r, id: phase === 'preflight' ? `demo-preflight-${p.id}-${i}` : r.id, sol: phase === 'preflight' ? 0 : r.sol, date, measurements: Object.fromEntries(Object.entries(r.measurements).map(([k, m]) => [k, { ...m, phase, measuredAt: date }])) };
      });
      return { id: `demo-ref-${p.id}-${phase}`, crewId: p.id, simulated: true, phase, establishedAt: records.at(-1)!.date, reason: `Synthetic ${phase} reference for the hackathon demonstration.`, records };
    });
  });
  const headacheAt = new Date(Date.now() - 3600000).toISOString();
  for (const p of [alex, jordan]) { const last = checkIns.filter(r => r.crewId === p.id).at(-1)!; last.headache = 1; last.measurements.headache = { ...context, measuredAt: headacheAt, quality: 'good' }; }
  return { demo: true, profile: alex, crew: [alex, jordan], crewId: alex.id, checkIns, references, actions: [], cabinReadings: [{ id: 'demo-cabin', date: headacheAt, location: 'Habitat module · synthetic sensor', co2Ppm: 2400, temperatureC: 23, humidityPct: 43, source: 'simulated' }] };
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

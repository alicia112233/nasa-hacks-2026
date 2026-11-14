import type { MissionState, Recording } from './types';

export function createDemo(): MissionState {
  const sleeps = [4, 4, 5, 4, 4, 4, 5, 4, 4, 4, 4, 3, 3, 2];
  const reactions = [309, 319, 311, 305, 321, 314, 308, 315, 318, 311, 312, 351, 369, 382];
  const ranges = [151, 152, 153, 150, 154, 152, 151, 153, 150, 152, 151, 139, 134, 130];
  const missionStart = new Date();
  missionStart.setDate(missionStart.getDate() - 41);
  missionStart.setHours(0, 0, 0, 0);
  return {
    demo: true,
    profile: { name: 'Alex Morgan', initials: 'AM', mission: 'Ares I', duration: 180, startDate: missionStart.toISOString(), sex: 'female', heightCm: 168, massKg: 62, build: 'muscular' },
    checkIns: Array.from({ length: 14 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - 14 + i);
      date.setHours(9, 0, 0, 0);
      return {
        id: `demo-${i}`, date: date.toISOString(), sol: 28 + i, simulated: true,
        reactionMs: reactions[i], missed: i > 10 ? 1 : 0, signals: 12,
        sleep: sleeps[i], mood: i > 10 ? 3 : 4, energy: i > 10 ? 2 : 4,
        symptoms: i > 11 ? ['Fatigue', 'Shoulder discomfort'] : [],
        heartRate: i > 10 ? 68 : 64, notes: i > 11 ? 'Slight stiffness during shoulder mobility.' : '',
        leftRange: ranges[i], rightRange: 153 - (i > 10 ? 2 : 0),
        workload: i > 10 ? 2 : 4, team: 4, appetite: i > 10 ? 3 : 4, exerciseMin: i > 10 ? 35 : 75,
        dizziness: 0, vision: i > 11 ? 1 : 0, breath: 0, joint: 0, gut: 0, skin: 0, grip: 0, back: i > 12 ? 1 : 0,
      };
    }),
    actions: [],
  };
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
  });
}

export async function saveRecording(recording: Recording) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('recordings', 'readwrite');
    tx.objectStore('recordings').put(recording);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
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

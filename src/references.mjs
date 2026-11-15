export const phases = { preflight: 'Preflight', adaptation: 'Early adaptation', cruise: 'In-flight cruise', surface: 'Surface operations', return: 'Return / recovery', unknown: 'Not recorded' };
/** @type {import('./types').RecordingContext} */
export const defaultContext = { phase: 'unknown', cameraSetup: '', posture: '', lighting: '', clothing: '', activity: '' };
export const metricKeys = ['reactionMs', 'sleep', 'energy', 'leftRange', 'rightRange', 'thighCm', 'mood', 'heartRate', 'exerciseMin', 'appetite', 'workload', 'team'];
export const cameraKeys = ['leftRange', 'rightRange', 'thighCm'];
export const isNumber = v => typeof v === 'number' && Number.isFinite(v);
export const measuredAt = (record, key) => record.measurements?.[key]?.measuredAt ?? record.date;

export function comparisonIssue(record, referenceRecord, key) {
  const a = record?.measurements?.[key], b = referenceRecord?.measurements?.[key];
  if (a?.quality === 'poor' || b?.quality === 'poor') return 'Recording quality is too low; repeat the recording.';
  if (!a || !b || a.phase === 'unknown' || b.phase === 'unknown') return 'Recording conditions or mission phase were not recorded; establish a reference with documented conditions.';
  if (a.phase !== b.phase) return 'Mission phase differs from the reference; compare within a documented phase.';
  const fields = cameraKeys.includes(key) ? ['cameraSetup', 'posture', 'lighting', 'clothing', 'activity'] : ['activity'];
  if (a.quality !== 'good' || b.quality !== 'good' || fields.some(f => !a[f]?.trim() || !b[f]?.trim())) return 'Recording conditions or quality are incomplete; repeat under documented conditions.';
  if (fields.some(f => a[f].trim().toLowerCase() !== b[f].trim().toLowerCase())) return 'Recording conditions differ from baseline; repeat under matching conditions.';
  return null;
}

/** References are snapshots. Adding one never alters or discards an earlier reference. */
/** @param {{ id: string, crewId?: string, simulated: boolean, records: import('./types').CheckIn[], phase: import('./types').MissionPhase, reason: string, now: string, references?: import('./types').GhostReference[] }} options */
export function establishReference({ id, crewId, simulated, records, phase, reason, now, references = [] }) {
  if (phase === 'unknown' || !reason.trim()) throw new Error('Choose a phase and describe why this reference is appropriate.');
  if (references.some(r => r.crewId === crewId && r.simulated === simulated && r.phase === phase)) throw new Error('A reference for this phase is already retained. It cannot be overwritten.');
  const eligible = records.filter(r => r.crewId === crewId && r.simulated === simulated && metricKeys.some(k => isNumber(r[k]) && r.measurements?.[k]?.phase === phase && r.measurements[k].quality === 'good')).slice().sort((a, b) => a.date.localeCompare(b.date));
  const snapshots = eligible.slice(-11).map(r => {
    const copy = structuredClone(r);
    for (const k of metricKeys) if (copy.measurements?.[k]?.phase !== phase || copy.measurements[k].quality !== 'good') { delete copy[k]; if (copy.measurements) delete copy.measurements[k]; }
    return copy;
  });
  if (!metricKeys.some(k => snapshots.filter(r => isNumber(r[k]) && !comparisonIssue(r, snapshots.find(b => isNumber(b[k])), k)).length >= 3)) throw new Error('At least three good measurements of one metric under matching conditions are needed.');
  return { id, crewId, simulated, phase, reason: reason.trim(), establishedAt: now, records: snapshots };
}

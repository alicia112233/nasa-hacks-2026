import { analyze, median } from './rules.mjs';
import { researchSources, researchUse } from './research.mjs';
export { researchSources } from './research.mjs';

export const lensHazards = [
  { id: 'isolation', label: 'Isolation & confinement', short: 'Mind & rhythm', number: '01', x: 50, y: 16, icon: 'moon', color: '#ccbedb' },
  { id: 'gravity', label: 'Altered gravity', short: 'Movement', number: '02', x: 79, y: 38, icon: 'move', color: '#c2d79f' },
  { id: 'environment', label: 'Hostile / closed environment', short: 'Habitat', number: '03', x: 69, y: 77, icon: 'wind', color: '#a6ccc0' },
  { id: 'distance', label: 'Distance from Earth', short: 'Autonomy', number: '04', x: 31, y: 77, icon: 'radio', color: '#c3d3dd' },
  { id: 'radiation', label: 'Space radiation', short: 'Exposure', number: '05', x: 21, y: 38, icon: 'radiation', color: '#d7bf94' },
];

export function lensSnapshot(checkIns, simulated, throughId, references = []) {
  const ordered = checkIns.filter(c => c.simulated === simulated).sort((a, b) => a.date.localeCompare(b.date));
  const found = throughId == null ? ordered.length - 1 : ordered.findIndex(c => c.id === throughId);
  const records = found < 0 ? [] : ordered.slice(0, found + 1);
  const analysis = analyze(records, simulated, references.filter(r => throughId == null || r.establishedAt <= records.at(-1)?.date));
  const metrics = [
    { key: 'reactionMs', label: 'Attention response', unit: 'ms', flag: analysis.attentionFlag },
    { key: 'sleep', label: 'Sleep quality', unit: '/5', flag: analysis.wellbeingFlag },
    { key: 'energy', label: 'Energy', unit: '/5', flag: false },
    { key: 'leftRange', label: 'Left shoulder range', unit: '°', flag: analysis.movementFlag },
  ].map(({ key, ...info }) => {
    const base = analysis.baseline[key];
    const value = analysis.current[key];
    return { ...info, key, baseline: base, value, baselineCount: analysis.quality[key].baseline, recentCount: analysis.quality[key].recent,
      change: base != null && value != null && base !== 0 ? Math.round((value - base) / base * 100) : null,
      comparable: analysis.comparisons[key].comparable, comparison: analysis.comparisons[key],
    };
  });
  const hasWellbeing = analysis.recent.some(c => Number.isFinite(c.sleep) || Number.isFinite(c.mood));
  const hasMovement = analysis.recent.some(c => Number.isFinite(c.leftRange));
  const signals = Number(analysis.attentionFlag || analysis.wellbeingFlag) + Number(analysis.movementFlag);
  return {
    analysis, metrics, records, latest: records.at(-1) ?? null, signals,
    recentMood: median(analysis.recent.map(c => c.mood)),
    recentHeartRate: median(analysis.recent.map(c => c.heartRate)),
    statuses: {
      isolation: analysis.attentionFlag || analysis.wellbeingFlag ? 'review' : hasWellbeing ? 'context' : 'unknown',
      gravity: analysis.movementFlag ? 'review' : hasMovement ? 'context' : 'unknown',
      environment: 'unknown', radiation: 'unknown', distance: 'operational',
    },
    source: simulated ? 'simulated' : 'recorded',
    atLatest: found === ordered.length - 1,
  };
}

export function createMissionPacket({ snapshot, profile, actions, context, oneWayMinutes, blackoutDrill, id, createdAt }) {
  if (!snapshot.latest) throw new Error('A handoff needs at least one check-in.');
  if (typeof context !== 'string' || !context.trim()) throw new Error('Describe the crew observation before saving a handoff.');
  const actionCutoff = snapshot.atLatest ? createdAt : snapshot.latest.date;
  return {
    schemaVersion: 1, id, crewId: profile.id, createdAt, source: snapshot.source,
    sol: snapshot.latest.sol, asOfDate: snapshot.latest.date, actionCutoff,
    crew: profile.name, mission: profile.mission, status: 'saved', context: context.trim(),
    observations: structuredClone(snapshot.records),
    // A historical handoff cannot silently include actions made after its cutoff.
    actions: structuredClone(actions.filter(a => a.simulated === (snapshot.source === 'simulated') && a.createdAt <= actionCutoff)),
    communication: { oneWayMinutes, blackoutDrill, transmitted: false },
    analysis: {
      baselineCount: snapshot.analysis.baselineRecords.length,
      recentCount: snapshot.analysis.recent.length,
      metrics: snapshot.metrics,
      flags: { attention: snapshot.analysis.attentionFlag, movement: snapshot.analysis.movementFlag, wellbeing: snapshot.analysis.wellbeingFlag },
      asOfDate: snapshot.latest.date,
    },
    sources: researchSources,
    research: researchUse,
    limitations: [
      'Not diagnostic or a NASA-approved risk model.',
      'Links on the map represent monitoring context, not demonstrated causation.',
      'Trend thresholds are illustrative; each flagged metric requires at least three valid earlier and three valid recent samples.',
      'No dosimetry, bone-density or immune assays are collected. Cabin readings can be entered manually; no live sensor feed is connected.',
      'Pose estimates depend on camera placement, effort, restraints, and gravity.',
      'A downloaded packet has not been transmitted to ground staff.',
    ],
  };
}

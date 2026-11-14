import { coverage, regions, regionStatuses } from './body.mjs';
import { analyze } from './rules.mjs';
import { researchReferencesMarkdown, researchSources, researchUse } from './research.mjs';
import type { CheckIn, MissionState, Recording } from './types';

const label = (c: { options?: string[]; kind: string; unit?: string }, v: number) => c.options ? c.options[c.kind === 'scale' ? v - 1 : v] : `${v}${c.unit ? ` ${c.unit}` : ''}`;

export function regionSummary(checkIns: CheckIn[], simulated: boolean) {
  const statuses = regionStatuses(checkIns, simulated);
  return regions.map(r => ({
    region: r.label, letter: r.letter, state: statuses[r.id].state,
    checks: statuses[r.id].items.map((i: { check: { title: string; kind: string; options?: string[]; unit?: string; needs?: string }; value: number | null; flagged: boolean; reported: boolean }) => ({
      check: i.check.title, value: i.value == null ? null : label(i.check, i.value), flagged: i.flagged, reported: i.reported,
      measured: i.check.kind === 'instrument' ? `not measured (${i.check.needs})` : i.check.kind === 'data' ? 'NASA archived context only' : 'self-check',
    })),
  }));
}

export function groundReport(mission: MissionState, recordings: Recording[], sol: number) {
  const simulated = mission.demo;
  const a = analyze(mission.checkIns, simulated);
  const summary = regionSummary(mission.checkIns, simulated);
  const lines = summary.map(r => `### ${r.letter} · ${r.region} — ${r.state}\n${r.checks.map(c => `- ${c.check}: ${c.value ?? c.measured}${c.flagged ? ' · TREND vs ghost' : ''}${c.reported ? ' · REPORTED' : ''}`).join('\n')}`).join('\n\n');
  const gaps = coverage().filter(r => r.instrumentOnly).map(r => r.label);
  const md = `# GhostPilot ground report\n\nGenerated ${new Date().toISOString()} · ${mission.profile.name} · ${mission.profile.mission} · Sol ${sol}\nSource: ${simulated ? 'SIMULATED DEMO — synthetic, not an astronaut record' : 'Personal records on this device'}\nNot transmitted. Downloaded for review.\n\n## Against the ghost\nGhost = median of the earliest ${a.baselineRecords.length} check-ins; compared with the latest ${a.recent.length}.\n- Attention ${a.current.reactionMs ?? '—'} ms (ghost ${a.baseline.reactionMs ?? '—'}, ${a.attentionDelta ?? '—'}%)\n- Left shoulder ${a.current.leftRange ?? '—'}° (ghost ${a.baseline.leftRange ?? '—'}, ${a.movementDelta ?? '—'}%)\n- Sleep ${a.current.sleep ?? '—'}/5 (ghost ${a.baseline.sleep ?? '—'})\n\n## Body index\n${lines}\n\n## Not measurable onboard\n${gaps.join(', ') || 'None'}. Radiation dose and cabin air are shown from NASA's archived ISS record (EDA, RR-3), not personal readings.\n\n## Follow-ups\n${mission.actions.filter(x => x.simulated === simulated).map(x => `- ${x.title} [${x.status}] · reassess ${x.scheduledAt.slice(0, 10)}`).join('\n') || 'None'}\n\n## Movement recordings\n${recordings.map(r => `- ${r.date}: ${r.frames.length} pose frames, left ${r.leftRange ?? '—'}°. Video stays on the device.`).join('\n') || 'None'}\n\n## Limits\nPrototype. Not a diagnosis or a NASA-approved model. Thresholds (15% attention, 8% shoulder, 1-point sleep) are illustrative. Self-reports are subjective.\n\n${researchReferencesMarkdown()}`;
  const json = { generatedAt: new Date().toISOString(), source: simulated ? 'simulated' : 'recorded', transmitted: false, crew: mission.profile.name, mission: mission.profile.mission, sol,
    analysis: { baselineCount: a.baselineRecords.length, recentCount: a.recent.length, current: a.current, baseline: a.baseline, attentionDelta: a.attentionDelta, movementDelta: a.movementDelta, flags: { attention: a.attentionFlag, movement: a.movementFlag, wellbeing: a.wellbeingFlag } },
    bodyIndex: summary, notMeasurableOnboard: gaps, checkIns: a.records, actions: mission.actions.filter(x => x.simulated === simulated), research: researchUse, sources: researchSources };
  return { md, json };
}

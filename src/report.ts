import { coverage, regions, regionStatuses } from './body.mjs';
import { assess } from './assess.mjs';
import { researchReferencesMarkdown, researchSources, researchUse } from './research.mjs';
import type { CareUpdate, CheckIn, Concern, GhostReference, MissionState, Recording } from './types';
import { continuingCarePacket, procedureLabel } from './continuing-care.mjs';

/** Times in the mission timezone, as the app shows them. */
const clock = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Singapore', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const label = (c: { options?: string[]; kind: string; unit?: string }, v: number) => c.options ? c.options[c.kind === 'scale' ? v - 1 : v] : `${v}${c.unit ? ` ${c.unit}` : ''}`;

export function regionSummary(checkIns: CheckIn[], simulated: boolean, references: GhostReference[] = [], startDate?: string) {
  const statuses = regionStatuses(checkIns, simulated, undefined, references, { startDate });
  return regions.map(r => ({
    region: r.label, letter: r.letter, state: statuses[r.id].state,
    checks: statuses[r.id].items.map((i: { check: { title: string; kind: string; options?: string[]; unit?: string; needs?: string; field2?: string }; value: number | null; value2?: number | null; flagged: boolean; reported: boolean; concern: Concern | null; method?: string | null; lastMeasuredAt?: string | null; due: boolean; skipped: boolean }) => ({
      check: i.check.title, value: i.value == null ? null : i.check.field2 ? `${i.value}/${i.value2 ?? '—'} ${i.check.unit}` : label(i.check, i.value), flagged: i.flagged, reported: i.reported,
      concern: i.concern, due: i.due, skipped: i.skipped, measuredAt: i.lastMeasuredAt, method: i.method, unit: i.check.unit,
      measured: i.skipped ? 'not measured (no equipment today)' : i.check.kind === 'instrument' ? `not measured (${i.check.needs})` : i.check.kind === 'data' ? 'NASA archived context only' : 'self-check',
    })),
  }));
}

export function groundReport(mission: MissionState, recordings: Recording[], sol: number) {
  const simulated = mission.demo;
  if (simulated) recordings = [];
  const { analysis: a, concerns } = assess(mission.checkIns, simulated, mission.references);
  const summary = regionSummary(mission.checkIns, simulated, mission.references, mission.profile.startDate);
  // Each reading with its method and time; each alert with the label every other page gives it.
  const taken = (c: { value: string | null; method?: string | null; measuredAt?: string | null }) => c.value && (c.method || c.measuredAt) ? ` (${[c.method, c.measuredAt && clock.format(new Date(c.measuredAt))].filter(Boolean).join(', ')})` : '';
  const lines = summary.map(r => `### ${r.letter} · ${r.region} — ${r.state}\n${r.checks.map(c => `- ${c.check}: ${c.value ?? c.measured}${taken(c)}${c.concern ? ` · ${c.concern.label.toUpperCase()}` : ''}`).join('\n')}`).join('\n\n');
  const attention = concerns.map(c => `- ${c.label.toUpperCase()} · ${c.title}: ${c.reason}${c.steps[0] ? ` ${c.steps[0].text}` : ''}`).join('\n') || 'Nothing off.';
  const gaps = coverage().filter(r => r.instrumentOnly).map(r => r.label);
  const md = `# GhostPilot ground report\n\nGenerated ${new Date().toISOString()} · ${mission.profile.name} · ${mission.profile.mission} · Sol ${sol}\nSource: ${simulated ? 'SIMULATED DEMO — synthetic, not an astronaut record' : 'Personal records on this device'}\nNot transmitted. Downloaded for review.\n\n## Needs attention\n${attention}\n\n## Against the ghost\nGhost = median of the earliest ${a.baselineRecords.length} check-ins; compared with the latest ${a.recent.length}.\n- Attention ${a.current.reactionMs ?? '—'} ms (ghost ${a.baseline.reactionMs ?? '—'}, ${a.attentionDelta ?? '—'}%)\n- Left shoulder ${a.current.leftRange ?? '—'}° (ghost ${a.baseline.leftRange ?? '—'}, ${a.movementDelta ?? '—'}%)\n- Sleep ${a.current.sleep ?? '—'}/5 (ghost ${a.baseline.sleep ?? '—'})\n- Thigh breadth ${a.current.thighCm ?? '—'} cm (ghost ${a.baseline.thighCm ?? '—'}, ${a.legDelta ?? '—'}%), from the body scan\n\n## Body index\n${lines}\n\n## Not measurable onboard\n${gaps.join(', ') || 'None'}. Radiation dose and cabin air are shown from NASA's archived ISS record (EDA, RR-3), not personal readings.\n\n## Follow-ups\n${mission.actions.filter(x => x.simulated === simulated).map(x => `- ${x.title} [${x.status}] · reassess ${x.scheduledAt.slice(0, 10)}`).join('\n') || 'None'}\n\n## Movement recordings\n${recordings.map(r => `- ${r.date}: ${r.frames.length} pose frames, left ${r.leftRange ?? '—'}°. Video stays on the device.`).join('\n') || 'None'}\n\n## Limits\nNot a diagnosis or a NASA-approved model. Trend thresholds (15% slower attention, 8% less shoulder range, 5% less thigh breadth, 25% less exercise, heart rate up 10 bpm, sleep down 1 h, any 1–5 rating down 1 point) and the general-adult ranges for heart rate, temperature and blood pressure are illustrative. The body scan is calibrated on rendered bodies, not measured people. Self-reports are subjective.\n\n${researchReferencesMarkdown()}`;
  const references = (mission.references ?? []).filter(r => r.simulated === simulated);
  const cabinReadings = (mission.cabinReadings ?? []).filter(r => r.source === (simulated ? 'simulated' : 'manual'));
  const careThreads = (mission.packets ?? []).filter(p => p.source === (simulated ? 'simulated' : 'recorded')).map(p => continuingCarePacket(p, mission.careUpdates ?? []));
  const json = { generatedAt: new Date().toISOString(), source: simulated ? 'simulated' : 'recorded', transmitted: false, crew: mission.profile.name, mission: mission.profile.mission, sol,
    references, comparisons: a.comparisons, cabinReadings, careThreads, checkRuns: (mission.checkRuns ?? []).filter(r => r.simulated === simulated),
    analysis: { baselineCount: a.baselineRecords.length, recentCount: a.recent.length, current: a.current, baseline: a.baseline, attentionDelta: a.attentionDelta, movementDelta: a.movementDelta, legDelta: a.legDelta, trends: a.trends, concerns, flags: { attention: a.attentionFlag, movement: a.movementFlag, wellbeing: a.wellbeingFlag, legs: a.legFlag } },
    bodyIndex: summary, ghostClips: mission.profile.ghostClips ?? [], notMeasurableOnboard: gaps, checkIns: a.records, actions: mission.actions.filter(x => x.simulated === simulated), research: researchUse, sources: researchSources };
  const context = `\n\n## Fixed references and comparison uncertainty\n${references.map(r => `- ${r.phase}: ${r.id}, established ${r.establishedAt}. ${r.reason}`).join('\n') || 'No explicit references established.'}\n${Object.entries(a.comparisons).map(([k, v]) => `- ${k}: ${v.state}. ${v.reason} Last measured: ${v.lastMeasuredAt ?? 'never'}.`).join('\n')}\nA narrower leg silhouette alone cannot establish muscle loss.\n\n## Cabin observations\n${cabinReadings.map(r => `- ${r.date}: ${r.co2Ppm} ppm CO2 at ${r.location} (${r.source}).`).join('\n') || 'No current cabin readings. NASA 2016 records are archival context.'}`;
  const care = `\n\n## Continuing care\n${careThreads.map(p => `### ${p.id}\nOriginal observation: ${p.context}\nProcedure: ${procedureLabel(p.carePlan?.procedure)}\nNext check: ${p.carePlan?.nextCheck ?? 'not recorded'} at ${p.carePlan?.dueAt ?? 'not recorded'}\nMissing: ${p.carePlan?.missingInformation.join('; ') ?? 'not documented'}\n${p.continuingCare.updates.map((u: CareUpdate) => `- ${u.recordedAt} [${u.change}]: ${u.observation}. Procedure: ${procedureLabel(u.plan.procedure)}. Next: ${u.plan.nextCheck} at ${u.plan.dueAt}. Missing: ${u.plan.missingInformation.join('; ')}`).join('\n')}`).join('\n') || 'No continuing care packets saved.'}`;
  return { md: md.replace(/Ghost = median of the earliest .*?\n/, 'Ghost = retained phase reference; raw differences below are context only unless comparison status is comparable.\n') + context + care, json };
}

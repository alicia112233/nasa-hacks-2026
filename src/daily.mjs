import { regionStatuses, topicOf } from './body.mjs';
import { measuredAt } from './references.mjs';

/** A prompt for review, not a causal inference or environmental alarm. One report per crew member. */
export function crewHeadaches(checkIns, simulated, now = Date.now()) {
  const latest = new Map();
  for (const r of checkIns.filter(r => r.simulated === simulated && r.crewId && r.headache != null)) {
    const at = Date.parse(measuredAt(r, 'headache'));
    if (at <= now && now - at <= 24 * 3600000 && (!latest.has(r.crewId) || at > latest.get(r.crewId).at)) latest.set(r.crewId, { at, value: r.headache });
  }
  return [...latest].filter(([, r]) => r.value > 0).map(([id]) => id);
}

/**
 * @param {{ checkIns: import('./types').CheckIn[], simulated: boolean, references?: import('./types').GhostReference[], camera?: boolean, seconds?: number, now?: number, startDate?: string }} options
 * @returns {{ checkId: string, field: string, region: string, title: string, seconds: number, priority: number, reason: string }[]}
 */
export function recommendChecks({ checkIns, simulated, references = [], camera = true, seconds = 120, now = Date.now(), startDate }) {
  const statuses = regionStatuses(checkIns, simulated, new Date(now).toISOString(), references, { startDate });
  const recommendations = [];
  for (const item of Object.values(statuses).flatMap(s => s.items)) {
    const check = item.check;
    if (!check.field) continue;
    if (item.concern?.level === 'now') {
      recommendations.push({ checkId: check.id, field: check.field, region: check.region, title: check.kind === 'symptom' ? `Strong ${topicOf(check).toLowerCase()} reported` : check.title, seconds: 0, prep: 0, priority: 100, emergency: true, reason: 'Tell a crewmate and the medical lead now. Follow the mission procedure.' }); continue;
    }
    if (!item.due || (item.done && !item.needsRepeat) || check.seconds > seconds || (!camera && check.kind === 'camera')) continue;
    const record = checkIns.filter(r => r.simulated === simulated && r.measurements?.[check.field]).sort((a, b) => measuredAt(a, check.field).localeCompare(measuredAt(b, check.field))).at(-1);
    const frames = record?.measurements?.[check.field]?.confidentFrames;
    const reason = item.why === 'repeat' ? `Last recording too unclear or conditions differ${frames != null ? ` (${frames} confident frames)` : ''}. Record it again.`
      : item.concern ? item.concern.reason : item.why === 'unwell' ? 'A symptom calls for a temperature reading.' : item.why === 'overdue' ? `Overdue since Sol ${item.since}.` : `${item.cadence} · due today.`;
    recommendations.push({ checkId: check.id, field: check.field, region: check.region, title: `${item.why === 'repeat' ? 'Repeat' : 'Check'} ${topicOf(check).toLowerCase()}`, seconds: check.seconds, prep: check.prep ?? 0,
      priority: item.why === 'repeat' ? 80 : item.concern ? (item.concern.level === 'tell' ? 75 : 70) : item.why === 'unwell' ? 65 : item.why === 'overdue' ? 60 : 40, emergency: false, reason });
  }
  return recommendations.sort((x, y) => y.priority - x.priority || x.seconds - y.seconds || x.checkId.localeCompare(y.checkId));
}

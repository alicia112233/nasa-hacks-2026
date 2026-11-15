import { checks, dayKey, topicOf } from './body.mjs';
import { measuredAt, isNumber } from './references.mjs';
import { analyze } from './rules.mjs';

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
 * @param {{ checkIns: import('./types').CheckIn[], simulated: boolean, references?: import('./types').GhostReference[], camera?: boolean, seconds?: number, now?: number }} options
 * @returns {{ checkId: string, field: string, region: string, title: string, seconds: number, priority: number, reason: string }[]}
 */
export function recommendChecks({ checkIns, simulated, references = [], camera = true, seconds = 120, now = Date.now() }) {
  const a = analyze(checkIns, simulated, references);
  const recommendations = [];
  for (const check of checks.filter(c => c.field && c.seconds <= seconds && (camera || c.kind !== 'camera'))) {
    const attempts = a.records.filter(r => isNumber(r[check.field]) || r.measurements?.[check.field]).sort((x, y) => measuredAt(x, check.field).localeCompare(measuredAt(y, check.field)));
    const last = attempts.at(-1), meta = last?.measurements?.[check.field], comparison = a.comparisons[check.field];
    const today = last && dayKey(measuredAt(last, check.field)) === dayKey(new Date(now).toISOString());
    const severe = last && check.kind === 'symptom' && last[check.field] === 2;
    if (severe && ['breath', 'joint', 'vision'].includes(check.field) && now - Date.parse(measuredAt(last, check.field)) <= 86400000) {
      recommendations.push({ checkId: check.id, field: check.field, region: check.region, title: `Strong ${topicOf(check).toLowerCase()} reported`, seconds: 0, priority: 100, reason: 'Tell a crewmate and the medical lead now.' }); continue;
    }
    const poor = meta?.quality === 'poor';
    // A repeat helps only when a ghost exists and the recording or its conditions were the problem.
    const unreliable = check.kind === 'camera' && comparison?.state === 'unreliable' && !!last && !!comparison.referenceId && comparison.referenceCount > 0;
    if (today && !poor && !unreliable) continue;
    const hours = last ? Math.max(0, (now - Date.parse(measuredAt(last, check.field))) / 3600000) : null;
    const ago = hours == null ? '' : hours >= 48 ? `${Math.floor(hours / 24)} days` : `${Math.floor(hours)} h`;
    const reason = poor ? `Last recording too unclear${meta?.confidentFrames != null ? ` (${meta.confidentFrames} confident frames)` : ''}. Record it again.`
      : unreliable ? comparison.reason : !last ? 'Not measured yet.' : `Last checked ${ago} ago.`;
    recommendations.push({ checkId: check.id, field: check.field, region: check.region, title: `${poor || unreliable ? 'Repeat' : 'Check'} ${topicOf(check).toLowerCase()}`, seconds: check.seconds, priority: poor ? 80 : unreliable ? 70 : last && hours > 72 ? 60 : !last ? 50 : 40, emergency: false, reason });
  }
  return recommendations.sort((x, y) => y.priority - x.priority || x.seconds - y.seconds || x.checkId.localeCompare(y.checkId));
}

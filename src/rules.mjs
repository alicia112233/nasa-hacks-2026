import { comparisonIssue, isNumber, measuredAt, metricKeys } from './references.mjs';
/** Deterministic rules. With no ghost set, a crew member's earliest readings are the ghost. */
export function median(values) {
  const sorted = values.filter(v => typeof v === 'number' && Number.isFinite(v)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * When a measure has moved far enough from the ghost to be an alert, the same everywhere (Body, Today, Trends, Report).
 * by: pct (percent of the ghost), points (1–5 ratings: "down 1 point" reads clearer than a percent), abs (in the unit).
 * Thresholds are illustrative, not validated clinical limits.
 */
const RATING = { worse: 'down', by: 'points', at: 1 };
export const TREND_RULES = {
  reactionMs: { worse: 'up', by: 'pct', at: 15 },
  leftRange: { worse: 'down', by: 'pct', at: 8 },
  thighCm: { worse: 'down', by: 'pct', at: 5 },
  exerciseMin: { worse: 'down', by: 'pct', at: 25 },
  heartRate: { worse: 'up', by: 'abs', at: 10, unit: 'bpm' },
  sleepHours: { worse: 'down', by: 'abs', at: 1, unit: 'h' },
  sleep: RATING, mood: RATING, energy: RATING, appetite: RATING, workload: RATING, team: RATING,
};
/** How measures without an alert rule show their change. */
const CHANGE = { rightRange: { by: 'pct' }, temperatureC: { by: 'abs', unit: '°C' }, bpSys: { by: 'abs', unit: 'mmHg' }, bpDia: { by: 'abs', unit: 'mmHg' } };
const trim = v => String(Math.round(v * 10) / 10);
/**
 * The change from the ghost to the last 3, as a number in the rule's terms and as text: "+22%", "−1 pt", "+12 bpm".
 * @param {string} key @param {number | null} current @param {number | null} baseline
 */
export function changeOf(key, current, baseline) {
  const rule = TREND_RULES[key] ?? CHANGE[key] ?? { by: 'pct' };
  if (current == null || baseline == null) return null;
  const amount = rule.by === 'pct' ? (baseline ? Math.round((current - baseline) / baseline * 100) : null) : current - baseline;
  if (amount == null) return null;
  const sign = amount > 0 ? '+' : amount < 0 ? '−' : '±';
  const size = trim(Math.abs(amount));
  const text = rule.by === 'pct' ? `${sign}${size}%` : rule.by === 'points' ? `${sign}${size} pt` : `${sign}${size} ${rule.unit}`;
  return { amount, text, by: rule.by };
}

/** What a comparison still needs, in days: each day counts once, with that day's latest reading. */
function waiting(ref, readings, recent) {
  const days = n => `${n} day${n === 1 ? '' : 's'}`;
  if (ref) return recent >= 3 ? 'Your ghost needs 3 good readings of this.' : `Needs ${days(3 - recent)} more of readings after your ghost.`;
  return `Needs readings on 6 days: the first become your ghost, the latest 3 compare. ${days(readings)} so far.`;
}

export function analyze(checkIns, simulated, references = []) {
  const records = checkIns.filter(c => c.simulated === simulated).sort((a, b) => a.date.localeCompare(b.date));
  // Legacy records retain a fixed first-three reference. Their missing conditions prevent a trend claim.
  const ownReferences = references.filter(r => r.simulated === simulated && (!records.length || r.crewId === records[0].crewId));
  const baselineRecords = ownReferences.find(r => r.phase === 'preflight')?.records ?? ownReferences[0]?.records ?? (records.length >= 3 ? records.slice(0, 3) : []);
  const recent = records.slice(-3);
  // Each metric compares its own last three valid values after the baseline window, so a
  // partial check-in (one self-check today) never hides or fabricates another metric's trend.
  const keys = metricKeys;
  const comparisons = Object.fromEntries(keys.map(key => {
    const attempts = records.filter(r => isNumber(r[key]) || r.measurements?.[key]).sort((a, b) => measuredAt(a, key).localeCompare(measuredAt(b, key)));
    const last = attempts.at(-1);
    const phase = last?.measurements?.[key]?.phase;
    const ref = ownReferences.find(r => r.phase === phase && r.records.some(c => isNumber(c[key]))) ?? ownReferences.find(r => r.phase === 'preflight') ?? ownReferences[0];
    // No ghost set: the earliest readings (up to 11, leaving the latest 3 to compare) are the ghost.
    const valued = attempts.filter(r => isNumber(r[key]));
    const bases = ref ? ref.records.filter(r => isNumber(r[key])) : valued.slice(0, Math.min(11, Math.max(0, valued.length - 3)));
    const base = bases[0];
    // Compare every sample's conditions and require independent measurements after the fixed snapshot.
    const baseEnd = bases.map(r => measuredAt(r, key)).sort().at(-1) ?? '';
    const latestValues = attempts.filter(r => isNumber(r[key]) && measuredAt(r, key) > baseEnd).slice(-3);
    const issue = ref && !base ? 'Your ghost has no reading for this.' : base ? comparisonIssue(last, base, key) ?? latestValues.map(r => comparisonIssue(r, base, key)).find(Boolean) ?? null : null;
    const validBases = bases.filter(r => !comparisonIssue(r, base, key));
    const validRecent = latestValues.filter(r => !comparisonIssue(r, base, key));
    const comparable = !issue && validBases.length >= 3 && latestValues.length === 3 && validRecent.length === 3;
    const span = list => list.length ? [Math.min(...list.map(r => r.sol)), Math.max(...list.map(r => r.sol))] : null;
    return [key, { referenceId: ref?.id ?? null, auto: !ref, phase: ref?.phase ?? 'unknown', referenceCount: bases.length, recentCount: latestValues.length,
      ghostSols: span(ref && validBases.length ? validBases : bases), recentSols: span(latestValues),
      baseline: median((ref && validBases.length ? validBases : bases).map(r => r[key])), current: median(latestValues.map(r => r[key])), lastMeasuredAt: last ? measuredAt(last, key) : null,
      state: !last ? 'missing' : issue ? 'unreliable' : comparable ? 'comparable' : 'insufficient',
      reason: !last ? 'Not measured yet.' : issue ?? (comparable ? 'Your last 3 readings against your ghost.' : waiting(ref, valued.length, latestValues.length)), comparable }];
  }));
  const baseline = Object.fromEntries(keys.map(k => [k, comparisons[k].baseline]));
  const current = Object.fromEntries(keys.map(k => [k, comparisons[k].current]));
  const change = (value, base) => value != null && base != null && base !== 0 ? Math.round((value - base) / base * 100) : null;
  const attentionDelta = change(current.reactionMs, baseline.reactionMs);
  const movementDelta = change(current.leftRange, baseline.leftRange);
  const legDelta = change(current.thighCm, baseline.thighCm);
  const enough = baselineRecords.length >= 3 && recent.length === 3;
  const quality = Object.fromEntries(keys.map(key => [key, {
    baseline: comparisons[key].referenceCount,
    recent: comparisons[key].recentCount,
  }]));
  // One rule table decides every trend. A changed outline is a prompt to review, never evidence of muscle loss.
  const trends = Object.fromEntries(keys.map(key => {
    const rule = TREND_RULES[key];
    const change = changeOf(key, current[key], baseline[key]);
    const worse = !!rule && comparisons[key].comparable && change != null && (rule.worse === 'up' ? change.amount >= rule.at : change.amount <= -rule.at);
    return [key, { change, worse }];
  }));
  return {
    baseline, current, recent, baselineRecords, records, enough, quality, comparisons, trends,
    attentionDelta, movementDelta, legDelta,
    attentionFlag: trends.reactionMs.worse, movementFlag: trends.leftRange.worse, wellbeingFlag: trends.sleep.worse, legFlag: trends.thighCm.worse,
  };
}

export function summarizeReaction(samples, missed) {
  return { reactionMs: median(samples), missed, signals: samples.length + missed };
}

export function shoulderAngle(hip, shoulder, elbow) {
  if (!hip || !shoulder || !elbow || [hip, shoulder, elbow].some(p => (p.visibility ?? 1) < 0.6)) return null;
  const a = [hip.x - shoulder.x, hip.y - shoulder.y, hip.z - shoulder.z];
  const b = [elbow.x - shoulder.x, elbow.y - shoulder.y, elbow.z - shoulder.z];
  const length = Math.hypot(...a) * Math.hypot(...b);
  if (!length) return null;
  return Math.acos(Math.max(-1, Math.min(1, a.reduce((sum, x, i) => sum + x * b[i], 0) / length))) * 180 / Math.PI;
}

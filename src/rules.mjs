import { comparisonIssue, isNumber, measuredAt, metricKeys } from './references.mjs';
/** Deterministic prototype rules. Baselines never mix simulated and recorded data. */
export function median(values) {
  const sorted = values.filter(v => typeof v === 'number' && Number.isFinite(v)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
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
    const bases = (ref?.records ?? baselineRecords).filter(r => isNumber(r[key]));
    const base = bases[0];
    // Compare every sample's conditions and require independent measurements after the fixed snapshot.
    const baseEnd = bases.map(r => measuredAt(r, key)).sort().at(-1) ?? '';
    const latestValues = attempts.filter(r => isNumber(r[key]) && measuredAt(r, key) > baseEnd).slice(-3);
    const issue = !ref ? 'No explicitly established reference. Earlier records are shown for context only.' : !base ? 'This metric is missing from the reference.' : comparisonIssue(last, base, key) ?? latestValues.map(r => comparisonIssue(r, base, key)).find(Boolean) ?? null;
    const validBases = bases.filter(r => !comparisonIssue(r, base, key));
    const validRecent = latestValues.filter(r => !comparisonIssue(r, base, key));
    const comparable = !issue && validBases.length >= 3 && latestValues.length === 3 && validRecent.length === 3;
    return [key, { referenceId: ref?.id ?? null, phase: ref?.phase ?? 'unknown', referenceCount: bases.length, recentCount: latestValues.length,
      baseline: median((ref && validBases.length ? validBases : bases).map(r => r[key])), current: median(latestValues.map(r => r[key])), lastMeasuredAt: last ? measuredAt(last, key) : null,
      state: !last ? 'missing' : issue ? 'unreliable' : comparable ? 'comparable' : 'insufficient',
      reason: !last ? 'No measurement has been recorded.' : issue ?? (comparable ? 'Three recent readings under matching conditions against a fixed reference.' : 'Need three reference and three later readings under matching conditions.'), comparable }];
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
  const comparable = key => comparisons[key].comparable;
  return {
    baseline, current, recent, baselineRecords, records, enough, quality, comparisons,
    attentionDelta, movementDelta, legDelta,
    attentionFlag: enough && comparable('reactionMs') && attentionDelta != null && attentionDelta >= 15,
    movementFlag: enough && comparable('leftRange') && movementDelta != null && movementDelta <= -8,
    wellbeingFlag: enough && comparable('sleep') && current.sleep != null && baseline.sleep != null && current.sleep <= baseline.sleep - 1,
    // A changed outline is a prompt to review, never evidence of muscle loss. Fluid shifts also change leg volume.
    legFlag: enough && comparable('thighCm') && legDelta != null && legDelta <= -5,
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

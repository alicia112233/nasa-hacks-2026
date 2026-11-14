/** Deterministic prototype rules. Baselines never mix simulated and recorded data. */
export function median(values) {
  const sorted = values.filter(v => typeof v === 'number' && Number.isFinite(v)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function analyze(checkIns, simulated) {
  const records = checkIns.filter(c => c.simulated === simulated).sort((a, b) => a.date.localeCompare(b.date));
  const baselineRecords = records.slice(0, Math.min(11, Math.max(0, records.length - 3)));
  const recent = records.slice(-3);
  // Each metric compares its own last three valid values after the baseline window, so a
  // partial check-in (one self-check today) never hides or fabricates another metric's trend.
  const isNum = v => typeof v === 'number' && Number.isFinite(v);
  const after = records.slice(baselineRecords.length);
  const recentValues = key => after.map(c => c[key]).filter(isNum).slice(-3);
  const keys = ['reactionMs', 'sleep', 'energy', 'leftRange', 'rightRange', 'thighCm'];
  const baseline = Object.fromEntries(keys.map(k => [k, median(baselineRecords.map(c => c[k]))]));
  const current = Object.fromEntries(keys.map(k => [k, median(recentValues(k))]));
  const change = (value, base) => value != null && base != null && base !== 0 ? Math.round((value - base) / base * 100) : null;
  const attentionDelta = change(current.reactionMs, baseline.reactionMs);
  const movementDelta = change(current.leftRange, baseline.leftRange);
  const legDelta = change(current.thighCm, baseline.thighCm);
  const enough = baselineRecords.length >= 3 && recent.length === 3;
  const quality = Object.fromEntries(keys.map(key => [key, {
    baseline: baselineRecords.filter(c => isNum(c[key])).length,
    recent: recentValues(key).length,
  }]));
  const comparable = key => quality[key].baseline >= 3 && quality[key].recent === 3;
  return {
    baseline, current, recent, baselineRecords, records, enough, quality,
    attentionDelta, movementDelta, legDelta,
    attentionFlag: enough && comparable('reactionMs') && attentionDelta != null && attentionDelta >= 15,
    movementFlag: enough && comparable('leftRange') && movementDelta != null && movementDelta <= -8,
    wellbeingFlag: enough && comparable('sleep') && current.sleep != null && baseline.sleep != null && current.sleep <= baseline.sleep - 1,
    // Thigh breadth 5% or more below the ghost. Illustrative, like the others: the 0g fluid shift alone thins legs up to
    // 6% in the first days (HIDH Table 4.3-4), so a ghost taken in flight makes further loss point to muscle.
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

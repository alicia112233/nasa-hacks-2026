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
  const baseline = {
    reactionMs: median(baselineRecords.map(c => c.reactionMs)),
    sleep: median(baselineRecords.map(c => c.sleep)),
    energy: median(baselineRecords.map(c => c.energy)),
    leftRange: median(baselineRecords.map(c => c.leftRange)),
    rightRange: median(baselineRecords.map(c => c.rightRange)),
  };
  const current = {
    reactionMs: median(recent.map(c => c.reactionMs)),
    sleep: median(recent.map(c => c.sleep)),
    energy: median(recent.map(c => c.energy)),
    leftRange: median(recent.map(c => c.leftRange)),
    rightRange: median(recent.map(c => c.rightRange)),
  };
  const change = (value, base) => value != null && base != null && base !== 0 ? Math.round((value - base) / base * 100) : null;
  const attentionDelta = change(current.reactionMs, baseline.reactionMs);
  const movementDelta = change(current.leftRange, baseline.leftRange);
  const enough = baselineRecords.length >= 3 && recent.length === 3;
  const quality = Object.fromEntries(['reactionMs', 'sleep', 'energy', 'leftRange', 'rightRange'].map(key => [key, {
    baseline: baselineRecords.filter(c => typeof c[key] === 'number' && Number.isFinite(c[key])).length,
    recent: recent.filter(c => typeof c[key] === 'number' && Number.isFinite(c[key])).length,
  }]));
  const comparable = key => quality[key].baseline >= 3 && quality[key].recent === 3;
  return {
    baseline, current, recent, baselineRecords, records, enough, quality,
    attentionDelta, movementDelta,
    attentionFlag: enough && comparable('reactionMs') && attentionDelta != null && attentionDelta >= 15,
    movementFlag: enough && comparable('leftRange') && movementDelta != null && movementDelta <= -8,
    wellbeingFlag: enough && comparable('sleep') && current.sleep != null && baseline.sleep != null && current.sleep <= baseline.sleep - 1,
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

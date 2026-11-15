/**
 * Compact exports: the recording conditions nearly every measurement shares are written once, at the top, and each
 * measurement keeps only what is its own (a different time, a quality other than good, a changed setup, frame counts).
 * Records on the device keep their full conditions; only downloaded files are compacted.
 */
const CONTEXT = ['phase', 'cameraSetup', 'posture', 'lighting', 'clothing', 'activity'];
const isMap = v => v && typeof v === 'object' && !Array.isArray(v);

/** Visit every object in a value, depth first. */
function visit(node, fn) {
  if (Array.isArray(node)) node.forEach(n => visit(n, fn));
  else if (isMap(node)) { fn(node); Object.values(node).forEach(v => visit(v, fn)); }
}
/** Each measurement-like object in a record: a record's `measurements` map, or a care event value's `conditions`. */
function contexts(node) {
  const found = [];
  if (isMap(node.measurements)) for (const m of Object.values(node.measurements)) if (isMap(m)) found.push(m);
  if (isMap(node.conditions) && CONTEXT.some(k => k in node.conditions)) found.push(node.conditions);
  return found;
}

/** @template T @param {T} data @returns {T & { conditions?: Record<string, string> }} */
export function compactExport(data) {
  const copy = structuredClone(data);
  const counts = Object.fromEntries(CONTEXT.map(k => [k, new Map()]));
  visit(copy, node => contexts(node).forEach(m => CONTEXT.forEach(k => { if (typeof m[k] === 'string' && m[k]) counts[k].set(m[k], (counts[k].get(m[k]) ?? 0) + 1); })));
  // The most common value of each condition is the shared one.
  const shared = Object.fromEntries(CONTEXT.map(k => [k, [...counts[k]].sort((a, b) => b[1] - a[1])[0]?.[0]]).filter(([, v]) => v != null));
  if (!Object.keys(shared).length) return copy;
  // A measurement inside a ghost snapshot takes that snapshot's phase, so it need not repeat it.
  visit(copy, node => {
    if (!Array.isArray(node.records) || typeof node.phase !== 'string') return;
    for (const r of node.records) if (isMap(r)) for (const m of contexts(r)) if (m.phase === node.phase) delete m.phase;
  });
  visit(copy, node => {
    for (const m of contexts(node)) {
      for (const k of CONTEXT) if (m[k] === shared[k]) delete m[k];
      if (m.measuredAt && (m.measuredAt === node.date || m.measuredAt === node.measuredAt) && m !== node) delete m.measuredAt;
      if (m.quality === 'good') delete m.quality;
    }
    if (isMap(node.measurements)) {
      // A value every measurement of this record still carries is stated once, on the record.
      const own = Object.values(node.measurements).filter(isMap);
      for (const k of CONTEXT) {
        const v = own[0]?.[k];
        if (v != null && own.length > 1 && own.every(m => m[k] === v)) { node.conditions = { ...(isMap(node.conditions) ? node.conditions : {}), [k]: v }; own.forEach(m => delete m[k]); }
      }
      for (const [key, m] of Object.entries(node.measurements)) if (isMap(m) && !Object.keys(m).length) delete node.measurements[key];
      if (!Object.keys(node.measurements).length) delete node.measurements;
    }
    if (isMap(node.conditions) && node !== copy && !Object.keys(node.conditions).length) delete node.conditions;
  });
  return { conditions: { ...shared, quality: 'good', appliesTo: 'Every measurement below, at its record\'s date, unless its ghost snapshot, record or measurement lists its own value.' }, ...copy };
}

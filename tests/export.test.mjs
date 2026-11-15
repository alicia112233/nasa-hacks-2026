import test from 'node:test';
import assert from 'node:assert/strict';
import { compactExport } from '../src/export.mjs';

const context = { phase: 'cruise', cameraSetup: 'Camera A', posture: 'Upright', lighting: 'Front lit', clothing: 'Fitted', activity: 'Rested' };
const record = (id, date, extra = {}) => ({ id, date, sleep: 4, thighCm: 15.8,
  measurements: { sleep: { ...context, measuredAt: date, quality: 'good' }, thighCm: { ...context, measuredAt: date, quality: 'good', confidentFrames: 40, ...extra } } });

test('exports state shared recording conditions once and keep only what each measurement has of its own', () => {
  const data = { snapshot: [record('a', '2026-11-01T01:00:00Z'), record('b', '2026-11-02T01:00:00Z', { cameraSetup: 'Camera B', quality: 'poor' })],
    care: [{ field: 'sleep', value: 4, measuredAt: '2026-11-02T01:00:00Z', conditions: { ...context, measuredAt: '2026-11-02T01:00:00Z', quality: 'good' } }] };
  const out = compactExport(data);
  assert.deepEqual(Object.keys(out)[0], 'conditions');
  assert.equal(out.conditions.cameraSetup, 'Camera A');
  assert.equal(out.conditions.quality, 'good');
  // A measurement identical to the shared conditions disappears; one with its own values keeps only those.
  assert.equal(out.snapshot[0].measurements.sleep, undefined);
  assert.deepEqual(out.snapshot[0].measurements.thighCm, { confidentFrames: 40 });
  assert.deepEqual(out.snapshot[1].measurements.thighCm, { cameraSetup: 'Camera B', quality: 'poor', confidentFrames: 40 });
  assert.equal(out.care[0].conditions, undefined);
  // The device copy is untouched, and the export is much smaller.
  assert.equal(data.snapshot[0].measurements.sleep.cameraSetup, 'Camera A');
  assert.ok(JSON.stringify(out).length < JSON.stringify(data).length * 0.6);
});

test('an export with no recorded conditions passes through unchanged', () => {
  const plain = { context: 'Note', observations: [{ id: 'x', sleep: 3 }] };
  assert.deepEqual(compactExport(plain), plain);
});

test('readings inside a ghost snapshot inherit its phase, and a value shared by one record moves up to that record', () => {
  const preflight = (id, date) => ({ ...record(id, date), measurements: Object.fromEntries(Object.entries(record(id, date).measurements).map(([k, m]) => [k, { ...m, phase: 'preflight' }])) });
  const data = { observations: [record('a', '2026-11-01T01:00:00Z'), record('b', '2026-11-02T01:00:00Z')],
    references: [{ id: 'ref', phase: 'preflight', records: [preflight('p1', '2026-09-01T01:00:00Z'), preflight('p2', '2026-09-02T01:00:00Z')] }],
    loose: [{ ...record('c', '2026-11-03T01:00:00Z'), measurements: { sleep: { ...context, lighting: 'Dim', measuredAt: '2026-11-03T01:00:00Z' }, mood: { ...context, lighting: 'Dim', measuredAt: '2026-11-03T01:00:00Z' } } }] };
  const out = compactExport(data);
  assert.equal(out.conditions.phase, 'cruise');
  assert.equal(JSON.stringify(out.references).includes('"phase":"preflight","records"') || out.references[0].phase === 'preflight', true);
  assert.ok(!JSON.stringify(out.references[0].records).includes('preflight'), 'the snapshot states its phase once');
  assert.deepEqual(out.loose[0].conditions, { lighting: 'Dim' });
  assert.equal(out.loose[0].measurements, undefined);
});

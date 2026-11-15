import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from '../src/rules.mjs';
import { establishReference } from '../src/references.mjs';
import { recommendChecks, crewHeadaches } from '../src/daily.mjs';
import { documented, referencesFor } from './fixtures/references.mjs';

const now = Date.parse('2026-11-15T10:00:00Z');
const series = () => documented(Array.from({ length: 14 }, (_, i) => ({ id: `r-${i}`, crewId: 'crew-a', simulated: false, date: new Date(now - (14 - i) * 86400000).toISOString(), sol: i + 1, reactionMs: i < 11 ? 300 : 390, leftRange: i < 11 ? 150 : 120, thighCm: i < 11 ? 16 : 15, sleep: 4 })));

test('matching fixed references allow trends; recording changes suppress a clinical-looking comparison', () => {
  const records = series(), refs = referencesFor(records);
  assert.equal(analyze(records, false, refs).legFlag, true);
  records.at(-1).measurements.thighCm.cameraSetup = 'Different camera';
  const a = analyze(records, false, refs);
  assert.equal(a.legFlag, false);
  assert.equal(a.comparisons.thighCm.state, 'unreliable');
  assert.match(a.comparisons.thighCm.reason, /Conditions differ/);
  assert.equal(a.attentionFlag, true);
});

test('poor frames cannot produce a trend; with no ghost set, the earliest readings are the ghost', () => {
  const records = series(), refs = referencesFor(records);
  records.at(-1).measurements.leftRange.quality = 'poor';
  records.at(-1).measurements.leftRange.confidentFrames = 4;
  assert.equal(analyze(records, false, refs).movementFlag, false);
  const legacy = records.map(({ measurements, ...r }) => r);
  const auto = analyze(legacy, false).comparisons.reactionMs;
  assert.equal(auto.auto, true);
  assert.equal(auto.comparable, true);
  assert.equal(auto.referenceCount, 11);
  // Too few readings for an earlier and a newer three: not comparable yet, and it says so.
  assert.match(analyze(legacy.slice(0, 4), false).comparisons.reactionMs.reason, /Needs readings on 6 days/);
});

test('adding a phase reference preserves preflight and rejects replacement; snapshots resist gradual deterioration', () => {
  const records = series();
  const preflight = referencesFor(records)[0]; preflight.phase = 'preflight';
  preflight.records.forEach(r => Object.values(r.measurements).forEach(m => { m.phase = 'preflight'; }));
  const original = structuredClone(preflight);
  const reference = establishReference({ id: 'cruise', crewId: 'crew-a', simulated: false, records, phase: 'cruise', reason: 'Established cruise conditions after adaptation; changes reviewed', now: new Date(now).toISOString(), references: [preflight] });
  const refs = [preflight, reference];
  assert.deepEqual(refs[0], original);
  const baseline = analyze(records, false, refs).baseline.thighCm;
  const extra = documented([{ ...records.at(-1), id: 'late', date: new Date(now + 86400000).toISOString(), thighCm: 12 }])[0];
  assert.equal(analyze([...records, extra], false, refs).baseline.thighCm, baseline);
  records[4].thighCm = 7;
  assert.notEqual(reference.records.find(r => r.id === records[4].id)?.thighCm, 7);
  assert.throws(() => establishReference({ id: 'replacement', crewId: 'crew-a', simulated: false, records, phase: 'cruise', reason: 'New normal', now: new Date(now).toISOString(), references: refs }), /cannot be overwritten/);
  assert.throws(() => establishReference({ id: 'new', crewId: 'crew-a', simulated: true, records, phase: 'surface', reason: 'Test', now: new Date(now).toISOString() }), /three good/);
});

test('a phase label alone never breaks a comparison, and per-metric times survive another check', () => {
  const records = series(), refs = referencesFor(records);
  records.at(-1).measurements.thighCm.phase = 'surface';
  const a = analyze(records, false, refs);
  assert.notEqual(a.comparisons.thighCm.state, 'unreliable');
  assert.equal(a.comparisons.thighCm.lastMeasuredAt, records.at(-1).measurements.thighCm.measuredAt);
  assert.equal(a.comparisons.sleep.comparable, true);
});

test('recommendations prioritize quality, respect equipment and time, and escalate without baseline', () => {
  const records = series(), refs = referencesFor(records);
  records.at(-1).measurements.leftRange.quality = 'poor';
  records.at(-1).measurements.leftRange.confidentFrames = 4;
  const options = { checkIns: records, simulated: false, references: refs, now };
  const next = recommendChecks(options)[0];
  assert.equal(next.checkId, 'shoulder'); assert.match(next.reason, /4 confident frames/);
  assert.ok(recommendChecks({ ...options, camera: false }).every(r => !['shoulder', 'legs'].includes(r.checkId)));
  assert.ok(recommendChecks({ ...options, seconds: 5 }).every(r => r.seconds <= 5));
  const acute = [{ crewId: 'new', simulated: false, date: new Date(now).toISOString(), breath: 2 }];
  // A strong symptom goes first, with what to do now, and opens its region's Act now steps.
  const urgent = recommendChecks({ checkIns: acute, simulated: false, now })[0];
  assert.equal(urgent.checkId, 'breath');
  assert.equal(urgent.priority, 100);
  assert.match(urgent.reason, /Tell a crewmate/);
});

test('crew headache prompt counts unique people in a bounded window, respects resolution and separates demo', () => {
  const r = (id, h, offset = 0, simulated = false) => ({ crewId: id, simulated, headache: h, date: new Date(now + offset).toISOString() });
  const rows = [r('a', 1), r('a', 1), r('b', 2, -3600000), r('old', 1, -25 * 3600000), r('future', 1, 3600000), r('demo', 1, 0, true)];
  assert.deepEqual(crewHeadaches(rows, false, now), ['a', 'b']);
  assert.deepEqual(crewHeadaches([...rows, r('b', 0, -1000)], false, now), ['a']);
  assert.deepEqual(crewHeadaches(rows, true, now), ['demo']);
});

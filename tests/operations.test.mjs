import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from '../src/rules.mjs';
import { createIncident, advanceIncident, emergencyHandoff, supportInstruction } from '../src/emergency.mjs';
import { establishReference } from '../src/references.mjs';
import { recommendChecks, crewHeadaches } from '../src/daily.mjs';
import { documented, referencesFor } from './fixtures/references.mjs';

const now = Date.parse('2026-11-15T10:00:00Z');
const series = () => documented(Array.from({ length: 14 }, (_, i) => ({ id: `r-${i}`, crewId: 'crew-a', simulated: false, date: new Date(now - (14 - i) * 86400000).toISOString(), sol: i + 1, reactionMs: i < 11 ? 300 : 390, leftRange: i < 11 ? 150 : 120, thighCm: i < 11 ? 16 : 15, sleep: 4 })));

test('a new crew member can run the offline emergency branch and generate a versioned handoff without history', () => {
  let e = createIncident({ id: 'incident', crewId: 'new', crewName: 'New crew', simulated: true, now: new Date(now).toISOString() });
  for (const response of ['Response activated', 'Unresponsive', 'Not breathing normally']) e = advanceIncident(e, response, 'Observation', new Date(now + e.events.length * 1000).toISOString());
  assert.equal(e.step, 'urgent');
  e = advanceIncident(e, 'Response underway', '', new Date(now + 4000).toISOString());
  e = advanceIncident(e, 'No AED available', '', new Date(now + 5000).toISOString());
  e = advanceIncident(e, 'No trained assistance present', 'Crew called', new Date(now + 6000).toISOString());
  assert.match(supportInstruction(e), /without waiting/);
  assert.match(supportInstruction(e), /Call for trained help/);
  assert.equal(e.events.length, 6);
  const packet = emergencyHandoff(e);
  assert.equal(packet.transmitted, false);
  assert.equal(packet.procedure.version, '0.1.0');
  assert.equal(packet.procedure.review.clinician, null);
  assert.match(packet.procedure.review.status, /review required/);
  assert.ok(packet.events.every(v => v.at && v.instruction && v.response));
  assert.throws(() => advanceIncident(e, 'Impossible answer', '', new Date(now).toISOString()), /Invalid/);
});

test('normal breathing follows observation, resources adapt, reassessment appends, and transfer closes the log', () => {
  let e = createIncident({ id: 'i', crewId: 'a', crewName: 'A', simulated: false, now: new Date(now).toISOString() });
  const step = response => { e = advanceIncident(e, response, '', new Date(now + e.events.length * 1000).toISOString()); };
  step('Response activated'); step('Responsive'); step('Breathing normally');
  assert.equal(e.step, 'assess');
  step('Observation underway'); step('AED available'); step('Medical lead present');
  assert.match(supportInstruction(e), /AED retrieval/);
  step('Reassess responsiveness'); assert.equal(e.step, 'responsive');
  step('Unresponsive'); step('Unsure'); assert.equal(e.step, 'urgent');
  step('Response underway'); step('AED available'); step('Medical lead present'); step('Care transferred to medical lead');
  assert.ok(e.endedAt);
  assert.equal(emergencyHandoff(e).status, 'care transferred');
  assert.throws(() => advanceIncident(e, 'Reassess responsiveness', '', new Date(now).toISOString()), /Invalid/);
});

test('matching fixed references allow trends; recording changes suppress a clinical-looking comparison', () => {
  const records = series(), refs = referencesFor(records);
  assert.equal(analyze(records, false, refs).legFlag, true);
  records.at(-1).measurements.thighCm.cameraSetup = 'Different camera';
  const a = analyze(records, false, refs);
  assert.equal(a.legFlag, false);
  assert.equal(a.comparisons.thighCm.state, 'unreliable');
  assert.match(a.comparisons.thighCm.reason, /conditions differ/);
  assert.equal(a.attentionFlag, true);
});

test('poor frames and unknown legacy conditions cannot produce a trend', () => {
  const records = series(), refs = referencesFor(records);
  records.at(-1).measurements.leftRange.quality = 'poor';
  records.at(-1).measurements.leftRange.confidentFrames = 4;
  assert.equal(analyze(records, false, refs).movementFlag, false);
  const legacy = records.map(({ measurements, ...r }) => r);
  assert.equal(analyze(legacy, false).attentionFlag, false);
  assert.match(analyze(legacy, false).comparisons.reactionMs.reason, /No explicitly established reference/);
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

test('phase mismatch is unreliable and per-metric times survive another check', () => {
  const records = series(), refs = referencesFor(records);
  records.at(-1).measurements.thighCm.phase = 'surface';
  const a = analyze(records, false, refs);
  assert.match(a.comparisons.thighCm.reason, /phase differs/);
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
  assert.equal(recommendChecks({ checkIns: acute, simulated: false, now })[0].emergency, true);
});

test('crew headache prompt counts unique people in a bounded window, respects resolution and separates demo', () => {
  const r = (id, h, offset = 0, simulated = false) => ({ crewId: id, simulated, headache: h, date: new Date(now + offset).toISOString() });
  const rows = [r('a', 1), r('a', 1), r('b', 2, -3600000), r('old', 1, -25 * 3600000), r('future', 1, 3600000), r('demo', 1, 0, true)];
  assert.deepEqual(crewHeadaches(rows, false, now), ['a', 'b']);
  assert.deepEqual(crewHeadaches([...rows, r('b', 0, -1000)], false, now), ['a']);
  assert.deepEqual(crewHeadaches(rows, true, now), ['demo']);
});

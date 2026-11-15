import test from 'node:test';
import assert from 'node:assert/strict';
import { assess } from '../src/assess.mjs';
import { regionStatuses } from '../src/body.mjs';
import { daySummary } from '../src/today.mjs';
import { documented, referencesFor } from './fixtures/references.mjs';

const now = '2026-11-15T04:00:00.000Z';
const day = 86400000;
const record = (values, at = now) => ({ id: at, crewId: 'a', simulated: false, date: at, sol: 14, ...values,
  measurements: Object.fromEntries(Object.keys(values).map(k => [k, { measuredAt: at, quality: 'good' }])) });

test('a one-point rating decline has the same concern, urgency and first step on the body and report', () => {
  const records = documented(Array.from({ length: 14 }, (_, i) => ({ ...record({ mood: i < 11 ? 4 : 3 }, new Date(Date.parse(now) - (13 - i) * day).toISOString()), sol: i + 1 })));
  const refs = referencesFor(records);
  const { concerns, analysis } = assess(records, false, refs, now);
  assert.equal(analysis.trends.mood.change.text, '−1 pt');
  const concern = concerns.find(c => c.checkId === 'mood');
  assert.ok(concern);
  assert.doesNotMatch(concern.reason, /%/);
  const statuses = regionStatuses(records, false, now, refs);
  assert.deepEqual(statuses.head.items.find(i => i.check.id === 'mood').concern, concern);
  const row = daySummary(statuses).attention.find(a => a.check.id === 'mood');
  assert.equal(row.label, concern.label);
  assert.equal(row.reason, concern.reason);
  assert.equal(row.step, concern.steps[0].text);
});

test('paired blood pressure and temperature get immediate findings without a ghost; incomplete pairs do not', () => {
  const records = [record({ bpSys: 160, bpDia: 121, temperatureC: 38.2 })];
  const concerns = assess(records, false, [], now).concerns;
  assert.equal(concerns[0].checkId, 'bp');
  assert.equal(concerns[0].level, 'now');
  assert.match(concerns[0].steps[0].text, /medical lead now/);
  assert.ok(concerns[0].steps.every(s => !s.text.includes('tomorrow')));
  assert.equal(concerns.find(c => c.checkId === 'temperature').level, 'tell');
  assert.equal(assess([record({ bpSys: 180 })], false, [], now).concerns.length, 0);
  const incomplete = regionStatuses([record({ bpSys: 180 })], false, now).chest.items.find(i => i.check.id === 'bp');
  assert.equal(incomplete.done, false);
});

test('historical assessments exclude later measurements in a shared daily entry and keep the input intact', () => {
  const later = new Date(Date.parse(now) + 3600000).toISOString();
  const entry = record({ sleep: 4, mood: 1 });
  entry.measurements.mood.measuredAt = later;
  const before = structuredClone(entry);
  assert.equal(assess([entry], false, [], now).concerns.length, 0);
  assert.equal(assess([entry], false, [], later).concerns[0].checkId, 'mood');
  assert.deepEqual(entry, before);
});

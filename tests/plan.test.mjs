import test from 'node:test';
import assert from 'node:assert/strict';
import { regionStatuses, prepSeconds, checks } from '../src/body.mjs';
import { daySummary } from '../src/today.mjs';
import { recommendChecks } from '../src/daily.mjs';

const now = '2026-11-15T04:00:00.000Z';
const startDate = '2026-11-15T00:00:00+08:00';
const record = values => ({ id: 'today', crewId: 'a', simulated: false, date: now, sol: 1, ...values,
  measurements: Object.fromEntries(Object.keys(values).filter(k => typeof values[k] === 'number').map(k => [k, { measuredAt: now, quality: 'good' }])) });
const statuses = records => regionStatuses(records, false, now, [], { startDate });

test('a new mission has a bounded routine; optional symptom checks stay available without becoming obligations', () => {
  const initial = statuses([]);
  const summary = daySummary(initial);
  assert.equal(summary.total, 9);
  assert.equal(initial.head.items.find(i => i.check.id === 'headache').due, false);
  assert.equal(initial.chest.items.find(i => i.check.id === 'bp').due, false);
  assert.ok(initial.legs.items.find(i => i.check.id === 'legs').due);
  assert.ok(recommendChecks({ checkIns: [], simulated: false, now: Date.parse(now), startDate }).every(r => r.checkId !== 'headache'));
});

test('a symptom adds temperature and its follow-up; concerns remain visible when every due check is completed', () => {
  const records = [record({ headache: 1 })];
  const before = statuses(records);
  assert.equal(before.chest.items.find(i => i.check.id === 'temperature').due, true);
  const values = Object.fromEntries(Object.values(before).flatMap(s => s.items).filter(i => i.due).map(i => [i.check.field, i.check.kind === 'scale' ? 4 : i.check.field === 'headache' ? 1 : i.check.field === 'sleepHours' ? 7.5 : i.check.field === 'heartRate' ? 64 : i.check.field === 'temperatureC' ? 36.8 : 20]));
  const complete = daySummary(statuses([record(values)]));
  assert.equal(complete.done, complete.total);
  assert.ok(complete.attention.some(a => a.check.id === 'headache'));
});

test('completing a scheduled weekly check preserves today’s target, and shared rest is counted once', () => {
  const before = daySummary(statuses([]));
  const after = daySummary(statuses([record({ thighCm: 16 })]));
  assert.equal(after.total, before.total);
  assert.equal(after.done, before.done + 1);
  assert.equal(prepSeconds(checks.filter(c => ['heartRate', 'bp', 'shoulder'].includes(c.id))), 330);
});

test('missing equipment is retained as a gap without fabricating a measurement', () => {
  const weekly = '2026-11-21T04:00:00.000Z';
  const r = { ...record({ skipped: ['bp'] }), date: weekly, sol: 7 };
  const summary = daySummary(regionStatuses([r], false, weekly, [], { startDate }));
  assert.ok(summary.notMeasured.some(n => n.check.id === 'bp'));
  assert.equal(summary.rows.find(r => r.check.id === 'bp').result, null);
  assert.equal(summary.rows.find(r => r.check.id === 'bp').routine, false);
});

test('a symptom resolved by a repeat stays completed in the saved routine', () => {
  const initial = statuses([record({ headache: 1 })]);
  const planned = Object.values(initial).flatMap(s => s.items.filter(i => i.due).map(i => i.check.id));
  const resolved = statuses([record({ headache: 0, planned })]);
  assert.equal(daySummary(resolved).total, daySummary(initial).total);
  assert.equal(resolved.head.items.find(i => i.check.id === 'headache').done, true);
  assert.equal(resolved.head.items.find(i => i.check.id === 'headache').concern, null);
});

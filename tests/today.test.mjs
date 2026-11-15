import test from 'node:test';
import assert from 'node:assert/strict';
import { checks, domainOf, regionStatuses } from '../src/body.mjs';
import { daySummary, nextRegion } from '../src/today.mjs';

const now = '2026-11-15T04:00:00.000Z';
const entry = values => ({ id: 'today', crewId: 'a', simulated: false, date: now, sol: 1, reactionMs: null, missed: 0, signals: 0, symptoms: [], notes: '', ...values,
  measurements: Object.fromEntries(Object.keys(values).map(k => [k, { measuredAt: now, quality: 'good' }])) });

test('the two rings split every self-check by its NASA risks: mind or body', () => {
  const self = checks.filter(c => c.field);
  assert.deepEqual(self.filter(c => domainOf(c) === 'mental').map(c => c.id), ['attention', 'sleep', 'sleepHours', 'mood', 'energy', 'workload', 'team']);
  assert.equal(self.filter(c => domainOf(c) === 'physical').length, 16);
});

test('today counts done checks, marks off-range results, and points at the next one', () => {
  const summary = daySummary(regionStatuses([entry({ sleep: 4, headache: 1, heartRate: 64 })], false, now));
  assert.equal(summary.mental.done, 1);
  assert.equal(summary.physical.done, 2);
  assert.equal(summary.done, 3);
  assert.equal(summary.total, 11, 'only due checks and symptom-triggered follow-ups enter today’s target');
  assert.equal(summary.rows.find(r => r.check.id === 'headache').state, 'off', 'a mild headache is done but off');
  assert.equal(summary.rows.find(r => r.check.id === 'heartRate').state, 'done');
  assert.equal(summary.mental.next.check.id, 'sleepHours');
  // A reported symptom carries its own urgency and first step, not a neighbour's.
  const headache = summary.attention.find(a => a.check.id === 'headache');
  assert.equal(headache.label, 'Watch');
  assert.ok(headache.step);
  // Instruments the app does not have are listed as gaps, never as results.
  assert.ok(summary.notMeasured.some(n => n.check.id === 'oct'));
  assert.ok(!summary.rows.some(r => r.check.kind === 'instrument'));
});

test('a finished region leads to the next region with checks left', () => {
  const statuses = regionStatuses([entry({ reactionMs: 300, sleep: 4, sleepHours: 7.5, mood: 4, energy: 4, dizziness: 0, headache: 0, workload: 4, team: 4 })], false, now);
  assert.equal(statuses.head.items.filter(i => i.due).every(i => i.done), true);
  assert.equal(nextRegion(statuses, 'head').id, 'chest');
});

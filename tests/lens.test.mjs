import test from 'node:test';
import assert from 'node:assert/strict';
import { createMissionPacket, lensSnapshot } from '../src/mission-lens.mjs';
import { documented, referencesFor } from './fixtures/references.mjs';

const records = documented(Array.from({ length: 14 }, (_, i) => ({
  id: `demo-${i}`, date: new Date(Date.UTC(2026, 10, i + 1, 1)).toISOString(),
  sol: i + 29, simulated: true, reactionMs: i > 10 ? 370 : 310,
  sleep: i > 10 ? 2 : 4, mood: 4, energy: i > 10 ? 2 : 4,
  leftRange: i > 10 ? 130 : 152, symptoms: [], missed: 0, signals: 12, notes: '',
})));

test('mission replay cannot inspect later observations', () => {
  const before = lensSnapshot(records, true, 'demo-7', referencesFor(records));
  const after = lensSnapshot(records, true, 'demo-13', referencesFor(records));
  assert.equal(before.records.length, 8);
  assert.equal(before.signals, 0);
  assert.ok(before.records.every(c => c.date <= before.latest.date));
  assert.equal(after.signals, 2);
  assert.equal(after.statuses.radiation, 'unknown');
  assert.equal(after.statuses.environment, 'unknown');
  assert.equal(after.metrics[0].baseline, 310);
});

test('missing movement samples never produce a confident trend from check-in count alone', () => {
  const sparse = records.map((r, i) => ({ ...r, leftRange: i === 13 ? 90 : undefined }));
  const result = lensSnapshot(sparse, true);
  const movement = result.metrics.find(m => m.key === 'leftRange');
  assert.equal(result.analysis.movementFlag, false);
  assert.equal(movement.recentCount, 1);
  assert.equal(movement.comparable, false);
  assert.equal(result.statuses.radiation, 'unknown');
});

test('a sleep-only shift still counts the highlighted mind-and-rhythm area', () => {
  const sleepOnly = records.map(r => ({ ...r, reactionMs: 310, leftRange: 152 }));
  const result = lensSnapshot(sleepOnly, true, undefined, referencesFor(sleepOnly));
  assert.equal(result.analysis.attentionFlag, false);
  assert.equal(result.statuses.isolation, 'review');
  assert.equal(result.signals, 1);
});

test('personal lens never draws synthetic context into a record', () => {
  const result = lensSnapshot([...records, { ...records[0], id: 'real', simulated: false }], false);
  assert.equal(result.records.length, 1);
  assert.equal(result.signals, 0);
  assert.equal(result.analysis.baseline.reactionMs, null);
});

test('historical handoff includes only actions known at its cutoff and stays untransmitted', () => {
  const snapshot = lensSnapshot(records, true, 'demo-7');
  const actions = [
    { id: 'earlier', simulated: true, createdAt: records[6].date },
    { id: 'later', simulated: true, createdAt: records[12].date },
    { id: 'personal', simulated: false, createdAt: records[6].date },
  ];
  const packet = createMissionPacket({ snapshot, profile: { name: 'Test', mission: 'Ares I' }, actions, context: 'Historical review', oneWayMinutes: 14, blackoutDrill: true, id: 'packet-1', createdAt: '2026-11-20T00:00:00Z' });
  assert.deepEqual(packet.actions.map(a => a.id), ['earlier']);
  assert.equal(packet.observations.length, 8);
  assert.equal(packet.asOfDate, records[7].date);
  assert.equal(packet.actionCutoff, records[7].date);
  assert.equal(packet.communication.transmitted, false);
  assert.equal(packet.status, 'saved');
  assert.ok(packet.sources.some(source => new URL(source.url).hostname === 'www.nasa.gov'));
  assert.ok(packet.sources.some(source => new URL(source.url).hostname === 'www.asc-csa.gc.ca'));
  assert.ok(packet.sources.every(source => source.role && source.reviewedOn));
  assert.equal(packet.research.externalMeasurementsImported, false);
  assert.equal(packet.research.prototypeThresholdsValidated, false);
});

test('latest handoff includes decisions made after the latest observation', () => {
  const snapshot = lensSnapshot(records, true);
  const createdAt = '2026-11-20T00:00:00Z';
  const packet = createMissionPacket({ snapshot, profile: { name: 'Test', mission: 'Ares I' }, actions: [{ id: 'after-check-in', simulated: true, createdAt: '2026-11-19T00:00:00Z' }], context: 'Crew observation', oneWayMinutes: 14, blackoutDrill: false, id: 'packet-2', createdAt });
  assert.equal(packet.actions.length, 1);
  assert.equal(packet.actionCutoff, createdAt);
});

test('empty history has no handoff to fabricate', () => {
  const snapshot = lensSnapshot([], false);
  assert.equal(snapshot.latest, null);
  assert.equal(snapshot.statuses.gravity, 'unknown');
  assert.throws(() => createMissionPacket({ snapshot }), /at least one check-in/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze, median, shoulderAngle, summarizeReaction } from '../src/rules.mjs';

const check = (i, values = {}) => ({ id: String(i), date: new Date(2026, 10, i + 1).toISOString(), simulated: true, reactionMs: 300, leftRange: 150, rightRange: 150, sleep: 4, energy: 4, ...values });

test('median excludes absent and non-finite values without fabricating a score', () => {
  assert.equal(median([null, undefined, NaN, 300, 320, 400]), 320);
  assert.equal(median([300, 320]), 310);
  assert.equal(median([]), null);
  assert.deepEqual(summarizeReaction([], 4), { reactionMs: null, missed: 4, signals: 4 });
});
test('trend uses a distinct earlier baseline and last three entries', () => {
  const records = Array.from({ length: 14 }, (_, i) => check(i, i > 10 ? { reactionMs: 360, leftRange: 132, sleep: 2 } : {}));
  const result = analyze(records, true);
  assert.equal(result.baselineRecords.length, 11);
  assert.equal(result.attentionDelta, 20);
  assert.equal(result.movementDelta, -12);
  assert.ok(result.attentionFlag && result.movementFlag && result.wellbeingFlag);
});
test('simulated records never establish a personal baseline', () => {
  const records = [...Array.from({ length: 14 }, (_, i) => check(i)), check(15, { simulated: false, reactionMs: 500 })];
  const result = analyze(records, false);
  assert.equal(result.records.length, 1);
  assert.equal(result.baseline.reactionMs, null);
  assert.equal(result.enough, false);
  assert.equal(result.attentionFlag, false);
});
test('requires three baseline entries plus three recent entries to flag a change', () => {
  const records = Array.from({ length: 5 }, (_, i) => check(i, i >= 2 ? { reactionMs: 500 } : {}));
  assert.equal(analyze(records, true).attentionFlag, false);
});
test('equal baseline is not a high-score comparison', () => {
  const records = Array.from({ length: 10 }, (_, i) => check(i));
  const result = analyze(records, true);
  assert.equal(result.attentionFlag, false);
  assert.equal(result.movementFlag, false);
});
test('shoulder estimate uses geometry and rejects low-confidence observations', () => {
  const shoulder = { x: 0, y: 0, z: 0, visibility: 1 };
  assert.equal(shoulderAngle({ x: 0, y: 1, z: 0 }, shoulder, { x: 1, y: 0, z: 0 }), 90);
  assert.equal(shoulderAngle({ x: 0, y: 1, z: 0 }, shoulder, { x: 0, y: -1, z: 0 }), 180);
  assert.equal(shoulderAngle({ x: 0, y: 1, z: 0, visibility: .1 }, shoulder, { x: 1, y: 0, z: 0 }), null);
});
test('a partial check-in today keeps each metric on its own last three valid values', () => {
  const records = Array.from({ length: 14 }, (_, i) => check(i, i > 10 ? { reactionMs: 360 } : {}));
  records.push(check(14, { reactionMs: undefined, leftRange: undefined, rightRange: undefined, sleep: undefined, energy: undefined, vision: 1 }));
  const result = analyze(records, true);
  assert.equal(result.quality.reactionMs.recent, 3);
  assert.equal(result.attentionDelta, 20);
  assert.ok(result.attentionFlag);
});

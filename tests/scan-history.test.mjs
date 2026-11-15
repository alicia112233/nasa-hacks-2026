import test from 'node:test';
import assert from 'node:assert/strict';
import { addScan, deleteScan, linkedReading, scanHistory, scanId } from '../src/scan-history.mjs';

const scan = (id, date, mode = 'setup') => ({ id, mode, date, shoulders: 1, waist: 1, hips: 1, thighs: 0.5, arms: 0.3, thighOfHeight: 0.09, armAngle: 20, frames: 12 });
const reading = (date, thighCm, crewId = 'a', simulated = false) => ({ id: `c-${crewId}-${simulated}-${date}`, crewId, simulated, date, sol: 1, reactionMs: null, missed: 0, signals: 0, symptoms: [], notes: '', sleep: 4, thighCm, measurements: { sleep: { measuredAt: date }, thighCm: { measuredAt: date } } });

test('every scan is kept; a body scan shapes the figure and a leg outline does not', () => {
  const first = scan('1', '2026-11-01T09:00:00Z');
  let profile = { name: 'A', initials: 'A', mission: '', duration: 1, ...addScan({}, first) };
  assert.equal(profile.scan, first);
  const legs = scan('2', '2026-11-02T09:00:00Z', 'legs');
  profile = { ...profile, ...addScan(profile, legs) };
  assert.deepEqual(scanHistory(profile).map(scanId), ['1', '2']);
  assert.equal(profile.scan, first);
  // Profiles saved before history kept one scan: it becomes the first entry.
  const legacy = { scan: { ...first, id: undefined } };
  assert.deepEqual(scanHistory(legacy).map(scanId), [first.date]);
});

test('deleting the shaping scan falls back to the previous body scan, then to the standard figure', () => {
  const a = scan('1', '2026-11-01T09:00:00Z'), legs = scan('2', '2026-11-02T09:00:00Z', 'legs'), b = scan('3', '2026-11-03T09:00:00Z');
  const profile = { scans: [a, legs, b], scan: b };
  const once = deleteScan(profile, [], 'a', '3');
  assert.equal(once.profile.scan, a, 'a leg outline never takes over the figure');
  const twice = deleteScan({ ...profile, ...once.profile }, [], 'a', '1');
  assert.equal(twice.profile.scan, undefined);
  assert.deepEqual(twice.profile.scans.map(scanId), ['2']);
  // Deleting an older scan leaves the figure alone.
  assert.equal(deleteScan(profile, [], 'a', '1').profile.scan, b);
});

test('a scan takes its thigh reading with it only while that reading is still the linked one', () => {
  const a = scan('1', '2026-11-01T09:00:00Z');
  const linked = reading(a.date, 15.2), later = reading('2026-11-01T18:00:00Z', 15.4), demo = reading(a.date, 15.0, 'a', true), other = reading(a.date, 16.0, 'b');
  assert.equal(linkedReading([demo, other, linked], 'a', a), linked);
  const out = deleteScan({ scans: [a], scan: a }, [demo, other, linked], 'a', '1').checkIns;
  const stripped = out.find(c => c.id === linked.id);
  assert.equal(stripped.thighCm, undefined);
  assert.equal(stripped.measurements.thighCm, undefined);
  assert.equal(stripped.sleep, 4, 'other readings that day stay');
  assert.equal(out.find(c => c === demo), demo);
  assert.equal(out.find(c => c === other), other);
  // A later scan that day replaced the reading: deleting the earlier scan leaves the newer reading alone.
  assert.deepEqual(deleteScan({ scans: [a], scan: a }, [later], 'a', '1').checkIns, [later]);
});

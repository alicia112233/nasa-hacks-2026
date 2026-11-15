import test from 'node:test';
import assert from 'node:assert/strict';
import { careState, continuingCarePacket, createCareUpdate, validateCarePlan } from '../src/continuing-care.mjs';
import { createMissionPacket, lensSnapshot } from '../src/mission-lens.mjs';
import { createDemo } from '../src/data.ts';
import { removeCrew, scoped } from '../src/crew.ts';

const start = '2026-11-15T01:00:00.000Z', at = '2026-11-15T02:00:00.000Z';
const plan = () => ({ procedure: { status: 'followed', name: 'Onboard observation demo', version: '0.1' }, nextCheck: 'Repeat vision report', dueAt: '2026-11-15T04:00:00.000Z', missingInformation: ['Onset time unconfirmed'] });
const packet = () => ({ id: 'packet-a', crewId: 'crew-a', source: 'recorded', createdAt: start, context: 'Blurred vision reported', observations: [], communication: { transmitted: false }, carePlan: plan() });

test('handoff rejects empty/whitespace observations and retains an independent snapshot', () => {
  const mission = scoped(createDemo()), snapshot = lensSnapshot(mission.checkIns, true);
  const args = { snapshot, profile: mission.profile, actions: [], context: '  ', oneWayMinutes: 14, blackoutDrill: true, id: 'new', createdAt: at };
  assert.throws(() => createMissionPacket(args), /crew observation/);
  const p = createMissionPacket({ ...args, context: '  Crew observed fatigue  ' });
  assert.equal(p.status, 'saved'); assert.equal(p.context, 'Crew observed fatigue'); assert.equal(p.crewId, mission.crewId);
  const value = p.observations[0].sleep; mission.checkIns[0].sleep = 1;
  assert.equal(p.observations[0].sleep, value);
});

test('care plan requires a future check, explicit gaps and version when a procedure was followed', () => {
  assert.deepEqual(validateCarePlan(plan(), at), plan());
  assert.throws(() => validateCarePlan({ ...plan(), dueAt: start }, at), /future/);
  assert.throws(() => validateCarePlan({ ...plan(), missingInformation: [] }, at), /still missing/);
  assert.throws(() => validateCarePlan({ ...plan(), nextCheck: ' ' }, at), /Next check/);
  assert.throws(() => validateCarePlan({ ...plan(), procedure: { status: 'followed', name: 'x', version: '' } }, at), /version/);
  const noProcedure = { ...plan(), procedure: { status: 'none', name: '', version: '' } };
  assert.equal(validateCarePlan(noProcedure, at).procedure.status, 'none');
});

test('reassessment links only new measured values from the original crew/source and preserves prior facts', () => {
  const original = packet(), before = structuredClone(original);
  const checks = [
    { id: 'daily', crewId: 'crew-a', simulated: false, date: '2026-11-14T00:00:00.000Z', vision: 0, heartRate: 65, measurements: { vision: { measuredAt: '2026-11-15T01:30:00.000Z' }, heartRate: { measuredAt: '2026-11-15T00:00:00.000Z' } } },
    { id: 'other', crewId: 'crew-b', simulated: false, date: at, vision: 2 },
    { id: 'demo', crewId: 'crew-a', simulated: true, date: at, vision: 2 },
    { id: 'future', crewId: 'crew-a', simulated: false, date: '2026-11-16T00:00:00Z', vision: 2 },
  ];
  const u = createCareUpdate({ id: 'update', packet: original, updates: [], observation: 'No blur on the repeat report', change: 'improved', plan: plan(), checkIns: checks, now: at });
  assert.equal(u.packetId, original.id); assert.equal(u.measurements.length, 1); assert.equal(u.measurements[0].field, 'vision');
  assert.equal(u.measurements[0].value, 0); assert.deepEqual(original, before);
  checks[0].measurements.vision.measuredAt = 'later';
  assert.equal(u.measurements[0].conditions.measuredAt, '2026-11-15T01:30:00.000Z');
  assert.throws(() => createCareUpdate({ id: 'bad', packet: original, observation: ' ', change: 'unclear', plan: plan(), checkIns: [], now: at }), /observation/);
});

test('latest plan drives due state and downloads carry the original packet with all reassessments, never a receipt', () => {
  const p = packet();
  const u = createCareUpdate({ id: 'update', packet: p, updates: [], observation: 'Unchanged', change: 'unchanged', plan: { ...plan(), nextCheck: 'Recheck after procedure' }, checkIns: [], now: at });
  const unrelated = { ...u, id: 'foreign', crewId: 'crew-b' };
  assert.equal(careState(p, [u, unrelated], '2026-11-15T05:00:00Z').due, true);
  assert.equal(careState(p, [u], at).plan.nextCheck, 'Recheck after procedure');
  const exportPacket = continuingCarePacket(p, [u, unrelated]);
  assert.equal(exportPacket.continuingCare.updates.length, 1);
  assert.equal(exportPacket.continuingCare.groundResponse, null);
  assert.deepEqual(exportPacket.delivery, { downloaded: true, transmittedByGhostPilot: false, receiptConfirmed: false });
  exportPacket.context = 'Changed copy'; assert.notEqual(p.context, exportPacket.context);
  assert.throws(() => createCareUpdate({ id: 'backdated', packet: p, updates: [u], observation: 'x', change: 'unclear', plan: plan(), checkIns: [], now: start }), /timestamp/);
});

test('crew scoping and deletion keep continuing-care events with their owner', () => {
  const s = createDemo(); s.careUpdates = s.crew.map((c, i) => ({ id: String(i), crewId: c.id, source: 'simulated' }));
  assert.equal(scoped(s).careUpdates.length, 1);
  const next = removeCrew(s, s.crewId); assert.equal(next.careUpdates.length, 1); assert.notEqual(next.careUpdates[0].crewId, s.crewId);
});

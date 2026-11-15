import test from 'node:test';
import assert from 'node:assert/strict';
import { addCrew, normalise, removeCrew, scoped, switchCrew, withProfile } from '../src/crew.ts';
import { analyze } from '../src/rules.mjs';
import { createDemo, DEMO_CREW } from '../src/data.ts';

test('a save from before the roster becomes a crew of one, with every record theirs', () => {
  const legacy = { demo: false, profile: { name: 'Private Crew', initials: 'PC', mission: 'Ares I', duration: 180 }, actions: [{ id: 'a' }], packets: [{ id: 'p' }],
    checkIns: [{ id: 'c', date: '2026-01-01T00:00:00Z', sol: 1, simulated: false, reactionMs: null, missed: 0, signals: 0, symptoms: [], notes: '' }] };
  const s = normalise(legacy);
  assert.equal(s.crew.length, 1);
  assert.equal(s.crewId, s.crew[0].id);
  assert.equal(s.profile.name, 'Private Crew');
  assert.ok([...s.checkIns, ...s.actions, ...s.packets].every(r => r.crewId === s.crewId));
});

test('the stored profile is the truth for the selected member', () => {
  const demo = createDemo();
  const s = normalise({ ...demo, profile: { ...demo.profile, name: 'Renamed' } });
  assert.equal(s.crew.find(c => c.id === DEMO_CREW.alex).name, 'Renamed');
  assert.equal(s.crew.find(c => c.id === DEMO_CREW.jordan).name, 'Jordan Lee');
});

test('each crew member sees only their own records and ghost', () => {
  const demo = normalise(createDemo());
  const alexView = scoped(demo), jordanView = scoped(switchCrew(demo, DEMO_CREW.jordan));
  const alex = analyze(alexView.checkIns, false, alexView.references);
  const jordan = analyze(jordanView.checkIns, false, jordanView.references);
  assert.equal(alex.attentionFlag, true);
  assert.equal(alex.legFlag, false);
  assert.equal(jordan.attentionFlag, false);
  assert.equal(jordan.legFlag, true);
  assert.equal(jordan.legDelta, -6);
});

test('add, rename, switch and remove keep profile and roster in step', () => {
  let s = addCrew(normalise(createDemo()), 1);
  assert.equal(s.crew.length, 5);
  assert.equal(s.profile.id, s.crewId);
  s = withProfile(s, { name: 'Priya Nair', heightCm: 165 });
  assert.equal(s.profile.initials, 'PN');
  assert.equal(s.crew.find(c => c.id === s.crewId).heightCm, 165);
  s = { ...s, checkIns: [...s.checkIns, { id: 'mine', crewId: s.crewId, date: '2026-01-02T00:00:00Z', sol: 1, simulated: false, reactionMs: null, missed: 0, signals: 0, symptoms: [], notes: '' }] };
  const added = s.crewId;
  s = removeCrew(s, added);
  assert.equal(s.crew.length, 4);
  assert.ok(!s.checkIns.some(c => c.crewId === added));
  assert.equal(s.profile.id, s.crew[0].id);
  assert.equal(removeCrew({ ...s, crew: [s.profile] }, s.crewId).crew.length, 1);
});

test('the sample crew is one stream of records, and every measure of every member compares with a ghost', () => {
  const demo = normalise(createDemo());
  assert.equal(demo.crew.length, 4);
  assert.ok(demo.checkIns.every(c => c.simulated === false));
  for (const member of demo.crew) {
    const view = scoped(switchCrew(demo, member.id));
    const a = analyze(view.checkIns, false, view.references);
    for (const [key, c] of Object.entries(a.comparisons)) assert.equal(c.comparable, true, `${member.name} ${key}: ${c.reason}`);
  }
  // A device saved before the merge converts its demo records into the same stream.
  const old = { ...createDemo(), demo: true, checkIns: createDemo().checkIns.map(c => ({ ...c, simulated: true })) };
  assert.ok(normalise(old).checkIns.every(c => c.simulated === false));
});

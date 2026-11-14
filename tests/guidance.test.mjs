import test from 'node:test';
import assert from 'node:assert/strict';
import { checks } from '../src/body.mjs';
import { HOW, WHY, LEVELS, nextSteps, resultLine } from '../src/guidance.mjs';

const check = id => checks.find(c => c.id === id);
const item = (id, extra) => ({ check: check(id), flagged: false, reported: false, last: null, ...extra });

test('every self-check says how to take it and why it matters, in one short line each', () => {
  for (const c of checks.filter(c => c.field)) {
    assert.ok(HOW[c.id], `${c.id} has no how`);
    assert.ok(WHY[c.id], `${c.id} has no why`);
    for (const line of [HOW[c.id], WHY[c.id]]) assert.ok(line.split(/\s+/).length <= 14, `${c.id}: "${line}" is long`);
  }
});

test('every trend and every symptom has next steps, and strong symptoms escalate', () => {
  for (const id of ['attention', 'sleep', 'shoulder', 'legs']) assert.ok(nextSteps([item(id, { flagged: true })]), id);
  for (const c of checks.filter(c => c.kind === 'symptom')) {
    const mild = nextSteps([item(c.id, { reported: true, last: 1 })]);
    const strong = nextSteps([item(c.id, { reported: true, last: 2 })]);
    assert.ok(mild && strong, c.id);
    assert.ok(Object.keys(LEVELS).indexOf(strong.level) >= Object.keys(LEVELS).indexOf(mild.level), `${c.id} strong is not more urgent`);
  }
  assert.equal(nextSteps([item('breath', { reported: true, last: 2 })]).level, 'now');
  assert.equal(nextSteps([item('joint', { reported: true, last: 1 })]).level, 'tell');
  assert.equal(nextSteps([item('vision', { reported: true, last: 1 })]).level, 'tell');
  assert.equal(nextSteps([item('mood')]), null);
});

test('the most urgent reading leads, steps merge, and at most three show', () => {
  const plan = nextSteps([item('attention', { flagged: true }), item('sleep', { flagged: true }), item('joint', { reported: true, last: 2 })]);
  assert.equal(plan.level, 'now');
  assert.match(plan.steps[0].text, /flight surgeon now/);
  assert.ok(plan.steps.length <= 3);
  assert.equal(new Set(plan.steps.map(s => s.text)).size, plan.steps.length);
  assert.ok(plan.steps.every(s => s.checkId));
});

test('a saved result reads against the ghost, and a clearly off value says what to do', () => {
  assert.equal(resultLine(check('heartRate'), 64, 62).text, 'Today 64 bpm · ghost 62 bpm');
  assert.equal(resultLine(check('heartRate'), 64, 62).level, 'ok');
  assert.match(resultLine(check('heartRate'), 108, 62).text, /high at rest: rest 5 min, recheck/);
  assert.equal(resultLine(check('heartRate'), 108, 62).level, 'watch');
  assert.equal(resultLine(check('legs'), 15.46, 15.8).text, 'Today 15.5 cm · ghost 15.8 cm');
  assert.equal(resultLine(check('breath'), 2, null).text, 'Today strong');
  assert.equal(resultLine(check('breath'), 2, null).level, 'watch');
  assert.equal(resultLine(check('sleep'), 4, 4).level, 'ok');
});

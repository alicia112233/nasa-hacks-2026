import test from 'node:test';
import assert from 'node:assert/strict';
import { SIZES, chart, describe, eyeDone, visionValue } from '../src/vision.mjs';

test('the chart has six lines of five letters, smaller each line, no letter twice in a row', () => {
  const lines = chart();
  assert.equal(lines.length, 6);
  assert.ok(lines.every(l => l.length === 5 && [...l].every((c, i) => i === 0 || c !== l[i - 1])));
  assert.ok(SIZES.every((s, i) => i === 0 || s < SIZES[i - 1]));
});

test('the worse eye decides: clear to the end is none, small-line blur is mild, early blur or blindness is strong', () => {
  const clear = Array(6).fill('clear');
  assert.equal(visionValue(clear, clear), 0);
  assert.equal(visionValue(clear, ['clear', 'clear', 'clear', 'clear', 'blurry']), 1);
  assert.equal(visionValue(clear, ['clear', 'clear', 'clear', 'blurry']), 1);
  assert.equal(visionValue(clear, ['clear', 'clear', 'clear', 'none']), 2);
  assert.equal(visionValue(['clear', 'blurry'], clear), 2);
  assert.equal(describe(['clear', 'clear', 'none']), "can't see from line 3");
  assert.equal(describe(clear), 'clear to line 6');
  // An eye stops at the line it can't see, or after the last line.
  assert.equal(eyeDone(['clear', 'none']), true);
  assert.equal(eyeDone(['clear', 'blurry']), false);
  assert.equal(eyeDone(clear), true);
});

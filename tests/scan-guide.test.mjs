import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { scanGuidance } from '../src/scan-guide.mjs';

test('scan guidance follows camera positioning and never announces completion from the timer alone', () => {
  for (const [issue, cue] of [['Step back', 'step-back'], ['Stand straight', 'stand-straight'], ['Arms out a little', 'arms-out'], ['Arms lower', 'arms-lower']]) {
    const guide = scanGuidance({ status: 'scanning', issue, remaining: 2 });
    assert.equal(guide.id, cue);
    assert.equal(guide.count, undefined);
    assert.equal(guide.repeat, true);
  }
  assert.equal(scanGuidance({ status: 'ready' }).id, 'ready');
  assert.equal(scanGuidance({ status: 'scanning', remaining: 5 }).id, 'scanning');
  assert.equal(scanGuidance({ status: 'scanning', remaining: 2.4 }).id, 'three');
  assert.equal(scanGuidance({ status: 'scanning', remaining: 1.4 }).id, 'two');
  assert.equal(scanGuidance({ status: 'scanning', remaining: 0.4 }).id, 'one');
  assert.equal(scanGuidance({ status: 'scanning', remaining: 0 }).id, 'more-frames');
  assert.equal(scanGuidance({ status: 'done', remaining: 0 }).id, 'complete');
});

test('height, denied camera access and unusable captures get an actionable cue', () => {
  assert.equal(scanGuidance({ status: 'intro', needsHeight: true }).id, 'height');
  assert.equal(scanGuidance({ status: 'intro', error: true }).id, 'camera-error');
  assert.equal(scanGuidance({ status: 'loading' }).id, 'prepare');
  assert.equal(scanGuidance({ status: 'ready', error: true }).id, 'retry');
});

test('every spoken instruction is bundled as nonempty audible PCM rather than depending on a speech service', async () => {
  const prompts = JSON.parse(await readFile(new URL('../scripts/scan-prompts.json', import.meta.url), 'utf8'));
  assert.equal(Object.keys(prompts).length, 15);
  for (const [id, text] of Object.entries(prompts)) {
    assert.ok(text.length > 3, id);
    const wav = await readFile(new URL(`../public/audio/scan/${id}.wav`, import.meta.url));
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF', id);
    assert.equal(wav.toString('ascii', 8, 12), 'WAVE', id);
    const fmt = wav.indexOf('fmt '), data = wav.indexOf('data');
    assert.ok(fmt >= 12 && data > fmt, id);
    assert.equal(wav.readUInt16LE(fmt + 8), 1, `${id}: PCM`);
    assert.equal(wav.readUInt16LE(fmt + 10), 1, `${id}: mono`);
    assert.equal(wav.readUInt32LE(fmt + 12), 22050, `${id}: sample rate`);
    assert.equal(wav.readUInt16LE(fmt + 22), 16, `${id}: bit depth`);
    const bytes = wav.readUInt32LE(data + 4);
    assert.ok(bytes > 22050 / 2 && bytes <= wav.length - data - 8, `${id}: audible duration`);
    let energy = 0;
    for (let i = data + 8; i < data + 8 + bytes; i += 2) energy += Math.abs(wav.readInt16LE(i));
    assert.ok(energy / (bytes / 2) > 10, `${id}: not silent`);
  }
});

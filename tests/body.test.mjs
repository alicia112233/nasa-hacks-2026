import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { checks, coverage, hazards, regionForMesh, regionStatuses, regions, risks } from '../src/body.mjs';
import { documented, referencesFor } from './fixtures/references.mjs';

test('all 17 NASA HRP risks are reachable from a body region check', () => {
  assert.equal(risks.length, 17);
  for (const r of coverage()) {
    assert.ok(r.checks.length > 0, `${r.id} has no check`);
    assert.match(r.url, /^https:\/\/www\.nasa\.gov\/reference\/risk-/);
  }
});

test('every check belongs to a region, cites known risks, and writes a field unless it needs an instrument or data', () => {
  const regionIds = new Set(regions.map(r => r.id));
  for (const c of checks) {
    assert.ok(regionIds.has(c.region), c.id);
    assert.ok(c.risks.length && c.risks.every(id => risks.some(r => r.id === id)), c.id);
    if (c.kind === 'instrument' || c.kind === 'data') assert.equal(c.field, undefined, c.id);
    else assert.ok(c.field && c.seconds > 0, c.id);
  }
  assert.equal(new Set(checks.map(c => c.id)).size, checks.length);
});

test('regions carry every hazard and map to the meshes exported by Blender', async () => {
  assert.deepEqual(new Set(regions.flatMap(r => r.hazards)), new Set(hazards.map(h => h.id)));
  const glb = await readFile(new URL('../public/models/body.glb', import.meta.url));
  const length = glb.readUInt32LE(12);
  const json = JSON.parse(glb.subarray(20, 20 + length).toString('utf8'));
  const names = json.nodes.map(n => n.name);
  for (const r of regions) for (const m of r.meshes) assert.ok(names.includes(m), `${m} missing from body.glb`);
  for (const name of names) assert.ok(regionForMesh(name), `${name} has no region`);
});

test('region status separates flags, reported symptoms, completed and unmeasured regions', () => {
  const day = (i, extra = {}) => ({ id: `s${i}`, date: new Date(Date.UTC(2026, 0, 1 + i, 2)).toISOString(), sol: i, simulated: true, reactionMs: 300, missed: 0, signals: 10, sleep: 4, mood: 4, energy: 4, symptoms: [], notes: '', leftRange: 150, ...extra });
  const history = [0, 1, 2, 3, 4, 5].map(i => day(i));
  history.push(day(6, { reactionMs: 380, vision: 1, heartRate: 66, breath: 0, joint: 0 }), day(7, { reactionMs: 390 }), day(8, { reactionMs: 400, vision: 1 }));
  const recorded = documented(history);
  const status = regionStatuses(recorded, true, history.at(-1).date, referencesFor(recorded, 6));
  assert.equal(status.head.state, 'flag');
  assert.equal(status.eyes.state, 'reported');
  assert.equal(status.cabin.state, 'instrument');
  assert.equal(status.abdomen.state, 'none');
  assert.equal(status.chest.state, 'due');
  assert.equal(regionStatuses(history, false).head.state, 'none');
});

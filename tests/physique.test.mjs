import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { MORPHS, STATURE, physique, zeroGForSol } from '../src/physique.mjs';

const glbJson = async () => {
  const glb = await readFile(new URL('../public/models/body.glb', import.meta.url));
  return JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8'));
};

test('every body mesh carries the profile morphs, at zero by default, matching the build metadata', async () => {
  const meta = JSON.parse(await readFile(new URL('../public/models/body.json', import.meta.url), 'utf8'));
  assert.deepEqual(meta.morphs, MORPHS);
  assert.deepEqual(meta.stature, STATURE);
  assert.match(meta.source.posture, /Figure 4\.3-2/);
  const json = await glbJson();
  const bodyMeshes = json.meshes.filter(m => m.name !== 'region_cabin');
  assert.equal(bodyMeshes.length, 11);
  for (const mesh of bodyMeshes) {
    assert.deepEqual(mesh.extras?.targetNames, MORPHS, mesh.name);
    assert.ok((mesh.weights ?? []).every(w => w === 0), `${mesh.name} has non-zero default morph weights`);
  }
});

test('profile shapes the body: sex, stature, BMI and build', () => {
  const reference = physique({});
  assert.equal(reference.scale, 1);
  assert.ok(Object.values(reference.weights).every(w => w === 0));

  const tall = physique({ sex: 'male', heightCm: 188, massKg: 95, build: 'average' });
  assert.ok(Math.abs(tall.scale - 1.88 / STATURE.male) < 1e-9);
  assert.equal(tall.bmi, 26.9);
  assert.ok(tall.weights.heavy > 0.4 && tall.weights.heavy < 0.5);
  assert.equal(tall.weights.light, 0);
  assert.equal(tall.weights.female_heavy, 0);

  const crew = physique({ sex: 'female', heightCm: 168, massKg: 62, build: 'muscular' });
  assert.equal(crew.weights.female, 1);
  assert.ok(Math.abs(crew.scale - 1.68 / STATURE.female) < 1e-9);
  assert.equal(crew.weights.muscular, 0.7);
  assert.equal(crew.weights.female_muscular, 0.7);
  assert.ok(crew.weights.heavy < 0.1 && crew.weights.light < 0.1);
});

test('implausible measurements are ignored instead of distorting the body', () => {
  const odd = physique({ heightCm: 20, massKg: 900 });
  assert.equal(odd.scale, 1);
  assert.equal(odd.bmi, null);
  assert.equal(physique({ heightCm: 170 }).bmi, null);
});

test('zero-g adaptation follows HIDH timing: none preflight, full after the first days', () => {
  assert.equal(zeroGForSol(1), 0);
  assert.equal(zeroGForSol(2), 0.5);
  assert.equal(zeroGForSol(42), 1);
  const w = physique({}, zeroGForSol(42)).weights;
  assert.equal(w.spine_0g, 1);
  assert.equal(w.fluid_0g, 1);
  assert.equal(physique({}, 0).weights.spine_0g, 0);
  const crew = { sex: 'female', heightCm: 168 };
  assert.equal(physique(crew, 0).statureCm, 168);
  assert.equal(physique(crew, 1).statureCm, 173);
  assert.ok(Math.abs(physique(crew, 1).weights.spine_0g - STATURE.female / STATURE.male) < 1e-9);
});

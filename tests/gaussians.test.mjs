import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';

test('bundled 4DGS parameters have intact provenance, valid anisotropic geometry and learned temporal changes', async () => {
  const root = new URL('../public/4dgs/mutant/', import.meta.url);
  const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'));
  const compressed = await readFile(new URL(manifest.data, root));
  assert.equal(manifest.count, 120007);
  assert.equal(manifest.checkpointIteration, 30000);
  assert.equal(manifest.checkpointSha256, 'b001bba170b9e0c3ef545eabab68227668edfabbedcab58336b6370c7d9a562c');
  assert.equal(compressed.length, manifest.dataBytes);
  assert.equal(createHash('sha256').update(compressed).digest('hex'), manifest.dataSha256);
  const bytes = gunzipSync(compressed);
  assert.equal(bytes.byteLength, manifest.count * 80);
  let moving = 0;
  let appearing = 0;
  let anisotropic = 0;
  for (let index = 0; index < manifest.count; index++) {
    const offset = index * 80;
    const p = Array.from({ length: 20 }, (_, column) => bytes.readFloatLE(offset + column * 4));
    assert.ok(p.every(Number.isFinite));
    assert.ok(p[3] >= 0 && p[3] <= 1);
    assert.ok(p[4] > 0 && p[5] > 0 && p[6] > 0 && p[15] > 0);
    assert.ok(Math.abs(Math.hypot(...p.slice(8, 12)) - 1) < 1e-5);
    const temporalOpacity = phase => p[3] * Math.exp(-((phase - p[7]) ** 2) * p[15]);
    if (Math.hypot(...p.slice(12, 15)) > 0.01 && Math.max(temporalOpacity(0.1), temporalOpacity(0.8)) > 0.1) moving++;
    if (Math.abs(temporalOpacity(0.1) - temporalOpacity(0.8)) > 0.1) appearing++;
    if (Math.max(...p.slice(4, 7)) / Math.min(...p.slice(4, 7)) > 2) anisotropic++;
  }
  assert.ok(moving > 1000, 'learned positions must vary with time');
  assert.ok(appearing > 1000, 'learned temporal visibility must vary');
  assert.ok(anisotropic > 1000, 'model must retain anisotropic covariance');
});

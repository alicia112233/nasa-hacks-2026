import * as THREE from 'three';
import { dyno, SplatGenerator } from '@sparkjsdev/spark';

export interface GaussianAsset {
  title: string;
  description: string;
  method: string;
  methodUrl: string;
  sourceUrl: string;
  checkpointIteration: number;
  declaredCheckpointLicense: string;
  provenanceNote: string;
  displayNote: string;
  count: number;
  data: string;
  dataBytes: number;
  dataSha256: string;
  timeRange: [number, number];
  cycleSeconds: number;
  center: [number, number, number];
  radius: number;
}

export const ASSET_URL = '/4dgs/mutant/manifest.json';

export async function loadGaussianAsset(signal: AbortSignal) {
  const response = await fetch(ASSET_URL, { signal });
  if (!response.ok) throw new Error('The trained model manifest is unavailable.');
  const asset = await response.json() as GaussianAsset & { version: number; format: string };
  if (asset.version !== 1 || asset.format !== 'native-4dgs-conditioned-f32-v1'
    || !Number.isInteger(asset.count) || asset.count < 1 || asset.count > 500_000
    || !Array.isArray(asset.timeRange) || asset.timeRange.length !== 2
    || !asset.timeRange.every(Number.isFinite) || asset.timeRange[1] <= asset.timeRange[0]
    || !Array.isArray(asset.center) || asset.center.length !== 3 || !asset.center.every(Number.isFinite)
    || !Number.isFinite(asset.radius) || asset.radius <= 0
    || !Number.isFinite(asset.cycleSeconds) || asset.cycleSeconds <= 0
    || !Number.isSafeInteger(asset.dataBytes) || asset.dataBytes < 1 || asset.dataBytes > 50_000_000
    || typeof asset.data !== 'string' || !/^[a-zA-Z0-9_.-]+\.bin$/.test(asset.data)
    || !/^[a-f0-9]{64}$/.test(asset.dataSha256)) {
    throw new Error('The trained model manifest has an unsupported format.');
  }
  const dataResponse = await fetch(new URL(asset.data, new URL(ASSET_URL, location.href)), { signal });
  if (!dataResponse.ok) throw new Error('The trained Gaussian model could not be loaded.');
  const compressed = await dataResponse.arrayBuffer();
  if (compressed.byteLength !== asset.dataBytes) throw new Error('The trained model download is incomplete.');
  const hash = await crypto.subtle.digest('SHA-256', compressed);
  const hex = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
  if (hex !== asset.dataSha256) throw new Error('The trained model integrity check failed.');
  const decompressed = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
  const buffer = await new Response(decompressed).arrayBuffer();
  if (buffer.byteLength !== asset.count * 80) throw new Error('The trained model data has an unexpected size.');
  const parameters = new Float32Array(buffer);
  for (let offset = 0; offset < parameters.length; offset += 20) {
    const point = parameters.subarray(offset, offset + 20);
    if (!point.every(Number.isFinite) || point[3] < 0 || point[3] > 1
      || point[4] <= 0 || point[5] <= 0 || point[6] <= 0 || point[15] <= 0
      || Math.abs(Math.hypot(point[8], point[9], point[10], point[11]) - 1) > 0.001
      || point[16] < 0 || point[16] > 1 || point[17] < 0 || point[17] > 1 || point[18] < 0 || point[18] > 1) {
      throw new Error('The trained model contains invalid Gaussian parameters.');
    }
  }
  if (signal.aborted) throw new DOMException('Model loading cancelled.', 'AbortError');
  return { asset, parameters };
}

/** Condition the learned native 4D Gaussian distribution at a chosen time.
 * No hand-authored animation or skeleton is applied to this model.
 */
export function createNativeGaussians(asset: GaussianAsset, parameters: Float32Array) {
  const width = 1024;
  const height = Math.ceil(asset.count * 5 / width);
  const pixels = new Float32Array(width * height * 4);
  pixels.set(parameters);
  const texture = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat, THREE.FloatType);
  texture.needsUpdate = true;
  const phase = dyno.dynoFloat(0.25);
  const data = dyno.dynoSampler2D(texture);
  const generator = new dyno.Dyno({
    inTypes: { index: 'int', data: 'sampler2D', phase: 'float' },
    outTypes: { gsplat: dyno.Gsplat },
    inputs: { data, phase },
    globals: () => [dyno.defineGsplat],
    statements: ({ inputs, outputs }) => [`
      int pointOffset = ${inputs.index} * 5;
      vec4 base = texelFetch(${inputs.data}, ivec2(pointOffset % 1024, pointOffset / 1024), 0);
      vec4 scaleTime = texelFetch(${inputs.data}, ivec2((pointOffset + 1) % 1024, (pointOffset + 1) / 1024), 0);
      vec4 rotation = texelFetch(${inputs.data}, ivec2((pointOffset + 2) % 1024, (pointOffset + 2) / 1024), 0);
      vec4 velocity = texelFetch(${inputs.data}, ivec2((pointOffset + 3) % 1024, (pointOffset + 3) / 1024), 0);
      vec3 rgb = texelFetch(${inputs.data}, ivec2((pointOffset + 4) % 1024, (pointOffset + 4) / 1024), 0).rgb;
      float dt = ${inputs.phase} - scaleTime.w;
      float opacity = base.w * exp(-dt * dt * velocity.w);
      ${outputs.gsplat}.center = base.xyz + velocity.xyz * dt;
      ${outputs.gsplat}.scales = scaleTime.xyz;
      ${outputs.gsplat}.quaternion = rotation;
      ${outputs.gsplat}.rgba = vec4(rgb, opacity);
      ${outputs.gsplat}.index = ${inputs.index};
      ${outputs.gsplat}.flags = opacity >= (1.0 / 255.0) ? GSPLAT_FLAG_ACTIVE : 0u;
    `],
  });
  const splats = new SplatGenerator({ numSplats: asset.count, generator });
  return { splats, phase, dispose: () => texture.dispose() };
}

"""Export a native Yang et al. 4DGS capture for GhostPilot's WebGL player.

Needs Python, numpy, scipy and torch (CPU is sufficient). No training or CUDA
extension is needed. This reads tensor checkpoints with weights_only=True.
The 4D covariance conditioning follows the official representation:
https://github.com/LogosIntelligenceLab/4d-gaussian-splatting
"""

import argparse
import gzip
import hashlib
import json
from pathlib import Path

import numpy as np
import torch
from scipy.spatial.transform import Rotation


def condition_gaussians(log_scales, left, right):
    """Return spatial covariance, temporal variance and conditional velocity."""
    left = left / np.linalg.norm(left, axis=1, keepdims=True)
    right = right / np.linalg.norm(right, axis=1, keepdims=True)
    a, b, c, d = left.T
    p, q, r, s = right.T
    # Left and right quaternion multiplication, with the time axis last.
    ml = np.stack([a, -b, -c, -d, b, a, -d, c,
                   c, d, a, -b, d, -c, b, a], axis=-1).reshape(-1, 4, 4)
    mr = np.stack([p, q, r, s, -q, p, -s, r,
                   -r, s, p, -q, -s, -r, q, p], axis=-1).reshape(-1, 4, 4)
    rotation = (ml @ mr)[:, ::-1, ::-1]
    factor = rotation * np.exp(log_scales)[:, None, :]
    covariance = factor @ factor.transpose(0, 2, 1)
    temporal_variance = covariance[:, 3, 3].clip(1e-12)
    cross = covariance[:, :3, 3]
    velocity = cross / temporal_variance[:, None]
    spatial = covariance[:, :3, :3] - cross[:, :, None] * velocity[:, None, :]
    return spatial, temporal_variance, velocity


def export(checkpoint, output):
    digest = hashlib.sha256(checkpoint.read_bytes()).hexdigest()
    if digest != 'b001bba170b9e0c3ef545eabab68227668edfabbedcab58336b6370c7d9a562c':
        raise ValueError('This exporter is pinned to the documented Mutant 30,000 checkpoint. Review metadata and representation before adapting it to another model.')
    # Only the known numpy scalar types needed by optimizer metadata are allowed.
    with torch.serialization.safe_globals([
        np.core.multiarray.scalar, np.dtype,
        type(np.dtype('float64')), type(np.dtype('float32')),
    ]):
        capture, iteration = torch.load(checkpoint, map_location='cpu', weights_only=True)
    if len(capture) != 19 or capture[16] is not True:
        raise ValueError('Expected the 19-field native rotated 4DGS capture format.')

    def array(index):
        value = capture[index].detach().numpy().astype(np.float64)
        if not np.isfinite(value).all():
            raise ValueError(f'Non-finite checkpoint tensor {index}.')
        return value

    xyz, dc, log_scale, left, opacity, time, log_scale_t, right = (
        array(i) for i in (1, 2, 4, 5, 6, 13, 14, 15)
    )
    count = len(xyz)
    if xyz.shape != (count, 3) or not 0 < count <= 2_000_000:
        raise ValueError('Invalid Gaussian count or position shape.')
    spatial, variance, velocity = condition_gaussians(
        np.concatenate([log_scale, log_scale_t], axis=1), left, right,
    )
    # Blender/D-NeRF Z-up -> Three.js Y-up, consistently for means and covariance.
    orientation = np.array([[1, 0, 0], [0, 0, 1], [0, -1, 0]], dtype=float)
    xyz = xyz @ orientation.T
    velocity = velocity @ orientation.T
    spatial = orientation[None] @ spatial @ orientation.T[None]
    eigenvalues, eigenvectors = np.linalg.eigh(spatial)
    eigenvectors[:, :, 2] *= np.linalg.det(eigenvectors)[:, None]
    scales = np.sqrt(eigenvalues.clip(1e-14))
    quaternion = Rotation.from_matrix(eigenvectors).as_quat()  # xyzw
    alpha = 1 / (1 + np.exp(-opacity[:, 0]))
    rgb = np.clip(0.5 + 0.28209479177387814 * dc[:, 0, :], 0, 1)

    # Five RGBA32F texels per Gaussian. No point subsampling or synthetic motion.
    data = np.zeros((count, 5, 4), dtype='<f4')
    data[:, 0, :3], data[:, 0, 3] = xyz, alpha
    data[:, 1, :3], data[:, 1, 3] = scales, time[:, 0]
    data[:, 2] = quaternion
    data[:, 3, :3], data[:, 3, 3] = velocity, 0.5 / variance
    data[:, 4, :3] = rgb
    model = gzip.compress(data.tobytes(), compresslevel=9, mtime=0)

    # Fixed framing across time, robust to near-invisible background Gaussians.
    visible_positions = []
    for phase in np.linspace(0, 1, 21):
        dt = phase - time[:, 0]
        visible = alpha * np.exp(-0.5 * dt**2 / variance) > 0.1
        visible_positions.append((xyz + velocity * dt[:, None])[visible])
    positions = np.concatenate(visible_positions)
    lower, upper = np.quantile(positions, [0.005, 0.995], axis=0)
    center = (lower + upper) / 2
    manifest = {
        'version': 1,
        'format': 'native-4dgs-conditioned-f32-v1',
        'title': 'D-NeRF · Mutant',
        'description': 'A trained synthetic humanoid research example.',
        'method': 'Native 4D Gaussian Splatting (Yang et al.)',
        'methodUrl': 'https://github.com/LogosIntelligenceLab/4d-gaussian-splatting',
        'sourceUrl': 'https://huggingface.co/youngbongbong/4dgs/tree/5e71153953624e09e7d2ff4ea1e839fc3ca75716',
        'checkpoint': checkpoint.name,
        'checkpointSha256': digest,
        'checkpointIteration': int(iteration),
        'declaredCheckpointLicense': 'Apache-2.0',
        'provenanceNote': 'Community checkpoint. Original training inputs and training run were not independently verified.',
        'displayNote': 'Continuous conditional means, anisotropic covariances and temporal opacity. DC color only; higher-order view-dependent color is omitted.',
        'count': count,
        'floatsPerGaussian': 20,
        'data': 'model.bin',
        'dataBytes': len(model),
        'dataSha256': hashlib.sha256(model).hexdigest(),
        'timeRange': [0, 1],
        'cycleSeconds': 8,
        'center': center.tolist(),
        'radius': float(np.linalg.norm(upper - lower) / 2),
    }
    output.mkdir(parents=True, exist_ok=True)
    (output / 'model.bin').write_bytes(model)
    (output / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'count': count, 'compressedMB': round(len(model) / 1e6, 2),
                      'iteration': int(iteration), 'center': center.tolist(),
                      'lower': lower.tolist(), 'upper': upper.tolist(),
                      'sha256': digest}, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--checkpoint', type=Path, default=Path('.4dgs-cache/4dgs_mutant_iter30000.pth'))
    parser.add_argument('--output', type=Path, default=Path('public/4dgs/mutant'))
    args = parser.parse_args()
    export(args.checkpoint, args.output)

# Genuine 4DGS integration

The demo defaults to a labelled synthetic pose comparison. The trained
native-4D Gaussian example is available only inside **Technical demo · public
4DGS model**. Personal movement evidence starts with the crew's original video
and an explicitly linked reference recording when available; estimated pose
replay is secondary. Health measurements, trend flags and exported crew records
do not read from the public Gaussian model, which supplies no evidence about
that crew member.

## Representation and provenance

The community checkpoint is pinned in [the asset source notes](../public/4dgs/mutant/SOURCE.md).
It has the 19-field capture layout of Yang et al.'s native 4DGS, including two
quaternions, learned time centers and time scales, and rotated 4D covariance.
It is not a Wu et al. HexPlane/deformation-network checkpoint. It was downloaded
as a tensor archive, inspected for its serialized globals, and loaded with
`weights_only=True` plus only the numpy scalar/dtype metadata types needed by
the capture. No downloaded reconstruction code was run. The complete input
capture and training run are not independently verified.

Let the space/time covariance be partitioned as A (3×3 spatial), b (3×1
cross-covariance) and c (scalar temporal variance). At model time t, a Gaussian
with learned means x and tau is rendered with:

- Center `x + (b / c) * (t - tau)`.
- Covariance `A - b * b.T / c`.
- Opacity `sigmoid(rawOpacity) * exp(-0.5 * (t - tau)^2 / c)`.

The exporter evaluates the conditional covariance in float64 and stores its
positive eigenscales and orientation. Coordinates and covariance are both
rotated from Blender Z-up to Three.js Y-up. This is a coordinate transform,
not animation. All 120,007 Gaussians are retained. The GPU evaluates learned
means and opacity at continuous time, then Spark projects, sorts and blends
the anisotropic Gaussians. It is neither a point-sprite astronaut nor a video
of a fixed camera view.

## Compact asset format

`manifest.json` uses version 1 and format `native-4dgs-conditioned-f32-v1`.
`model.bin` decompresses to little-endian float32, with 20 values (five RGBA
texels) per Gaussian:

| Texel | Components |
| --- | --- |
| 0 | x, y, z, base opacity |
| 1 | scale x, scale y, scale z, learned time center |
| 2 | conditional orientation quaternion x, y, z, w |
| 3 | velocity x, velocity y, velocity z, 0.5 / temporal variance |
| 4 | DC red, green, blue, reserved |

DC color is a deliberate display approximation. Higher-order view-dependent
and time-dependent color coefficients are not evaluated. The player covers
the native normalized time interval [0, 1], with an illustrative eight-second
cycle. It does not recover the original recording's duration.

The browser checks manifest format, compressed byte length, SHA-256, decoded
length, finite parameters, valid scales, opacity and temporal precision. All
runtime assets are same-origin and precached by the production service worker.
Failed assets show an explicit error and retry control. Renderer resources,
the texture, animation loop, controls and resize observer are disposed when
switching displays or leaving the view. Graphics loss is reported explicitly.

## Validation

The focused browser tests exercise native rendering at two motion phases,
keyboard orbit, pause/play, scrubbing, the original comparison view, reduced
motion, mobile reflow, asset-failure recovery and offline reload. Asset tests
check hashes, distribution parameters and genuine temporal changes. The
exporter's analytical conditioning is also checked against an independently
constructed 4D covariance.

Verified locally on 13 November 2026:

| Check | Result |
| --- | --- |
| `npm.cmd run build` | Passed; 41 local assets precached, about 52.75 MB total |
| `npm.cmd test` | 14 passed, including model hash/parameters and existing health trend rules |
| `python -m unittest discover -s tests -p test_native_4dgs.py` | 2 analytical covariance checks passed |
| Playwright: gaussians, mission, offline | 9 passed, including fake-camera capture and original-video persistence |
| Playwright: selected accessibility checks | 5 passed: reflow at 1024×600, 320×568 and 320×240; axe across views/dialogs at 1440px and 390px |

The browser checks use installed Chrome with software WebGL, not a benchmark
of the user's GPU. The desktop and mobile reconstruction screenshots were
also inspected visually. Automated accessibility checks do not replace manual
screen-reader or assistive-technology testing. Spark's large renderer bundle
is loaded lazily; Vite reports its normal large-chunk advisory.

## Bringing in an astronaut or personal session

A different native 4DGS capture needs its title, sources, licensing and time
range reviewed and set in a corresponding exporter. The current exporter pins
the documented checkpoint hash so another model cannot silently receive this
asset's provenance. `--checkpoint` can locate another copy of the same input
file; `--output` chooses the destination. HUST's method needs its own trained
deformation network evaluated at timestamps (or ported for browser inference);
its PLY canonical state alone is insufficient. Neither exporting nor recording
MediaPipe landmarks trains a new reconstruction. No cloud training job,
personal video upload or paid service is part of this integration.

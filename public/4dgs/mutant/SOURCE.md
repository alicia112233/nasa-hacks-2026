# Trained 4DGS example provenance

- Publisher: `youngbongbong` on Hugging Face.
- Repository: https://huggingface.co/youngbongbong/4dgs
- Pinned revision: `5e71153953624e09e7d2ff4ea1e839fc3ca75716`.
- Original file: `4dgs_mutant_iter30000.pth` (233,786,190 bytes).
- Original SHA-256: `b001bba170b9e0c3ef545eabab68227668edfabbedcab58336b6370c7d9a562c`.
- Checkpoint capture: 120,007 rotated 4D Gaussians; iteration 30,000.
- Publisher's model card declares `license: apache-2.0`; a copy is in [LICENSE.txt](LICENSE.txt). The model card contains no further training description. The filename identifies the D-NeRF Mutant scene; this identification and its native-4DGS representation are supported by the filename, tensor layout and observed rendering, rather than a separately verified training run.
- Native 4DGS method: Zeyu Yang et al., *Real-time Photorealistic Dynamic Scene Representation and Rendering with 4D Gaussian Splatting*, ICLR 2024. https://github.com/LogosIntelligenceLab/4d-gaussian-splatting
- Original synthetic dataset project: Albert Pumarola et al., D-NeRF. https://github.com/albertpumarola/D-NeRF
- Browser renderer: Spark, MIT. https://github.com/sparkjsdev/spark

The local model is an export of the learned distribution. It contains the
conditional spatial covariance, mean, velocity, temporal variance, opacity and
DC color for every Gaussian. Higher-order color spherical harmonics and
optimizer/training state are omitted. The 4D conditioning math follows the
native 4DGS representation; no authored skeleton or procedural body animation
is used. The browser timeline covers normalized model time [0, 1]. Playback
over eight seconds is a presentation choice, not the source recording duration.

This synthetic humanoid is a research example. It is not an astronaut scan or
a personal mobility recording, and its geometry supplies no health metrics.

Reproduce with `python scripts/export-native-4dgs.py`. The generated manifest
records the exported-data hash, original checkpoint hash and display choices.

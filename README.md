# GhostPilot

A local-first crew health prototype for astronaut self-assessment and flight surgeon review, built with React, TypeScript, Three.js, Recharts, and MediaPipe.

## Small screens and accessibility

- **Health at a glance** puts the latest heart rate, sleep quality, mood, energy, attention response, and estimated shoulder range beside review actions. The complete summary fits a 1024 × 600 laptop viewport. Latest readings are separate from the median-based trend flags; absent measurements stay explicitly unrecorded.
- The crew check uses a responsive form with a separately laid out heart-rate unit. Its header and Save action remain visible while the content scrolls on short screens. Text keeps a minimum 12px size; primary reading text and controls use 14–16px.
- Keyboard users can skip to the main content, use the history table's scroll region, and navigate dialogs and the mobile menu with focus containment and Escape. Hidden navigation and background content become inert. Selected options expose their state, and focus uses a visible outline.
- The timed attention task is optional. Skipping it records no reaction-time measurement; partial task results are discarded. Reduced motion and Windows forced colors are supported.
- Automated checks cover nine screen sizes, including short landscape and CSS viewports equivalent to 200% and 400% zoom on 1280 × 960. These reflow checks do not replace manual browser zoom or assistive-technology testing. Axe scans cover all six views and representative dialogs at desktop and mobile widths.

With the dev server running, run `npm.cmd run test:a11y`. See [the accessibility review](research/accessibility-review.md) for results and limits. This is a prototype, not NASA-certified medical software.

## Mission Lens

Open **http://127.0.0.1:4173/#lens** in the production preview, or choose **Mission lens** in the navigation.

- Explore an interactive constellation organized around NASA's five spaceflight hazards. Each node separates observations, missing measurements, uncertainty, and an available next step.
- Rewind or play through the mission history. Every replay position uses only the check-ins available at that time, including the linked investigation dialog. Simulated history never enters a personal baseline.
- Try a clearly labelled communications blackout and adjust a planning delay. The round-trip estimate assumes a symmetric link. Browser connectivity is distinct from a functioning ground link.
- Save an immutable onboard handoff with the selected observations, analysis, context, dated actions, and research sources. A saved receipt is shown only after IndexedDB confirms the write. Reload or download its JSON offline. Downloads are explicitly **not transmissions**.
- Historical handoffs exclude later actions. A handoff at the latest observation includes subsequent actions recorded before the handoff is created. The packet records both cutoffs.
- Trend flags now require three valid earlier and three valid recent samples **for the specific metric**. Missing pose measurements cannot generate a movement flag just because enough crew check-ins exist.

NASA and CSA sources are linked inside the lens, with hazard-specific study references and a downloadable list of 22 primary resources. The five supplied pages, linked investigations, and data-access routes are reviewed in [the NASA and CSA research brief](research/nasa-csa-resource-review.md). The prototype is not a validated NASA risk model. Radiation exposure, bone density, immune function, and habitat conditions remain explicitly unmeasured.

Choose **Research for this hazard** to read the evidence behind a selected node, or **Explore NASA data sources** for RadLab, environmental telemetry, OSDR, and human-research catalogs. Access labels distinguish public archives from data requiring requests. No external measurements have been imported; synthetic history and personal records remain separate. New handoffs and Markdown/JSON reports include citations and research-use metadata. Source notes and source-list downloads work offline after caching; external agency pages require connectivity.

The official 2026 challenge summary was accessible through the search index. Full Details/Resources-tab retrieval failed; these background sources are **independent NASA references**, not a verified challenge resource list. See [the research and access notes](research/challenge-review.md).

## Run locally

```powershell
npm.cmd install
npm.cmd run dev
```

Open **http://127.0.0.1:5173**. On PowerShell, `npm.cmd` avoids the system's script execution policy.

```powershell
npm.cmd run build
npm.cmd run preview
```

The production preview runs at **http://127.0.0.1:4173**. Offline support is enabled in the production build. Allow the first load to finish caching all assets, including the local pose and 4DGS models (about 53 MB total), before disconnecting. HTTPS or localhost is required for the camera and service worker.

## Demo flow

1. The initial dashboard contains **clearly labelled synthetic mission history**: 14 check-ins, worsening sleep and attention, and a smaller left shoulder movement.
2. Explore **Trained 4DGS**: orbit a trained humanoid reconstruction, pause, and scrub its learned motion. Select **Pose comparison** to compare the illustrative astronaut with the ghost baseline. The public reconstruction supplies no crew health measurements; the ghost represents typical performance, never a high score.
3. Open **Start flight check**. The standard check has a 60-second docking task and a brief crew form. An optional 15-second demo is saved as simulated data. Respond to randomly appearing signals with a tap or the space bar.
4. Open an evidence card, review observations and uncertainty, select a reflection checklist/action, and schedule a reassessment.
5. View the **Action log**, mark an action complete, or reassess. Prepare a ground report and download Markdown or JSON. Nothing is sent automatically.
6. Choose **Switch to my data** for an empty personal baseline. Demo entries never affect personal trends. The demo can be reloaded from mission settings without deleting personal records.

## Movement capture and honest limits

- **Record movement** requests camera access only when selected. The app records up to 12 seconds without audio and runs the bundled MediaPipe Pose Landmarker locally. No API keys or model downloads at runtime are needed.
- Video blobs, pose frames, check-ins, and actions persist in **IndexedDB on the current device**. The original video can be replayed or downloaded from the session's source panel. Clearing site data removes these records; use report/video downloads when you need an external copy.
- Shoulder estimates use the 90th percentile of confident hip–shoulder–elbow angles. Sessions with fewer than 10 confident frames have no angle estimate. No confident pose means **video only**, with no fabricated avatar playback.
- Captured sessions can drive arm movement in the 3D avatar. This is an experimental, simplified pose replay, **not a full anatomical reconstruction**. Today’s captured angle estimates join a real crew check-in on the same day; no wellbeing responses are fabricated by recording a video.
- **Trained 4DGS** now plays a genuine community native 4D Gaussian checkpoint: the D-NeRF **Mutant** synthetic humanoid, with 120,007 Gaussians at checkpoint iteration 30,000. Its learned space/time covariance determines motion and visibility continuously on the GPU. It is a public research example, separate from the simulated shoulder measurements and personal recordings.
- **Pose comparison** retains the articulated particle-surface astronaut for the illustrative today/baseline overlay and recorded MediaPipe replay. Recording a webcam session still saves video and pose estimates; it does not train a new 4DGS reconstruction.
- Compare recordings made with the same camera placement, distance, restraints, and gravity. An Earth baseline cannot be treated as directly equivalent to free-floating movement.

## Trained 4DGS playback

The bundled model is an 8.70 MB compressed parameter export from [youngbongbong/4dgs](https://huggingface.co/youngbongbong/4dgs/tree/5e71153953624e09e7d2ff4ea1e839fc3ca75716), a community checkpoint whose tensor layout matches [Yang et al.'s native 4DGS implementation](https://github.com/LogosIntelligenceLab/4d-gaussian-splatting). This is a different method from [Wu et al.'s HUST 4DGaussians](https://github.com/hustvl/4DGaussians). The original training inputs/run were not independently verified. The publisher declares Apache-2.0 for the checkpoint; the source revision, hashes and provenance are retained in [the asset notes](public/4dgs/mutant/SOURCE.md) and manifest.

[Spark](https://sparkjs.dev/) renders anisotropic Gaussians with depth sorting and alpha blending. The player conditions the learned 4D distribution on a continuously adjustable time using a GPU shader. It preserves all Gaussians and their conditional spatial covariance, position and temporal opacity. This compact display uses DC color and omits higher-order view-dependent spherical harmonics. The eight-second playback cycle is illustrative; original recording duration is unknown. Reduced-motion users start paused. The model and renderer are served locally and included in the production offline cache.

The exported asset is already bundled; Python is unnecessary to run the app. To reproduce the export, download the pinned `4dgs_mutant_iter30000.pth` checkpoint into `.4dgs-cache/`, then run with a Python environment containing `torch`, `numpy`, and `scipy`:

```powershell
python scripts/export-native-4dgs.py
```

The CPU exporter uses restricted tensor loading, conditions the 4D covariance analytically, and records the checkpoint and exported-data SHA-256 hashes. It does not train a model. Astronaut-specific or personal reconstructions still need suitable source imagery and a separate training pipeline. See [the integration notes](research/4dgs-integration.md) for the format and validation.

## Prototype trend rules

Medians from the latest three entries are compared with up to 11 earlier entries of the same source. A minimum of three earlier and three recent check-ins is needed. Prototype flags use a 15% increase in response time or an 8% reduction in left shoulder range; a sleep change of at least one point provides wellbeing context. These are illustrative rules, **not clinically validated thresholds**. Recorded and simulated data never share a baseline.

Follow-up cards are predefined reflection aids. They are not approved medical protocols. GhostPilot cannot diagnose illness, mental health conditions, bone loss, radiation injury, or immune changes. Medical decisions and escalation require mission-approved procedures.

## Checks

```powershell
npm.cmd test
npm.cmd run build
# With dev (5173) and production preview (4173) running:
npm.cmd run test:e2e
```

Browser tests use an isolated installed Chrome session and a **fake camera**, never the device's real camera. They cover docking inputs, crew forms, source separation, actions, persistence, report downloads, responsive navigation, local capture, and offline reloads.

## Deploy

This is a static Vite application. On Vercel, use the Vite preset, build command `npm run build`, and output directory `dist`. No backend, environment variables, or paid services are required. This repository does not provision or deploy a Vercel project automatically.

The local MediaPipe assets are copied from `@mediapipe/tasks-vision` (Apache 2.0); the pose landmarker model comes from Google's official `mediapipe-models` storage. Three.js is MIT licensed. Dependency licenses remain in `node_modules`.

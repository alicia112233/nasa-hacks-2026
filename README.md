# GhostPilot

Crew health checks you navigate by body region, built for long missions far from Earth. An offline-first web app for astronaut self-assessment and flight surgeon handoff, built with React, TypeScript, Three.js, Blender, Recharts, MediaPipe and Spark.

Built for the NASA Space Apps Challenge 2026 [health monitoring software challenge](https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/). See [the judging rubric and submission notes](research/judging-rubric.md).

## How it works

1. **Tap a body region.** A full human body, built in Blender and posed to NASA's measured zero-g posture, is the navigation. It takes your shape from your crew profile. Nine lettered regions (A Head … H Legs, plus I Cabin for the habitat around you) each open a crew procedure card.
2. **Run that region's checks.** Every card lists numbered, timed checks traced to NASA's [17 named spaceflight risks](https://www.nasa.gov/hrp/risks/) and [five hazards](https://www.nasa.gov/hrp/hazards/). The hazards are shown as coloured tabs. Checks are a 60-second attention task, 1–5 self-reports, none/mild/strong symptom reports, heart rate, exercise minutes, and a 12-second camera shoulder-range check. Checks that need equipment GhostPilot doesn't have (OCT, blood pressure cuff, DXA, lab samples, dosimeter) are hatched and labelled with what they need.
3. **Compare against your ghost.** Your ghost is your own baseline: the median of your earliest check-ins. Trend flags turn a region red, and symptoms you report today turn it amber. Regions with nothing measured are hatched.
4. **Hand off.** Handoffs are saved on board and timestamped, with the body index, actions and cutoffs. They work during a communication blackout and are never shown as sent. Ground reports download as Markdown or JSON.

| Page | What it shows |
| --- | --- |
| Body | 3D body index shaped to the crew member, a Preflight / Sol toggle for the zero-g body, and the selected region's procedure card |
| Trends | Last 3 vs ghost for ten measures, a chart with the ghost line, and check-in history |
| Handoff | One-way delay (0–30 min), blackout drill, saved handoffs, ground reports, follow-ups |
| Mission | All 17 NASA risks mapped to regions and checks, NASA ISS radiation and habitat data, crew profile (sex, build, height, mass), demo/personal switch, sources |

## NASA data and resources

- **Risk coverage:** every one of NASA HRP's 17 risks maps to at least one region check, and each links to its NASA reference page. A unit test fails if any risk loses coverage. See [risk coverage and link check](research/risk-coverage.md).
- **ISS data:** the Cabin region and Mission page plot NASA's Environmental Data App record for Rodent Research-3 (ISS, 2016). That means 43 days of absorbed dose (0.227 mGy/day median, 9.9 mGy accumulated, split into galactic cosmic rays and South Atlantic Anomaly) and 50 days of habitat CO₂, temperature and humidity. `scripts/fetch-nasa-eda.py` reproduces the extract and records the source URL, retrieval time, SHA-256 and transformations. The data is archived mission context, never a personal reading, and never part of a ghost.
- **Research:** 22 NASA and CSA sources (hazards, investigations such as ARCHeR, CIPHER, Immune Biomarkers, Tempus Pro, and CSA's CANS and Radi-N2) are bundled in `src/research.mjs`, included in exports, and reviewed in [the NASA and CSA resource review](research/nasa-csa-resource-review.md). NASA's RadLab archive returned HTTP 500 during this work, so radiation data comes from the Environmental Data App instead.

## The Blender body

`scripts/blender/build_body.py` builds the body in Blender 5.2 from the CC0 MakeHuman assets: base mesh, macro targets and default rig weights. It reads them straight from the [MPFB 2.0.18](https://extensions.blender.org/add-ons/mpfb/) archive, downloaded once to `.cache/` and checked against its SHA-256; no add-on is installed. The script:

- **Poses** the body to NASA's 0g neutral body posture ([HIDH](https://www.nasa.gov/wp-content/uploads/2015/03/human_integration_design_handbook_revision_1.pdf) Figure 4.3-2: head 24°, shoulder 36°, elbow 122°, trunk–thigh 128°, knee 133°, foot 111°), using MakeHuman's own skeleton and skin weights.
- **Bakes 17 morph targets.** Female, heavier, lighter, more and less muscular (with sex-specific cross terms), shoulder, waist and hip measurements, and HIDH Table 4.3-4's zero-g changes: +3% stature from spinal elongation, and the fluid shift that thins the legs and fills the face. Each shape is posed with its own fitted skeleton.
- **Cuts regions** with anatomical planes (neck, lower ribcage, iliac crest, shoulders, armpits) through one skin, so seams are straight and shading stays smooth across them. It then exports `public/models/body.glb` (about 2.6 MB) and `body.json` (sources, statures, posture angles).

In the app, `src/physique.mjs` turns the crew profile into morph weights and a height scale. The **Preflight / Sol** toggle on the Body page shows the zero-g body next to the preflight one, with stature, e.g. 168 cm → 173 cm. See [the body model notes](research/body-model.md) for sources, limits, and how an on-device scan could drive the measurement morphs next.

```powershell
& "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" -b --factory-startup -P scripts/blender/build_body.py -- .
```

It also runs inside a live Blender session through the Blender MCP add-on (`execute_code`) with `REPO` set to the repository path.

## Movement capture and the 4DGS reference

- **Shoulder range** (Arms → Shoulder range → Record 12 s) asks for the camera only when selected and records without audio. It runs the bundled MediaPipe Pose Landmarker locally and estimates shoulder range from the 90th percentile of confident hip–shoulder–elbow angles. Fewer than 10 confident frames means no angle. Video and pose frames stay in IndexedDB on the device.
- **Compare movement** opens a pose comparison (today vs ghost) and, in demo mode, a **4DGS reference**: a genuine community-trained native 4D Gaussian splat (D-NeRF "Mutant", 120,007 Gaussians) rendered with Spark. It is a technical showcase, not crew data. See [the 4DGS integration notes](research/4dgs-integration.md) and [asset provenance](public/4dgs/mutant/SOURCE.md). `scripts/export-native-4dgs.py` reproduces the export.

## Honest limits

- The thresholds (15% slower attention, 8% less left shoulder range, a 1-point sleep drop) are illustrative prototype rules, **not clinically validated**. The ghost uses the earliest 11 check-ins of the same source. Each flag needs three valid baseline and three valid recent values for its own metric. See `src/rules.mjs`.
- Self-reports are subjective prompts for reflection and handoff, not diagnoses. GhostPilot cannot diagnose SANS, bone loss, immune changes, radiation injury or mental health conditions.
- Demo history is synthetic and labelled. Demo and personal records never share a ghost. A camera recording always goes to personal records.
- This is a prototype, not NASA-certified medical software or a NASA-approved risk model.

## Run locally

```powershell
npm.cmd ci                 # install the locked dependencies, including bundled fonts
npm.cmd run dev        # http://127.0.0.1:5173
npm.cmd run build
npm.cmd run preview    # http://127.0.0.1:4173, offline-capable
```

The production build precaches every asset (body model, NASA data, pose model, 4DGS model, about 52 MB) for offline use. Let the first load finish before disconnecting. The camera and service worker need HTTPS or localhost. On PowerShell, `npm.cmd` avoids the script execution policy.

## Checks

```powershell
npm.cmd test                # 23 Node tests: risk coverage, Blender mesh mapping and morphs, profile shaping, region status, trend rules, handoffs, 4DGS asset
# Build first; Playwright starts dev (5173) and preview (4173) automatically:
npm.cmd run build
npm.cmd run test:e2e        # Playwright: body, handoff, mission, offline, accessibility
npm.cmd run test:a11y       # axe WCAG 2.2 AA at 1440/390 px, reflow at 9 viewports, keyboard, forced colours
python -m unittest discover -s tests -p test_native_4dgs.py   # optional; needs torch, numpy, scipy
```

Browser tests use installed Chrome with a **fake camera** and software WebGL. Automated accessibility checks don't replace manual screen-reader or real-zoom testing. See [the accessibility review](research/accessibility-review.md) for the earlier audit.

## Design tooling

The interface was designed with the [Impeccable](https://github.com/pbakaus/impeccable) skill (Apache-2.0, v4.9.0, commit `c4cd192`), installed for Claude Code in `.claude/skills/impeccable` with its subagents in `.claude/agents/`. Product context lives in `PRODUCT.md` and the visual system in `DESIGN.md`. The design-check hook is not installed (`npx impeccable install` adds it).

## Deploy

This is a static Vite app. On Vercel, use the Vite preset with build command `npm run build` and output directory `dist`. It needs no backend, environment variables or paid services. MediaPipe assets come from `@mediapipe/tasks-vision` (Apache 2.0). Three.js is MIT licensed, and Barlow fonts are under the SIL OFL via Fontsource. The body mesh derives from MakeHuman assets (CC0).

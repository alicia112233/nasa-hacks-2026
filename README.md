# GhostPilot

Crew health checks you navigate by body region, built for long missions far from Earth. An offline-first web app for astronaut self-assessment and flight surgeon handoff, built with React, TypeScript, Three.js, Blender, Recharts, MediaPipe and Spark.

Built for the NASA Space Apps Challenge 2026 [health monitoring software challenge](https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/). See [the judging rubric and submission notes](research/judging-rubric.md).

The complete team-supplied **Background, Objectives, and Potential Considerations** are preserved in [the challenge brief](research/challenge-brief.md). AI contributors should start with [AGENTS.md](AGENTS.md); product decisions live in [PRODUCT.md](PRODUCT.md).

## How it works

New devices open a one-minute **Tutorial** that follows one reading through the challenge loop on the real interface: **Spot** (tap the region that turned red), **Check** (open the check behind it to see how and why), **Compare** (open Trends and read that measure against the ghost line) and **Act** (open Report). The steps come from the crew member's own data, so in the demo it follows Alex Morgan's sleep drop in Head; with no readings it still walks a real region and check. A spotlight marks each control and only that control advances the tour; the one chart step has Next. Back, Skip and Close stay available, and **Tutorial** in the top bar replays it. The tour works offline, saves no readings, preserves an unsaved handoff draft and restores the previous page when dismissed.

0. **Start on Today.** Selecting a crew member opens the Body page on **Today**: two rings, **Physical** (14 checks) and **Mental** (attention, sleep, mood, energy, workload, teamwork: 6 checks, split by their NASA risks). Each ring has a segment per check: ink when done, red when the result is off your ghost or its range, amber for the next one, empty to do. The middle shows the exact count, and the status line names any trend. These count today's checks; they are not a health score. Below the rings is the one next step with Start, and a link to today's report. Tapping a ring starts that area's next check.
1. **Tap a body region.** A full human body, built in Blender and posed to NASA's measured zero-g posture, is the navigation. It is shaped to you: tap Scan me above the body, and a 5-second camera scan fits proportions to your chosen avatar model and estimates build and how heavy the figure should look; height and mass are numbers you type, because a camera can't measure either. A crew can share one device: the top bar names who is shown, and each member has their own body, checks, ghost and handoffs. Nine lettered regions (A Head … H Legs, plus I Cabin for the habitat around you) each open a crew procedure card.
2. **Run that region's checks.** The card shows how far you are ("2 of 7 complete"), marks the next check, and, once done, points to the next region with checks left (or today's report). Checks that need equipment stay out of the count. Every card lists numbered, timed checks traced to NASA's [17 named spaceflight risks](https://www.nasa.gov/hrp/risks/) and [five hazards](https://www.nasa.gov/hrp/hazards/). The hazards are shown as coloured tabs. Checks are a 60-second attention task, 1–5 self-reports, none/mild/strong symptom reports, heart rate, exercise minutes, a 12-second camera shoulder-range check, and a 5-second camera leg-outline scan. Checks that need equipment GhostPilot doesn't have (OCT, blood pressure cuff, DXA, lab samples, dosimeter) are hatched and labelled with what they need.
3. **Compare against your ghost.** Your ghost is your earliest readings (up to 11, keeping the latest 3 to compare) until you set a fixed preflight or phase ghost in Trends → Conditions & ghost. Self-reports and heart rate compare as they are; only a poor recording or, for camera checks, a changed camera setup makes a comparison unreliable, and then it asks for a repeat rather than raising an alert. References never update automatically. Any alert turns a region red: a reading off your ghost, a reported symptom, or a resting heart rate over 100 or under 50 bpm. Regions with nothing measured are hatched.
   **Clear next steps.** Every check says how to take it and why it matters, in one line each, when you open it. A saved result says what it means ("Today 64 bpm · ghost 62 bpm", or "high at rest: rest 5 min, recheck"). When a reading is off, the note lists up to three plain steps, each with its action beside it (Retake or Hand off), under a red label that says how urgent it is (ALERT for a reading off your ghost): **Watch** (look after yourself and recheck), **Tell surgeon** (add it to the next handoff) or **Act now** (strong breathlessness, a strong symptom after a spacewalk). The text lives in `src/guidance.mjs`.
4. **Hand off once, at the end of the day.** The **Report** page is the whole day in one place, readable without downloading: physical and mental counts, Needs attention (each trend or symptom with its urgency label and first step), today's results by region, what was not done, and what cannot be measured onboard. **Save as PDF** prints just the report. **Hand off today's report** saves it on the device with an optional note; the follow-up plan (tomorrow's check, reassessment time and information gaps, filled from the day) and the link delay sit in collapsed sections. The day picker at the top opens any earlier day's report, rebuilt from that day's readings; handed-off reports are listed with their reassessments, and ground reports still download as Markdown or JSON. In lists of checks the report uses neutral names (breathing, back, skin), so a list of checks never reads like a list of symptoms.

| Page | What it shows |
| --- | --- |
| Every page | The crew switch at the right of the top bar: who is shown, switch member, Edit profile (popup), Add crew member |
| Body | 3D body index shaped to the crew member, Scan me above it, a Preflight / Sol toggle for the zero-g body. Beside it, Today (rings and next step) until a region is picked, then that region's procedure card with a Today button back. |
| Trends | Last 3 vs ghost for eleven measures (including thigh breadth from the scan), a chart with the ghost line, and check-in history |
| Report | The day's report (counts, needs attention, results, gaps), Save as PDF, one Hand off with an optional note, follow-up plan and link delay, a day picker for past days, handed-off reports with reassessments |
| Risks | All 17 NASA risks mapped to their hazards, regions and checks, each linked to its NASA page |
| Sources | Restore sample crew, delete all records, and the NASA and CSA sources with a downloadable list |

## Daily checks and mission context

Today's **Next** step is one check (Start opens the attention task or a camera check straight away), ordered by urgent reported symptoms, poor recordings, unreliable camera comparisons, then old or missing readings; a reason shows only when a check must be repeated. Start opens that check. Start, completion and abandonment times are kept on the device for the usability protocol in research/workflow-evaluation.md; they are not shown in the interface.

**Conditions & ghost** (on Trends) stores phase, activity/timing, camera setup, posture/restraint, lighting and clothing. Each metric keeps its own measured-at timestamp and quality; camera checks add confident-frame count and spread when available. Establish a phase reference with an explicit reason after at least three matching good readings. Preflight is preserved and existing phase references cannot be overwritten. Later deterioration never changes the reference automatically. Legacy records without recorded conditions remain context only. The Preflight / Sol body illustration is separate from these retained measurement references.

Headache reports from at least two crew members within 24 hours prompt **Crew & cabin review**. Current crew-entered cabin observations record time and sensor/location; absent or old measurements ask for a fresh reading. The NASA 2016 graphs remain archived context, separate from current readings. A shared headache report does not establish CO₂ as the cause. The offline cabin procedure is an unreviewed demo too.

See [workflow implementation, scientific sources and usability evaluation protocol](research/workflow-evaluation.md). No human study or clinical validation has been performed. Sources → Restore sample crew brings back any sample member you removed.

## Handoff delivery and reassessment

The recipient label is **medical team**, covering an onboard clinician, doctor, nurse or flight surgeon. Empty and whitespace-only observations cannot be saved. A reassessment records what changed, the procedure followed, the next check/time and information still missing. Events retain their crew, source, timestamp and original packet ID; per-metric timestamps attach only newly recorded values from the same crew/source. Legacy packets without a plan remain readable and can receive a new reassessment.

GhostPilot has **no transmission service or ground connection**. “Saved on this device” means local storage; “Downloaded” means an export was requested, not that a clinician received it. Transfer the downloaded file through the mission’s communication channel when available. The delay/blackout controls are scenarios, not link telemetry. Reviewed ground-response import is a future capability; no reviewed instructions or receipts are fabricated. See [the continuing-care notes](research/continuing-care.md).

## Crew roster

Several crew members can share one device. The crew switch at the right of the top bar shows the selected member's initials and name on every page, so it is always clear whose body, checks, trends and handoffs are on screen. GhostPilot keeps no photos, so initials stand in for a face. The switch lists the crew with each member's scan status, and offers Edit profile and Add crew member. Edit profile opens a popup without leaving the current page or changing the selected body region. A new member opens in that popup with their name ready to type, then Scan me. Records, ghosts, follow-ups, handoffs and videos all belong to one member. Removing a member asks first and removes their records too; Sources → Delete all records clears everyone and restores the sample crew. The sample crew has four members, each with 14 sols of history for every measure and a preflight and cruise ghost: Alex Morgan (attention, sleep and shoulder slipping), Jordan Lee (thigh breadth 6% below the ghost as exercise falls), Mei Tanaka (mood and teamwork low, resting heart rate rising) and Diego Alvarez (steady, with all of today's checks done). Members you add start empty. Saves from before the roster become a crew of one.

## NASA data and resources

- **Risk coverage:** every one of NASA HRP's 17 risks maps to at least one region check, and each links to its NASA reference page. A unit test fails if any risk loses coverage. See [risk coverage and link check](research/risk-coverage.md).
- **ISS data:** the I Cabin card shows, open, NASA's Environmental Data App record for Rodent Research-3 (ISS, 2016). That means 43 days of absorbed dose (0.227 mGy/day median, 9.9 mGy accumulated, split into galactic cosmic rays and South Atlantic Anomaly) and 50 days of habitat CO₂, temperature and humidity. `scripts/fetch-nasa-eda.py` reproduces the extract and records the source URL, retrieval time, SHA-256 and transformations. The data is archived mission context, never a personal reading, and never part of a ghost.
- **Research:** 22 NASA and CSA sources (hazards, investigations such as ARCHeR, CIPHER, Immune Biomarkers, Tempus Pro, and CSA's CANS and Radi-N2) are bundled in `src/research.mjs`, included in exports, and reviewed in [the NASA and CSA resource review](research/nasa-csa-resource-review.md). NASA's RadLab archive returned HTTP 500 during this work, so radiation data comes from the Environmental Data App instead.

## The Blender body

`scripts/blender/build_body.py` builds the body in Blender 5.2 from the CC0 MakeHuman assets: base mesh, macro targets and default rig weights. It reads them straight from the [MPFB 2.0.18](https://extensions.blender.org/add-ons/mpfb/) archive, downloaded once to `.cache/` and checked against its SHA-256; no add-on is installed. The script:

- **Poses** the body to NASA's 0g neutral body posture ([HIDH](https://www.nasa.gov/wp-content/uploads/2015/03/human_integration_design_handbook_revision_1.pdf) Figure 4.3-2: head 24°, shoulder 36°, elbow 122°, trunk–thigh 128°, knee 133°, foot 111°), using MakeHuman's own skeleton and skin weights.
- **Bakes 17 morph targets.** Female, heavier, lighter, more and less muscular (with sex-specific cross terms), shoulder, waist and hip measurements, and HIDH Table 4.3-4's zero-g changes: +3% stature from spinal elongation, and the fluid shift that thins the legs and fills the face. Each shape is posed with its own fitted skeleton.
- **Cuts regions** with anatomical planes (neck, lower ribcage, iliac crest, shoulders, armpits) through one skin, so seams are straight and shading stays smooth across them. It then exports `public/models/body.glb` (about 2.6 MB) and `body.json` (sources, statures, posture angles).

In the app, `src/physique.mjs` turns the crew profile and body scan into morph weights and a height scale. The **Preflight / Sol** toggle on the Body page shows the zero-g body next to the preflight one, with stature, e.g. 168 cm → 173 cm. See [the body model notes](research/body-model.md) for sources, validation and limits.

```powershell
& "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" -b --factory-startup -P scripts/blender/build_body.py -- .
```

It also runs inside a live Blender session through the Blender MCP add-on (`execute_code`) with `REPO` set to the repository path.

### Body scan

**Scan me opens a full-window camera view**, with large centered instructions that adapt to your position and a visible countdown. Full screen can also hide the browser chrome where supported. A bundled English voice guide explains positioning, counts down and announces completion, so you can stand away from the device. Turn up the device volume before stepping back; use Voice guide to mute or Repeat instruction to hear the current cue again. The voice preference is remembered. Audio works offline after the first load, uses no speech service and never enables the microphone. If the browser blocks playback, an Enable voice guide action appears; visual instructions remain available. The Legs check uses the same scan.

One scan, used twice. Stand back until your feet show, arms a little out, and hold still for 5 seconds. The bundled MediaPipe Pose Landmarker runs on the device and gives pose landmarks plus a person mask. `src/scan.mjs` reads five breadths from the mask (shoulders, waist, hips, thighs, upper arms), each divided by torso length, and keeps the median of at least 8 usable frames. Frames are refused when the feet are cut off, the arms touch the body or the body leans. Only ratios are stored. The seconds that were measured are recorded, with the outline and measuring lines drawn on them, so you can replay them on the result and check where the lines fell; saving keeps that clip with the scan on this device (a retake or close without saving drops it), and the scan history in Edit profile replays it.

- **Setup (Body → Scan me).** One tap starts the camera, and the scan starts itself once it sees your whole body. Female/Male is your avatar-model choice, preserved from your profile through retakes and rescans. The scan estimates build and visual weight within that model; you can change either model or build, and each combination keeps its own fitted weight. New members choose a model before saving; the camera never selects it for them. The result puts the clip beside the fitted figure and lists all five breadths against one fixed baseline, the standard figure of that body shape (the app's MakeHuman model at average build and weight, not a population norm). Each row carries two marks, what the camera measured and how far the figure actually moved, plus a band for how far the frames disagreed, so a breadth the figure could not follow is visible rather than hidden. Above the body, a caption says whether the figure is fitted to a scan or is still the standard one. Edit profile in the top bar's crew switch opens a popup on the current page, where everything about you edits in place: click the name or mission to change it, and one Body list holds shape, build, height and mass. Height is the scan's ruler and sets your zero-g height. Mass is typed (a front-view camera has no depth and no density, so it cannot weigh anyone); a scan keeps a typed mass, and the figure uses it in place of the scan's heavier/lighter guess. Without a camera, shape and build can be set by hand there. **Scan history** in the same popup lists every scan, newest first (older leg-only scans are marked Legs): date, thigh breadth and the shoulder, waist, hip and arm breadths against the standard figure, with the scan shaping the figure marked. Deleting a scan asks first. If it shaped the figure, the previous body scan takes over (or the standard figure), and its thigh reading leaves Trends if it is still the one recorded; fixed ghosts are snapshots and keep it. Only thigh breadth from a scan becomes a reading (Trends → Thigh and the Legs ghost); the other breadths shape the figure. The camera fits body proportions; it does not determine sex or gender.
- **Legs check (Body → H Legs → Thigh breadth).** There is one scan: the Legs check opens the same body scan, which also reshapes the figure, and its thigh breadth is recorded in centimetres with your height as the ruler. It joins your record, Trends and handoffs like any other check. Its result replays the clip, names a comparable retained reference when available, and states its limits. A 5% reduction prompts review only with enough matching readings. Fluid shifts also change leg volume: a narrower silhouette alone cannot establish muscle loss. The Preflight / Sol body changes are illustrative, separate from measured phase references.

The scan is calibrated with the app's own model, not with guessed joint positions. The Blender build renders all 16 basis body shapes plus 9 held-out bodies, at 3 arm angles from 4 camera positions (300 frames in `.cache/scan-frames`). `scripts/calibrate-scan.mjs` runs MediaPipe on every frame and writes `src/body-calibration.mjs`. Results on the 8 held-out bodies:

- Body shape guessed right on 8 of 8, build on 7 of 8, and no guess was marked sure while wrong.
- Shoulder, waist and hip morphs recovered to within 0.35.
- The fluid-shift body reads −5.5% thigh breadth (HIDH: up to −6%), and thigh breadth repeats to ±0.16 cm across camera positions.
- All 75 frames with the feet cropped are refused.

A browser test feeds a rendered body to Chrome as a fake webcam and runs both scans in the app.

```powershell
& "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" -b --factory-startup -P scripts/blender/build_body.py -- .
npm.cmd run calibrate:scan
```

## Movement capture and the 4DGS reference

- **Shoulder range** (Arms → Shoulder range → Record 12 s) asks for the camera only when selected and records without audio. It runs the bundled MediaPipe Pose Landmarker locally and estimates shoulder range from the 90th percentile of confident hip–shoulder–elbow angles. Fewer than 10 confident frames means no angle. Video and pose frames stay in IndexedDB on the device.
- **Compare movement** opens the crew’s original video beside a linked retained reference recording when available, with dates, confident-frame counts, angles and recording conditions. Older angle-only references are labelled as missing their reference video. Camera conditions gate the comparison; a single matching pair does not establish a health trend. An estimated pose replay is secondary. The synthetic demo opens its labelled pose illustration first; the public **4DGS model** is behind a technical-demo disclosure and supplies no measurement evidence about the crew member. See [the 4DGS integration notes](research/4dgs-integration.md) and [asset provenance](public/4dgs/mutant/SOURCE.md).

### Real-participant repeatability study

**No measurements have been collected from people.** Synthetic body results do not establish human accuracy. A [collection protocol](research/human-study/PROTOCOL.md), header-only attempt log and analysis script are ready for a small pilot across participants, cameras, lighting, clothing and repeated sessions. The protocol matches the implemented shoulder angle and bilateral thigh-breadth band to appropriate physical reference measurements. Every failed capture stays in the denominator; missing references remain unpaired.

```powershell
node scripts/analyze-human-study.mjs research/human-study/attempts.csv
```

The supplied empty log generates a **PENDING** report with zero participants and no error estimates. With collected observations, the script reports descriptive error, failure rates and repeatability groups. No human validation result or clinical acceptance threshold is claimed.

## Honest limits

- The thresholds (15% slower attention, 8% less left shoulder range, a 1-point sleep drop, 5% less thigh breadth) are illustrative prototype rules, **not clinically validated**. Each flag needs three good reference and three later readings for its own metric under matching phase and conditions. References are fixed snapshots, separate by crew and source. A narrower silhouette alone cannot establish muscle loss. See `src/rules.mjs`.
- The body scan is calibrated and validated on rendered MakeHuman bodies in fitted clothes, not on measured people. Loose clothing widens the outline. The "frames agree within" figure on the result is repeatability within one scan, not accuracy. The figure is the standard model reshaped toward the scan, not a reconstruction of the person. Its body-shape and build suggestions are confirmed by the crew member, and thigh breadth is a front-view estimate, not a tape measurement.
- Guidance is procedural, not clinical: rest and recheck, follow the mission-approved procedure, and hand off to the flight surgeon. The only general range used is the adult resting heart rate of 60–100 bpm (American Heart Association). Each "why" line follows the NASA risk its check maps to.
- Self-reports are subjective prompts for reflection and handoff, not diagnoses. GhostPilot cannot diagnose SANS, bone loss, immune changes, radiation injury or mental health conditions.
- The sample crew's history is synthetic. It sits in the same stream as records you enter, so a sample member's ghost and trends work exactly like yours; members you add start empty.
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
npm.cmd test                # Node tests: reference integrity, quality gates, daily rules, crew/cabin prompts, and existing checks
# Build first; Playwright starts dev (5173) and preview (4173) automatically:
npm.cmd run build
npm.cmd run test:e2e        # Playwright: body, crew roster, handoff, mission, privacy, offline, accessibility, and the body scan on a rendered fake webcam
npm.cmd run test:a11y       # axe WCAG 2.2 AA at 1440/390 px, reflow at 9 viewports, keyboard, forced colours
python -m unittest discover -s tests -p test_native_4dgs.py   # optional; needs torch, numpy, scipy
```

Browser tests use installed Chrome with a **fake camera** and software WebGL. Automated accessibility checks don't replace manual screen-reader or real-zoom testing. See [the accessibility review](research/accessibility-review.md) for the earlier audit.

## Design tooling

The interface was designed with the [Impeccable](https://github.com/pbakaus/impeccable) skill (Apache-2.0, v4.9.0, commit `c4cd192`), installed for Claude Code in `.claude/skills/impeccable` with its subagents in `.claude/agents/`. Product context lives in `PRODUCT.md` and the visual system in `DESIGN.md`. The design-check hook is not installed (`npx impeccable install` adds it).

## Deploy

This is a static Vite app. On Vercel, use the Vite preset with build command `npm run build` and output directory `dist`. It needs no backend, environment variables or paid services. MediaPipe assets come from `@mediapipe/tasks-vision` (Apache 2.0). Three.js is MIT licensed, and Barlow fonts are under the SIL OFL via Fontsource. The body mesh derives from MakeHuman assets (CC0).

### Notes on specific checks

- **Joint pain after a spacewalk** has a **No spacewalk** answer, which records no pain and counts the check as done.
- **Exercise today** sits under Legs because the ISS's exercise equipment, the T2 treadmill, the CEVIS cycle and the ARED resistance device, is there mainly to load the legs and protect bone and muscle; the WHY line names them.
- A camera check is suggested again only when repeating it can help: a poor recording, or conditions that differ from an existing ghost. With no ghost set, a fresh reading is enough.
- **One stream of records.** There is no separate demo mode: the sample crew are profiles with history already filled in, and a member you add fills in their own. Older saves are converted on load, and the two new sample members (Mei, Diego) are added once.
- **Today's rings** colour a done check green (`--complete`), an alert red, the next check amber.
- **Instant feedback on every off answer.** A 1–5 rating of Low or Very low (sleep, mood, energy, appetite, workload, teamwork), any reported symptom, and a resting heart rate over 100 or under 50 bpm become alerts at once: the saved result carries a few words of what to do ("Today low · protect your next sleep"), the region turns red, and its note lists the steps. Very low steps up from Watch to Tell surgeon.
- **Sol and mission.** Sol is the mission day: Sol 1 is the **Mission start** date in Edit profile, and the top bar counts from it. The mission name (e.g. Ares I) edits in place under the crew member's name.
- **Compact exports.** Downloaded handoff and report JSON state the recording conditions shared by nearly every measurement once, in a top-level `conditions` block. A ghost snapshot states its own phase once, a value shared by one record sits on that record, and a measurement lists only what is its own (a different time, a quality other than good, a changed camera setup, frame counts). Records on the device keep their full conditions (`src/export.mjs`).
- **ISS environment data.** The Cabin charts use NASA's Environmental Data App record for Rodent Research-3 (2016), which covers ISS cabin CO₂, temperature, humidity and radiation dose for its missions only. NASA's public live ISS telemetry carries cabin pressure and temperature but needs a network connection, and no public live CO₂ feed was found, so today's cabin readings are the ones the crew log in I Cabin.

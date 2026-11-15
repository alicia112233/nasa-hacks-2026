# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Challenge Reference

Read [the full team-supplied challenge brief](research/challenge-brief.md) before proposing or prioritizing features. It defines the central task: gather health indicators, help astronauts evaluate their health, and provide guidance on actions and health improvements.

Each check should make clear what to measure, how to measure it, why it matters, what the result means, and what next step is available. Do not assume the astronaut already knows how to assess that indicator. The ghost comparison supports this assessment; it does not replace the explanation or the next action.

Blood pressure, heart rate, blood sugar, body temperature, daily sleep hours, and mood are examples in the brief. The clickable human figure, gamification, reminders, charts, and color coding are suggested approaches, not mandatory features. GhostPilot's chosen implementation and the measurements it actually collects are described below and in the README.

For this competition, the team prioritizes frontend UI/UX and ideation, with iterative improvements that preserve the core concept. A coherent experience demonstrating collection, assessment, and action takes priority over making every proposed integration operational.

## Users

Primary: an astronaut on a long-duration mission (Artemis, Mars transit, ISS) doing a quick self-check between tasks, often alone, with delayed or no contact with the ground. They want to know what to check, do it fast, and see whether they are drifting from their own normal.

Secondary: a flight surgeon on the ground who receives an exported handoff (Markdown or JSON packet) hours or minutes later and needs observations, gaps, and timing without having to ask.

Judges of NASA Space Apps 2026 (Impact, Creativity, Validity, Relevance) evaluate the build; see `research/judging-rubric.md`.

## Product Purpose

GhostPilot lets crew assess and act on their own health during long missions. A full human body is the map: each body region opens the checks that NASA's Human Research Program risks call for in that region, shows the crew member's trend against their own baseline (the "ghost"), and names what cannot be measured onboard. Success means a crew member can go from "how am I?" to a completed check and a saved handoff in under two minutes, with nothing hidden or guessed.

## Positioning

Your past self is the reference, not a population norm or a score. The body map treats "not measured" as a visible state rather than an absence, and every check is traced to one of NASA's 17 named spaceflight risks and five hazards. Handoffs are stored on board and are never shown as transmitted.

## Operating Context

- Offline-first: the app works with no network after the first load (service worker). Records live in IndexedDB on the device.
- Communication delay of up to about 20 minutes one way (Mars), plus blackouts. Handoff packets are store-and-forward downloads.
- Used on laptops and tablets onboard, including small screens (1024 × 600) and touch.
- Real NASA data on hand: ISS environmental telemetry and SRAG radiation dose from NASA's Environmental Data App (Rodent Research-3, 2016), shown as archival mission context and never as personal readings.

## Capabilities and Constraints

- Checks today: a 60-second docking-signal attention task; self-reports of sleep quality, mood, energy, and symptoms; manual heart rate; a camera shoulder range-of-motion check (MediaPipe Pose, local, video stored on the device).
- Adding: short self-checks for risks where self-report is meaningful (vision change, dizziness/coordination, pain, appetite/nutrition, skin/rash, teamwork). Risks that need instruments or labs (bone density, radiation dose, immune assays, decompression) are labeled "needs instrument".
- Trend rules are deterministic prototype thresholds (15% response time, 8% shoulder range, a 1-point sleep drop), not clinically validated.
- Synthetic demo history and personal records never share a baseline.
- The trained 4DGS model (a public D-NeRF "Mutant" humanoid) is kept as a secondary technical view inside the movement check. It supplies no crew data.
- The body model is authored in Blender (installed locally, version 5.2) and shipped as a static GLB.
- Static Vite + React + TypeScript + Three.js app. No backend, accounts, or paid services.
- A first-use interactive tutorial requires nine clicks on the real crew, profile, body-region, check, Trends and Handoff controls. Only the current goal advances the tour; keyboard activation works too. Back restores prerequisites, and Skip, Close and Emergency remain available. It can be replayed from every page, works offline, writes no practice readings and preserves an existing handoff draft.
- Body and leg scans fill the window with large centered positioning instructions. Optional bundled speech, a countdown and a completion cue support use at camera distance; mute/replay controls remain on screen. Audio stays offline and the camera never requests microphone access.

## Brand Commitments

- Name: GhostPilot. "Ghost" means the crew member's own baseline, never a competitor or a high score.
- The user asked for fewer words, minimal UI, simple navigation, and no tooltips.

## Evidence on Hand

- `src/research.mjs`: 22 NASA/CSA sources (all reachable on 2026-11-14, except RadLab, which returned HTTP 500 server-side).
- NASA HRP risk list: 17 risks with reference pages (all returned 200 on 2026-11-14).
- NASA EDA RR-3 extract: about 14,385 five-minute samples of ISS habitat temperature, RH, and CO₂; 43 daily dose values (mGy/day) with GCR and SAA components.
- Synthetic 14-check-in demo mission (labeled simulated).
- No user studies, astronaut testimonials, or clinical validation exist. Do not fabricate them.

## Product Principles

### Current iteration: emergency and context-aware assessment

Keep the central challenge loop—gather health indicators, understand/evaluate them, act—visible in every flow. Acute escalation is available on every page and never depends on a ghost. The supplied emergency package is an unreviewed hackathon demonstration; clinician review and mission approval are not available and must never be implied.

Preflight and explicitly established phase references are fixed snapshots, retained separately by crew and source. Record conditions, quality and per-metric timestamps. Unreliable comparisons ask for matching-condition repeats rather than appearing as concerning trends. Do not normalize deterioration automatically, or infer muscle loss from leg silhouette.

Use transparent daily recommendations to help allocate limited attention and time. Shared headache reports may prompt review of current cabin readings and the onboard procedure, without attributing causation or substituting archived NASA telemetry for current measurements. Evaluate task time and omitted steps through the protocol in [workflow-evaluation.md](research/workflow-evaluation.md); no user-study results currently exist.

1. The body is the navigation. Anything not reachable from the body is secondary.
2. Show what is known, what is not, and when. Never guess a missing value.
3. One action per view. Fewer words beat explanation.
4. Self versus self. A baseline from your own history, kept separate from simulated data.
5. Nothing leaves the device unless the crew downloads it.

### Continuing care and measurement evidence

The handoff recipient label is **medical team**. A saved care record needs an observation, procedure status/version when known, next check/time and information gaps. Append reassessments to the original packet; retain earlier observations and plans. Keep crew and synthetic/personal sources separate. Link new values using their metric timestamps, not the date of a shared daily entry.

This static prototype has no transmission service. Describe local saves and file downloads plainly and never imply queued automatic sending, a connected ground link, a delivery receipt or reviewed ground instructions. Ground-response import remains a future feature.

The crew’s original movement videos are the primary visual evidence. Link reference recordings explicitly, show missing references and incompatible conditions, and keep synthetic pose animation and the public 4DGS technical model distinct. No real-participant measurements have yet been collected. The [human-study kit](research/human-study/PROTOCOL.md) is a collection/analysis plan, not evidence of accuracy on people.

## Accessibility & Inclusion

Keyboard operation of the body map (every region reachable without a pointer), WCAG 2.2 AA automated checks with axe, reflow at 320 px, reduced motion, and forced colors. The existing Playwright accessibility suite must stay green.

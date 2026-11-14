# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

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

1. The body is the navigation. Anything not reachable from the body is secondary.
2. Show what is known, what is not, and when. Never guess a missing value.
3. One action per view. Fewer words beat explanation.
4. Self versus self. A baseline from your own history, kept separate from simulated data.
5. Nothing leaves the device unless the crew downloads it.

## Accessibility & Inclusion

Keyboard operation of the body map (every region reachable without a pointer), WCAG 2.2 AA automated checks with axe, reflow at 320 px, reduced motion, and forced colors. The existing Playwright accessibility suite must stay green.

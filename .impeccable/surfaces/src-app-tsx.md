---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: []
---

# Surface brief: GhostPilot app shell (body index)

Scope: the whole app (single-page React shell in src/App.tsx). Mode: Operate.
Audience: astronaut doing a quick self-check; flight surgeon receives the export.
Task: tap a body region, run that region's checks, see self-vs-ghost trend, save a handoff.
Constraints: fewer words, no tooltips, keyboard-reachable regions, offline, 1024x600 to 320px.
Chosen direction: Crew Procedure Card (user pick from the decision round, 2026-11-14).
Memorable moment: the Blender body as a lettered crew index; the picked region fills amber and its procedure card slides in with numbered, timed checks.
Unresolved: none blocking.

## Direction contract

THESIS: Each body region is a tabbed crew procedure card: lettered index, numbered timed steps, caution notes. Refuses the dark holographic body-scan dashboard and the rounded wellness-tile grid.

OWN-WORLD: Matte card stock #f4f1e8 panels on a slate binder ground #5b6770, black ink #111 text and 1.5px rules, black top bar. Caution amber #e0a100 for notes and the selected region; red #c8102e only for the primary Begin action and alerts. Hazard tab inks: radiation #8e2a8b, isolation #2e6f9e, distance #1f7a5c, gravity #b5651d, closed environment #0f7c86. Barlow Condensed uppercase for labels, numbers, headings; Barlow for body. Square check boxes; diagonal hatching marks "needs instrument".

STORY: The crew member sees their body, notices a flagged region, taps it, runs the 20-60 s checks listed on its card, sees today against their ghost, and saves an onboard handoff for the surgeon.

FIRST VIEWPORT: Black top bar: GHOSTPILOT, nav Body / Trends / Handoff / Mission, right: SOL and one-way delay. Left ~40%: card-stock "Crew body index" with the rotating 3D body, lettered region tags (A Head ... J Cabin). Right ~60%: procedure card for the selected region: hazard tab strip on its left edge, "PROCEDURE C.1 · REGION" kicker, condensed title, amber NOTE when a flag exists, numbered check rows (name, time, state box), red BEGIN at the bottom.

FORM: Crew Procedure Card, IMPECCABLE'S PICK (position 1 of my grounded list), seed:b51f5b33b472a2af. Signature move: the body as a lettered crew index whose picked region fills amber and opens its card.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

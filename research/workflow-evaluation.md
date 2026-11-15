# Workflow evaluation — hackathon prototype

The challenge loop is **gather → understand and evaluate → act**. Emergency response is independent of the ghost and never needs baseline collection first. These features are functional demonstrations, not validated clinical decision support.

## What the build demonstrates

- The permanent Emergency control opens an offline package (`GP-COLLAPSE-DEMO`, v0.1.0), with one question/instruction at a time, append-only timestamped events, resource-dependent instructions, reassessment, resumption after reload and a handoff download while care continues.
- No clinician-reviewed mission procedure was supplied. Review status is `draft — clinician review required`; clinician and review date are null. The UI and every export identify this limitation. Publishing an AHA reference does **not** constitute clinician review or approval of the workflow. The procedure snapshot stays with the incident even if a later software build changes the package.
- Each measured metric retains its own timestamp, phase, activity/timing and quality. Camera metrics also retain camera setup, posture/restraint, lighting, clothing, confident frame count and scan spread when available. Conditions are crew-entered, not automatically verified. Shoulder quality requires ten confident frames per side. Leg quality requires eight accepted frames and at most 8% frame spread, an illustrative repeatability filter, not a validated accuracy estimate.
- Fixed phase references are explicitly established with a reason. At least one metric needs three good, matching readings. Preflight and other references remain intact; the app refuses replacement of an existing phase reference. No rolling reference absorbs gradual deterioration. Three independent later, matching readings are required for a trend; unknown, poor or different conditions suppress the flag. The same rules feed body cards, Trends and handoffs.
- The daily panel ranks acute reports, failed recordings, unreliable camera comparisons, old readings, missing readings and remaining daily checks. Time and camera availability filter routine checks. Acute escalation remains available in the permanent header. A recommendation opens the specific check and gives its reason.
- Headache reports from two distinct crew members within 24 hours prompt cabin review. Newer reports of no headache resolve that person’s contribution. Demo and personal reports never mix. Manually entered current cabin readings include observation time and sensor/location; readings over an hour old ask for refresh. NASA RR-3 telemetry remains explicitly archived 2016 context and is never treated as current cabin exposure. The bundled cabin procedure is also an unreviewed demonstration.

## Evidence and scientific limits

- [NASA: leg volume changes and fluid shifts](https://ntrs.nasa.gov/citations/19880025740). Leg outline alone cannot establish muscle loss; no muscle-loss diagnosis follows a narrowed silhouette.
- [NASA: Carbon Dioxide technical brief](https://www.nasa.gov/ochmo-tb-004-carbon-dioxide-2/). Supports a symptom-cluster review prompt; it also discusses fluid shifts, susceptibility and local CO₂ variation. The app makes no causal attribution and supplies no exposure threshold.
- [AHA: cardiac arrest recognition](https://www.heart.org/en/health-topics/cardiac-arrest/about-cardiac-arrest). Supports general recognition and early response. It does not validate microgravity technique or replace mission-approved medical instructions.

## Usability study to run

No human study has been conducted. Automated completion is not evidence of faster human assessment or better health outcomes.

Use a counterbalanced, within-person comparison: half start with body navigation, half with the daily recommendation. Give the same scripted crew state, equipment and time budget to both groups. Use a sandbox with synthetic records, not real medical emergencies.

| Task | Appropriate completion | Missed-step / interpretation errors |
| --- | --- | --- |
| New crewmate collapses; no history | Open emergency response, activate onboard response, record observations and continue the appropriate branch | Attempting baseline collection first, waiting for ground, treating the demo as an approved procedure |
| Four confident shoulder frames | Repeat shoulder recording under documented conditions | Treating the missing/poor angle as loss of function; selecting an unrelated check |
| Leg outline differs after a camera or phase change | Identify comparison as unreliable; repeat with matching conditions or explicitly establish the appropriate phase reference | Diagnosing muscle loss; overwriting preflight; normalizing unexplained deterioration |
| Two crew headache reports | Review current cabin measurements, sensor/time/location and relevant onboard procedure | Treating archived RR-3 CO₂ as current exposure or proving causation from the cluster |
| Delayed link | Download the current handoff with observations and timestamps | Assuming it has been transmitted; stopping documentation while waiting |

Measure time from task presentation to the appropriate check, time to a saved interpretable result, incorrect checks opened, omitted required steps, abandoned checks, and whether participants correctly explain uncertainty and the next action. Report medians and ranges, paired differences, and errors per task; retain failures rather than dropping slow or incomplete trials. A small convenience sample is formative feedback, not clinical validation.

`MissionState.checkRuns` records recommendation starts, reasons, completion timestamps and abandoned attempts by crew and source. Ground JSON includes these events; unfinished attempts are preserved. Use an observer’s task sheet or screen recording (with consent) for the body-navigation comparison and missed clinical/procedural steps; the app does not infer that clicking a button proves care was performed. Camera runs always belong to personal records, even when launched while browsing the demo.

Automated regression checks cover branching, offline resumption and exports, reference preservation and sample independence, condition/quality gating, recommendation priority and availability, and bounded crew symptom clusters. The browser suite checks the actual UI along with axe, keyboard access, small-screen reflow and existing camera flows.

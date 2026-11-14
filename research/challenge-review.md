# Challenge review · 13 November 2026

The full team-supplied challenge text is now preserved in [the challenge brief](challenge-brief.md). Read it directly for the Background, Objectives, and Potential Considerations; the notes below retain the earlier research and implementation history.

Update, 14 November 2026: the user has now supplied five NASA/CSA resource URLs and the NASA-resource eligibility statement. All five pages were read and followed into relevant research and data portals; see [the detailed resource review](nasa-csa-resource-review.md). The application now uses 22 cited resources. The official Resources tab remains inaccessible, so its exact membership is still unverified. The earlier access notes below describe the previous investigation.

## What was retrievable

The search index exposed the official 2026 challenge summary at:
https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/

Its stated aim is software that collects health indicators and enables astronauts to assess and act on their health during long missions. It names radiation, isolation/confinement, altered gravity, and a hostile closed environment, with examples including immune, skeletal, cardiovascular, and behavioral health concerns.

Direct reads of both `?tab=details` and `?tab=resources` failed through the web reader and its alternate search connector. Direct HTTPS retrieval also failed certificate validation, and the browser connector was unavailable. Certificate validation was not disabled. The accessible indexed page showed only the challenge summary and Details navigation. **The full Details content and Resources-tab contents were not verified.** No source below is represented as a verified challenge-tab resource or challenge-provided dataset. A text-link clarification was requested while implementation continued.

## Independently verified NASA primary sources

1. [Five Hazards of Human Spaceflight](https://www.nasa.gov/hrp/hazards/). Provides the five categories, including distance from Earth, and explains that hazards can interact.
2. [Risks of Human Spaceflight](https://www.nasa.gov/hrp/risks/). Distinguishes exposure hazards from health/performance risks.
3. [Human System Risk Board](https://www.nasa.gov/directorates/esdmd/hhp/human-system-risk-board/). Describes tracing contributing factors and considering evidence in context. GhostPilot does not reproduce a validated NASA risk DAG.

## Implementation decision

### Supplied challenge text and audience clarification

The user subsequently supplied the full Background, Objectives, and Potential Considerations text and clarified the NASA staff audience. That supplied text establishes the astronaut self-assessment workflow, examples of health indicators, and a need for clear guidance and at-a-glance presentation. It does not supply the Resources tab. The interface now explicitly addresses crew self-assessment and flight surgeon review, with a compact observations summary and accessible check-in. Missing blood pressure, glucose, temperature, and sleep-duration measurements are stated rather than inferred from unrelated observations. Sleep quality remains a subjective score, not hours slept.

Add a Mission Lens: a navigable five-hazard context map with chronological observation replay, source links, explicit measurement gaps, and locally retained handoff packets for delayed communication. It advances the challenge's observe–evaluate–act loop while preserving the existing movement diary and attention check.

The map is a monitoring-coverage view, not a clinical risk score. Radiation and closed-environment nodes stay unmeasured because no corresponding sensor or medical data is collected. Pose and attention observations are never used to infer radiation injury, immune status, or bone density. Historical views exclude future observations and later actions, while current handoffs include decisions made after the last check-in. Simulated and recorded sources stay separate.

The communications blackout and adjustable latency are planning exercises. Packets are stored and downloaded; they are never shown as sent and no remote endpoint receives them.

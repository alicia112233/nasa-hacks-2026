# Judging rubric and submission questions

Supplied by the team on 14 November 2026. The team handles **Presentation** itself. Every change to GhostPilot should keep the other four criteria (Impact, Creativity, Validity, Relevance) at or moving toward a score of 5.

## Rubric (verbatim)

### Impact

This project makes an impact by addressing either a minor or major problem, which influences the quality and quantity of its overall effect. The extent to which it inspires or helps others varies, ranging from a broad audience to a select few.

**Score of 5 (Outstanding Impact):** This project demonstrates exceptional impact, addressing a significant problem with proposed solutions. Its reach is extensive, inspiring, benefits a large audience, or could change the world. The quality and effectiveness of the project far exceeds expectations, setting a high standard for others.

### Creativity

This project demonstrates originality and innovation. It introduces a novel concept that has not been attempted before or presents an improvement upon existing ideas in a meaningful way. This project is distinguished by its level of creativity, showcasing a fresh perspective or inventive execution.

**Score of 5 (Highly Creative and Innovative):** This project showcases remarkable creativity, introducing a groundbreaking approach that has never been attempted before. It challenges conventional methods, presenting an original and inventive proposed solution that stands out in its field. The uniqueness of the idea makes it a true innovation.

### Validity

This project presents a proposed solution that is grounded in scientific principles and demonstrates technical, functional, or logical feasibility. It is designed to effectively achieve its intended purpose and has the potential to function in real-world applications. The completeness of the proposed solution varies—it may be fully developed or still require significant refinement. Additionally, the usability and user-friendliness of the project influence its practicality and accessibility.

**Score of 5 (Highly Valid and Feasible):** This proposed solution is scientifically sound and technically feasible, demonstrating strong alignment with established principles. It is fully developed and ready for real-world implementation, effectively achieving its intended purpose. The project is highly usable and user-friendly, making it accessible and practical for widespread application.

### Relevance

This project fully and directly addresses the challenge for which it was submitted, demonstrating a strong alignment with the intended objectives. It meaningfully integrates NASA data, utilizing it as a core component of the proposed solution rather than a superficial addition. The depth of engagement with the data enhances the project's credibility and effectiveness.

**Score of 5 (Highly Relevant and Strong NASA Data Integration):** This project thoroughly engages with the challenge, delivering a proposed solution that is deeply connected to the intended goals. NASA data is integral to the project's success, providing meaningful insights that drive the innovation forward. The use of data is well-executed, enhancing both the credibility and impact of the solution.

### Presentation (handled by the team)

The team effectively communicated their project, clearly conveying the challenge, their proposed solution, and its significance. The storytelling was engaging and well-structured, ensuring the audience understood the project's purpose and impact. The clarity, organization, and delivery of their presentation played a key role in making their ideas compelling and clear. Judges evaluate the demo and full project to compute this score.

**Score of 5 (Exceptional Communication and Storytelling):** The team delivered a well-structured and compelling presentation, clearly articulating the challenge, proposed solution, and importance of the project. Their storytelling was engaging, allowing the audience to fully grasp the significance and potential impact of the work. The delivery was polished, structured, and highly effective in communicating their ideas.

## Submission questions

1. What does your project do, and how does it work?
2. What benefits does it have?
3. What is the intended impact?
4. What tools did you use?
5. How is your project creative?
6. What factors did your team consider?

### Draft answers (from the current build; revise as the project changes)

**1. What it does and how it works.** GhostPilot is an offline-first crew health companion for long-duration missions. A full human body, built in Blender from the CC0 MakeHuman model and posed to NASA's measured 0g neutral body posture, is the navigation. It is shaped to the crew member through Scan me and a profile popup opened from the crew menu: a 5-second on-device camera scan reads body shape, build and weight (shape and build are confirmed by the crew member), and height is the only number typed. It shows NASA's documented 0g changes (+3% stature from spinal elongation, fluid shift) next to the preflight body. Tap one of nine regions (head, eyes, chest, abdomen, arms, hands, back and pelvis, legs, cabin) to open a crew procedure card. Each card lists that region's timed checks, traced to NASA's 17 named spaceflight risks and five hazards: a 60-second attention task, short self-reports and symptom checks, heart rate, exercise, a camera shoulder-range check, and a camera leg-outline scan (MediaPipe, local). The same scan that shaped the body becomes the Legs check, tracking thigh breadth against the crew member's ghost and against the 0g fluid shift NASA's handbook predicts. Each crew member is compared with their own earlier baseline (the "ghost"). Trend flags turn regions red, reported symptoms turn them amber, and unmeasured regions are hatched. The cabin region shows real NASA ISS radiation dose and habitat CO₂/climate data. Handoffs for the flight surgeon are stored on board during delays or blackouts and exported as Markdown/JSON.

**2. Benefits.** It runs fully offline with no cloud, account, or paid service. Records stay on the device in IndexedDB. Each person is compared only with themselves, never with a population "high score." Missing measurements are shown instead of being guessed. Simulated and personal data never mix. Handoffs keep their original cutoffs and research citations, so ground teams can trace each observation. The app is keyboard-navigable, has been checked with axe, works on screens from 320 px wide up to desktop, and supports reduced motion and forced colors.

**3. Intended impact.** Artemis and Mars crews will have up to 20-minute one-way communication delays and limited medical support (NASA distance hazard). GhostPilot supports crew autonomy: the crew notices small changes early, reflects, acts, and hands traceable evidence to the ground. The same pattern applies on Earth to Antarctic stations, submarines, offshore and remote workers, and low-connectivity telemedicine, where people have to self-monitor without a clinician nearby.

**4. Tools.** React 19, TypeScript, Vite, Three.js, Spark (Gaussian splatting), Recharts, MediaPipe Tasks Vision (Pose Landmarker), IndexedDB, a service worker for offline use, Playwright with axe-core for testing, and Python (torch, numpy, scipy) for the 4DGS exporter. Resources include NASA HRP (five hazards, risks, ongoing research, investigations such as ARCHeR, CIPHER, Zero T2, Immune Biomarkers, and Tempus Pro), CSA (CANS and Radi-N2), and NASA data portals (RadLab, Environmental Data App, OSDR, NLSP). Design tooling: Impeccable. 3D tooling: Blender 5.2 driven by script over the Blender MCP add-on, with the MakeHuman (MPFB 2) CC0 base mesh, macro targets and rig weights; Blender also renders the body-scan calibration frames, measured with the app's own MediaPipe model. NASA Human Integration Design Handbook (NASA/SP-2010-3407/REV1) Figure 4.3-2 and Table 4.3-4 for posture and 0g body changes.

**5. Creativity.** The body is the interface: a Blender-built human in NASA's measured microgravity posture, shaped to the crew member by a camera body scan, and lettered like a crew procedure index. One scan does two jobs: it shapes the body, then tracks leg-outline changes as a check (a silhouette alone cannot establish muscle loss), closing the loop with the Preflight / Sol body. A Preflight / Sol toggle shows how weightlessness changes the body (taller by 3%, thinner legs, fuller face), using NASA's handbook figures. Regions carry NASA hazard tabs, and "not measured" is drawn as hatching rather than hidden. A "past self as an extra crewmate" baseline replaces population norms. Store-and-forward blackout handoffs, and a genuine trained 4D Gaussian splat as a movement reference, round it out.

**6. Factors considered.** Communication delay and blackouts, offline operation, privacy and local storage, keeping simulated and personal data separate, honest uncertainty (no diagnosis, no single health score, prototype thresholds labeled), comparable recording conditions across gravity environments, accessibility (WCAG 2.2 AA automated checks, small screens, reduced motion), provenance and licensing of models and sources, and the NASA-resource requirement for Global Award eligibility.

## Current self-assessment against the four judged criteria

Updated 14 November 2026 after the anatomical body rebuild.

| Criterion | Strengths now | Remaining gaps |
| --- | --- | --- |
| Impact | Crew autonomy under communication delay. Blackout handoffs. A whole crew can share one device, each with their own body, ghost and handoffs, named in the top bar on every page. One-tap path from "how am I?" to a check and a handoff. Earth analogs (Antarctica, submarines, remote telemedicine) still need to be shown. | Earth-analog story is not in the app. No user testing with crew or clinicians. |
| Creativity | An anatomical Blender body as the navigation, posed to NASA's 0g neutral body posture and shaped to the crew member's profile and an on-device body scan. Preflight vs in-flight body toggle. Regions lettered like a crew procedure index. "Not measured" drawn as hatching. Your past self as the ghost baseline. Real trained 4DGS kept as a reference view. | The scan is calibrated and validated on rendered bodies, not measured people (see [body model notes](body-model.md)). 4DGS still shows a public humanoid. |
| Validity | All 17 NASA HRP risks mapped to checks (unit-tested). Instrument-only checks labelled honestly. Deterministic, tested trend rules. Posture and 0g body changes are taken from NASA HIDH figures, and the build script records them. The body scan is calibrated with the app's own pose model on 300 Blender frames. On 8 held-out bodies it guesses sex 8/8 and build 7/8, with no confident wrong guess, and it reads HIDH's fluid shift as −5.5% thigh breadth (handbook: up to −6%). 31 browser tests and 30 unit tests, including offline, privacy, axe WCAG 2.2 AA, reflow at 9 viewports, profile-to-body morphs, and both scans on a rendered fake webcam. | Thresholds and self-check wording are not clinically validated. The attention task is not benchmarked against PVT. |
| Relevance | Real NASA ISS data is now a core component: EDA RR-3 radiation dose and habitat CO₂/temperature/RH power the Cabin region and Mission page, with a reproducible extract and provenance. NASA risk pages are linked from every card. | Data is archival rodent-habitat telemetry, not crew data. A NASA Life Sciences Portal or OSDR human dataset would strengthen this further. RadLab was down (HTTP 500). |

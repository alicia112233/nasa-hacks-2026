# GhostPilot: seven-slide demo outline

Draft, 15 November 2026. Based on the current build (README, PRODUCT.md), [the challenge brief](challenge-brief.md) and [the judging rubric](judging-rubric.md).

## Submission rules this deck has to meet

From the Space Apps project submission guide (checked through search on 15 Nov 2026; the guide page itself would not load, so confirm against the 2026 version before submitting):

- The demo is **either** a video of up to 30 seconds **or** a deck of up to **7 slides, title slide included**.
- Host it publicly (Google Drive, Slides, YouTube and so on) and submit the link. Files can't be uploaded to the Space Apps site.
- The deck must be in English.
- The title slide shows the **team name, every team member's name and the challenge**.
- The demo must explain **how space agency open data and technology made the project possible**. Slide 5 covers this.
- Check the guide's AI-use section and disclose AI tools as it asks. We used Claude Code and the Impeccable design skill.

## Through-line

**"Your past self is the reference."** One reading travels through the deck: Alex Morgan's sleep drop, the same example the in-app tutorial uses. It goes **Spot → Check → Compare → Act**, which is the brief's loop of gathering indicators, evaluating them and acting on them.

Rubric coverage: Impact (slides 2 and 7), Creativity (slide 4), Relevance and NASA data (slide 5), Validity (slide 6), Presentation (the deck as a whole).

---

## Slide 1: Title

- **GhostPilot**
- Subtitle: *Crew health checks you navigate by body. Your past self is the baseline.*
- Challenge: **Health Monitoring Software**, NASA Space Apps 2026 (Human Exploration · Software · Space Exploration)
- Team: **WildBananaMilkTea** (Singapore) · Members: **Lin Junyu, Tang Wei Shan Alicia**
- Link or QR code to the live app and the repository

**Visual:** the Blender body in NASA's 0g neutral posture, Head region red, ghost outline behind it.

---

## Slide 2: The problem

- Long missions bring all five HRP hazards together: radiation, isolation, **distance from Earth**, altered gravity and a closed habitat.
- Mars means up to **~20 minutes one way**, plus blackouts. The flight surgeon can't answer in real time.
- The crew has to notice changes in themselves, but nobody can assume they know:
  **what to measure → how → what the result means → what to do next.**
- Population norms are a poor fit for a body that 0g has already changed.

**Visual:** the five hazards as icons and a delay bar running Earth → Moon (~1.3 s) → Mars (up to ~20 min).

**Speaker line:** "Up there, the astronaut is the first one who has to notice something is wrong."

---

## Slide 3: The loop in 90 seconds (core demo)

Four screenshots left to right, following Alex Morgan's sleep drop:

1. **Spot.** Today's rings (Physical 14 checks, Mental 6) show the next step, and **Head is red**.
2. **Check.** The Head card lists numbered, timed checks. Each has a one-line *How* and *Why*, plus guidance: **Watch / Tell surgeon / Act now**.
3. **Compare.** Trends: "Last 3 (S39–S41): 3/5. Ghost (S28–S38): 4/5. Change −25%", with the ghost window and last-3 window shaded on the chart.
4. **Act.** Report: the whole day on one page. Hand it off with a note, saved on the device for the next comms window, or save it as a PDF.

**Caption:** *From "how am I?" to a saved handoff in about two minutes.* (This is a design target; we haven't timed it with users.)

---

## Slide 4: The body is the interface (Creativity)

- A human body **built in Blender from CC0 MakeHuman** and posed to **NASA's measured 0g neutral posture** (HIDH Fig. 4.3-2).
- **Scan me:** a 5-second on-device camera scan fits the figure to the crew member. Height and mass are typed, because a camera can't measure either.
- **Preflight / Sol toggle** shows how 0g changes the body: **+3% stature** and the fluid shift that thins the legs and fills the face (HIDH Table 4.3-4).
- **One scan does two jobs:** it shapes the body, then becomes the Legs check (thigh breadth against the ghost).
- Nine lettered regions read like a crew procedure index. **Red** means an alert, and **hatched** means not measured onboard. Hatching is shown, never hidden.
- The **ghost** is your own earliest readings or a fixed preflight snapshot, never a high score.

**Visual:** split image of the Preflight and Sol bodies (e.g. 168 cm → 173 cm), plus a scan frame with the measuring lines drawn on.

---

## Slide 5: Built on NASA science and data (Relevance; required content)

- **All 17 NASA HRP risks** map to a body region and a check, and each check links its NASA risk page. A unit test fails if any risk loses coverage.
- **The five hazards** appear as coloured tabs on every check.
- **Real ISS data in the Cabin region:** NASA OSDR Environmental Data App, Rodent Research-3 (ISS, 2016)
  - 43 days of absorbed dose: **0.227 mGy/day median, 9.9 mGy accumulated** (GCR and SAA split, analysed by JSC SRAG)
  - 50 days of habitat **CO₂ (median ~3,659 ppm)**, temperature and humidity
  - Reproducible extract with source URL, retrieval time and SHA-256
- **NASA Human Integration Design Handbook** supplies the body posture and 0g changes.
- **22 NASA and CSA sources** (ARCHeR, CIPHER, Immune Biomarkers, Tempus Pro, CSA CANS, Radi-N2) are bundled offline and included in every export.

**Honesty line on the slide:** *Archived mission context, never a personal reading, and never part of a ghost.*

**Visual:** risk → region → check mapping (a small slice of the Risks page), plus the Cabin dose chart.

---

## Slide 6: Feasible and honest (Validity)

- **Offline-first:** a static web app with no backend, account or cloud. Records stay on the device, and pose detection (MediaPipe) runs locally.
- **Store-and-forward handoffs.** They are saved and downloaded, never shown as sent, because we have no ground link and don't pretend to.
- **Scan calibrated on 300 Blender renders**, scored on 8 held-out bodies:
  - body shape right 8/8, build 7/8, no confident wrong guess
  - reads the 0g fluid shift as **−5.5% thigh breadth** (handbook figure: up to −6%)
- Instrument-only checks (OCT, DXA, blood pressure cuff, dosimeter, lab samples) are **labelled with what they need**, not faked.
- Automated tests cover offline use, privacy, the scan on a fake webcam and **WCAG 2.2 AA** checks.
- **Limits stated plainly:** the thresholds are illustrative, the sample crew's history is synthetic, there has been no human study yet, and the app does not diagnose.

**Tools strip (footer):** React · TypeScript · Three.js · Blender 5.2 · MediaPipe · Recharts · IndexedDB · service worker · Playwright and axe · Claude Code and Impeccable

---

## Slide 7: Impact and what's next

- **In space:** crew autonomy for Artemis and Mars. The crew notices small changes early, acts, and hands **traceable** evidence to the medical team.
- **On Earth:** the same pattern fits Antarctic stations, submarines, offshore and remote workers, and low-connectivity telemedicine.
- **Next:**
  1. Human repeatability pilot. The protocol and analysis script are already written.
  2. Clinical review of the thresholds and guidance with flight surgeons.
  3. Connect onboard instruments (blood pressure cuff, dosimeter, ultrasound).
  4. Import reviewed ground responses into the handoff thread.
- Closing line: **"Know your normal. Spot the change. Act early."**
- QR code to the live demo (ghostpilot-lovat.vercel.app) and the repository link

---

## Screenshots to capture

Use the sample crew. Restore it from Sources if anyone was removed.

| Slide | Screen | Setup |
| --- | --- | --- |
| 1 | Body page, Today | Alex Morgan, Head red |
| 3 | Today rings · Head card · Trends (Sleep) · Report | Alex Morgan, today |
| 4 | Preflight / Sol toggle · Scan result | any member with a scan |
| 5 | Risks page · I Cabin dose and CO₂ charts | n/a |
| 6 | A hatched instrument-only check (e.g. Eyes → OCT) | n/a |

## Check before submitting

- Fill in the team name and member names on slide 1.
- Confirm the 7-slide limit and AI-disclosure rules in the 2026 submission guide.
- Don't claim user testing, clinical validation or astronaut feedback. None of these exist.

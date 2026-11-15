# GhostPilot

### Crew health checks you navigate by body. Your past self is the baseline.

**NASA Space Apps 2026 · Health Monitoring Software** (Human Exploration · Software · Space Exploration)

**Team:** WildBananaMilkTea · Singapore
**Members:** Lin Junyu · Tang Wei Shan Alicia

github.com/alicia112233/nasa-hacks-2026 · Live demo: ghostpilot-lovat.vercel.app

[Image: deck-assets/body-alerts.png]

---

# The astronaut has to notice first

Radiation · Isolation · Distance from Earth · Gravity · Closed habitat

- **5:** NASA hazards act on a long-mission crew at the same time
- **~20 min:** one-way signal delay to Mars, plus blackouts
- **17:** named NASA health risks, from bone loss to sleep

We can’t assume a crew member knows **what to measure, how to measure it, what the result means or what to do about it.** And population norms fit poorly on a body that zero-g has already changed.

*Sources: NASA HRP hazards and risks*

---

# Spot → Check → Compare → Act

One reading, start to finish (sample crew member Alex Morgan, synthetic history).

1. **Spot: Today shows what’s red.** Two rings count today’s checks. The Head region turned red because Alex’s sleep dropped. [Image: deck-assets/today.png]
2. **Check: every check says how and why.** Numbered, timed checks. An alert lists up to three plain next steps. [Image: deck-assets/head.png]
3. **Compare: you against your ghost.** Last 3 nights 3/5 against a ghost of 4/5: −25%. The chart shades both windows. [Image: deck-assets/trends.png]
4. **Act: hand off once a day.** One report labelled Watch, Tell surgeon or Act now, saved for the next comms window. [Image: deck-assets/report.png]

*Real app screens. The design target is about 2 minutes; we haven’t timed it with users yet.*

---

# The body is the interface

- **Posed like a body in zero-g:** built in Blender from CC0 MakeHuman, posed to NASA’s neutral 0g posture (HIDH Fig. 4.3-2).
- **Shaped to you in 5 seconds:** Scan me fits the figure on the device. Height and mass are typed, because a camera can’t measure them.
- **One scan, two jobs:** it shapes the body, then tracks thigh breadth as the Legs check.
- **Red alerts, hatched gaps:** nine lettered regions. What can’t be measured onboard is shown, never hidden.

Preflight 168 cm → Sol 42 in zero-g 173 cm (+3% stature, fluid shift: NASA HIDH Table 4.3-4)

[Image: deck-assets/preflight.png] [Image: deck-assets/sol.png]

---

# Built on NASA science and data

**How NASA open data and science made it possible**

- **17/17** NASA HRP risks mapped to a body region and a check. A test fails if one loses coverage.
- **43 days** of ISS radiation dose in the Cabin region, from NASA OSDR’s Environmental Data App
- **22** NASA and CSA sources, bundled offline and cited in every export
- **HIDH:** NASA’s design handbook sets the zero-g posture and body changes

Rodent Research-3, ISS 2016: **0.227 mGy/day** median dose and **9.9 mGy** over 43 days (cosmic rays and South Atlantic Anomaly split, analysed by NASA JSC SRAG). Habitat CO₂ median **3,659 ppm**, plus temperature and humidity.

*Archived mission context, never a personal reading, and never part of a ghost.*

[Image: deck-assets/dose.png]

---

# Feasible today, honest about limits

**Offline: nothing leaves the device**
- Static web app with no backend or account. It works offline after the first load.
- Records stay on the device, and pose detection runs locally.
- Handoffs are saved and downloaded, never shown as sent.

**8 / 8: body shapes guessed right**
- Scan calibrated on 300 Blender renders and tested on held-out bodies.
- Build right 7 of 8, with no confident wrong guess.
- Reads the zero-g fluid shift as −5.5% thigh breadth (handbook: up to −6%).

**Honest: limits stated, gaps shown**
- Checks that need kit (OCT, DXA, cuff, dosimeter, labs) say so.
- Thresholds are illustrative, not clinically validated.
- Sample history is synthetic, and no human study has run yet. It never diagnoses.

*React · TypeScript · Three.js · Blender 5.2 · MediaPipe · Recharts · IndexedDB · Playwright + axe (WCAG 2.2 AA) · Claude Code + Impeccable*

---

# Know your normal. Spot the change. Act early.

**Try it live:** ghostpilot-lovat.vercel.app [Image: deck-assets/qr-demo.png]

**In space:** more crew independence on Artemis and Mars missions. Crews notice changes early, act, and hand traceable evidence to the medical team.

**On Earth:** Antarctic stations, submarines, offshore crews and low-connectivity telemedicine.

**Next**
1. Human repeatability pilot (protocol ready)
2. Clinical review with flight surgeons
3. Connect onboard instruments
4. Import replies from ground

WildBananaMilkTea · Lin Junyu · Tang Wei Shan Alicia · github.com/alicia112233/nasa-hacks-2026

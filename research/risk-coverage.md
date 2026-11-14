# NASA risk coverage and link check · 14 November 2026

GhostPilot's body index has to reach every health risk NASA's Human Research Program names. This note records the risk list, how each risk maps to a body region and check, and the result of checking every external link.

## Source list

[Risks of Human Spaceflight](https://www.nasa.gov/hrp/risks/) (page last updated 21 July 2026) names **17 risks** in three groups: human physiology (11), behavioral performance and human factors (5), and space radiation (1). [The five hazards](https://www.nasa.gov/hrp/hazards/) are radiation, isolation and confinement, distance from Earth, gravity fields, and hostile/closed environments. The registry lives in `src/body.mjs`, and `tests/body.test.mjs` fails if any risk loses its check.

## Mapping

| NASA risk | Hazard(s) | Region | Check | Kind |
| --- | --- | --- | --- | --- |
| Altered immune system responses | Closed habitat | F Hands | Rash or cold sore; blood and saliva markers | Self-check + instrument |
| Altered sensorimotor and vestibular function | Gravity | A Head | Dizziness or poor balance | Self-check |
| Cardiovascular adaptations | Gravity, radiation | C Chest, H Legs | Resting heart rate; short of breath; blood pressure; leg outline (fluid shift) | Camera + self-check + instrument |
| Decompression sickness | Closed habitat | C Chest | Joint pain after a spacewalk | Self-check |
| Host–microorganism interactions | Closed habitat | D Abdomen, F Hands, I Cabin | Stomach upset; rash; cabin CO₂ and climate | Self-check + NASA data |
| Hypoxia | Closed habitat | C Chest, I Cabin | Short of breath; cabin CO₂ and climate | Self-check + NASA data |
| Inadequate food and nutrition | Distance | D Abdomen | Appetite and meals; body mass | Self-check + instrument |
| Injury and compromised performance from spacewalks | Closed habitat, gravity | C Chest, E Arms, F Hands | Joint pain; shoulder range; fingertip or grip pain | Self-check + camera |
| Reduced cardiorespiratory and musculoskeletal fitness | Gravity | E Arms, G Back & pelvis, H Legs | Shoulder range; back pain; exercise minutes; leg outline (thigh breadth vs ghost) | Camera + self-check |
| Spaceflight-associated neuro-ocular syndrome (SANS) | Gravity | B Eyes | Blurred or changed vision; eye imaging (OCT) | Self-check + instrument |
| Spaceflight-induced bone changes | Gravity | H Legs | Exercise minutes; bone density (DXA) | Self-check + instrument |
| Behavioral conditions and psychiatric disorders | Isolation, distance | A Head | Attention task; mood; energy | Task + self-check |
| Inadequate teamwork | Isolation | A Head | Crew working well together | Self-check |
| Inadequate sleep and irregular schedules | Isolation | A Head | Sleep quality; attention; energy | Self-check + task |
| Inadequate systems operations support | Distance | A Head | Workload; attention | Self-check + task |
| Injury from dynamic loads | Gravity | G Back & pelvis | Back pain; landing load check | Self-check + instrument |
| Radiation-induced cancers | Radiation | I Cabin | Radiation dose (NASA ISS record; needs personal dosimeter) | NASA data |

Radiation-induced cancer is the only risk with no meaningful onboard self-check. Self-reports and attention scores cannot establish a dose, so the cabin region shows NASA's archived ISS dose record and says a personal dosimeter is needed. The distance hazard also appears as the Handoff page's communication delay and blackout drill.

Self-checks are prompts for reflection and handoff, not diagnostic tests. A "mild blurred vision" report is not a SANS diagnosis.

## Link check

Checked on 14 November 2026 with HTTPS GET requests that followed redirects:

- All 17 NASA risk reference pages (`https://www.nasa.gov/reference/risk-…`) returned **200**.
- All five NASA hazard pages and the risks index returned **200**.
- 21 of the 22 earlier research sources returned **200**. The CSA "Why conduct science experiments in space?" page timed out once, then returned 200 on retry.
- **RadLab** (`visualization.osdr.nasa.gov/radlab/gui/overview/`) returned **HTTP 500** from NASA's server on repeated tries. The link stays in the registry, with that status noted. Radiation data now comes from the Environmental Data App instead.

## NASA data imported

`scripts/fetch-nasa-eda.py` downloads NASA OSDR's Environmental Data App dashboard for Rodent Research-3 (ISS, 8 April – 28 May 2016). It writes `public/data/nasa-eda-rr-3.json` with the source URL, retrieval time, SHA-256 of the downloaded page, and its transformations:

- 14,385 five-minute samples of habitat temperature, relative humidity and CO₂ (ISS unit and ground control), reduced to hourly medians.
- 43 daily absorbed-dose values in mGy/day (galactic cosmic rays, South Atlantic Anomaly, total, accumulated), analysed by NASA JSC's Space Radiation Analysis Group.

Key figures: median dose 0.227 mGy/day, 9.9 mGy accumulated over 43 days, median habitat CO₂ 3,659 ppm. The ground-control unit tracks the ISS CO₂ profile, so its median is almost identical. These are rodent-habitat sensor readings on the ISS, shown as archived mission context. They are not cabin air for a crew member and not anyone's personal dose, and they never enter a ghost baseline.

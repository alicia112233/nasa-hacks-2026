# Body model: sources, posture, personalisation and body scan · 14 November 2026

GhostPilot's body index is a real human mesh. It is posed to NASA's measured microgravity posture and shaped to each crew member. This note records where every part comes from, and how far a photo-based personal model could go.

## Sources

| Part | Source | Licence |
| --- | --- | --- |
| Base mesh, macro targets (sex, age, muscle, weight, proportions), measurement targets, default rig and skin weights | MakeHuman "hm08" assets, read from the [MPFB 2.0.18 extension archive](https://extensions.blender.org/add-ons/mpfb/) (SHA-256 `c075b3e9…2dad`) | Assets CC0 since September 2020 ([MakeHuman licence](https://static.makehumancommunity.org/about/license.html)). The MPFB add-on code (GPL) is neither installed nor run. |
| Posture | [NASA Human Integration Design Handbook](https://www.nasa.gov/wp-content/uploads/2015/03/human_integration_design_handbook_revision_1.pdf) (NASA/SP-2010-3407/REV1), Figure 4.3-2 "Neutral Body Posture in 0g" | US Government work |
| 0g body changes | Same handbook, section 4.3.3.3.6 and Table 4.3-4 "Anthropometric Changes in 0g" | US Government work |

## Posture (HIDH Figure 4.3-2, mean values)

- Head tilted 24° (±5) forward of the body-centred vertical.
- Shoulder flexed 36° (±19). Elbow included angle 122° (±24).
- Trunk–thigh angle 128° (±7). Knee included angle 133° (±8).
- Foot line 111° (±6) to the torso line, which is plantar flexed compared with standing.

`scripts/blender/build_body.py` aims each joint-to-joint line (shoulder→elbow, hip→knee, and so on) at these angles. It uses MakeHuman's own skeleton, refitted to every body shape, with linear-blend skinning on MakeHuman's weights. The figure is a mean, and individuals vary (HIDH; STS-57 found no single crew member matched it), so the model shows a typical posture, not a measured one.

## Zero-g changes shown by the Preflight / Sol toggle

| Change (HIDH Table 4.3-4) | In the model |
| --- | --- |
| Stature +3% from spinal elongation, in the first day or two, kept until return to 1 g | The spine bones lengthen by exactly 3% of the crew member's stature. Arms and head ride up with the shoulders and neck. |
| Fluid shift: lower-limb circumference down 0–6%, upper-torso circumference up, face puffy | Legs −6% radially about the femur and tibia, chest +2%, face +2.5 mm outward. These are illustrative points inside the handbook's range. |
| Mass loss up to 8% (largely prevented now) | Not modelled automatically. A lower mass in the profile shows it. |

## Profile → body (`src/physique.mjs`)

- **Sex** blends the female shape. Cross-term morphs keep heavy, light, muscular and slight shapes specific to each sex.
- **Height** scales the body to the stated stature (MakeHuman reference: male 172.4 cm, female 159.1 cm).
- **Mass** gives BMI, which is compared with an average-weight body (BMI 21.7). MakeHuman's weight macro spans 50–150% of average weight, so ±50% relative BMI is a full morph. This is approximate and only shapes a picture. It does not measure body composition.
- **Build** sets the muscular or slight shape at 0.7.
- Values outside 140–210 cm or 35–160 kg are ignored instead of distorting the body.
- The profile stays in IndexedDB on the device.

Each morph target is the posed difference between two MakeHuman shapes, each posed with its own fitted skeleton. That avoids the joint-pivot errors you get from posing every shape with one skeleton. The GLB carries 17 morph targets (2.6 MB). The shoulder, waist and hip measurement morphs, and the sex and build suggestions, come from the body scan.

## Body scan (`src/scan.mjs`)

One 5-second scan, used twice: once to shape the body, then repeatedly as the Legs check.

**What it measures.** MediaPipe Pose Landmarker (the bundled lite model, on the device) gives pose landmarks and a person mask for each camera frame. Breadths are read from the mask along lines square to a body axis and divided by torso length (shoulder midpoint to hip midpoint), so distance from the camera cancels out:

| Measure | Line |
| --- | --- |
| Shoulders | widest line within 5% of torso length of MediaPipe's shoulder points (across the deltoids) |
| Waist | mean width 55–85% of the way down the torso |
| Hips | mean width 90–110% of the way down, around the hip points |
| Thighs | mean width square to each thigh, 30–50% of the way from hip to knee, never past the body midline |
| Upper arms | mean width square to each upper arm, 45–65% of the way to the elbow; the inner half is capped at 1.25 times the outer half, so an arm against the chest isn't read as chest |

A scan keeps the median of at least 8 usable frames over 5 seconds (up to 15). A frame is refused when the head or ankles are out of view, an elbow or wrist touches the torso outline, the torso leans more than 12°, or the arms are outside 15–45° from the torso line. The outline's height in pixels, with the crew member's stated height as the ruler, turns thigh breadth into centimetres. Only ratios, the arm angle and the frame count are stored. No image or video is kept, and clearing personal records removes the scan.

**Setup scan: body shape, build and weight (`detectShape` in `src/physique.mjs`).** It runs from Scan me above the body: the camera starts at once, and the scan starts itself once the whole body has been in view for about a second. Nothing is typed first. Every combination of sex (female/male MakeHuman shape), build (slight/average/muscular) and nine weight levels is tried; a stated mass, if there is one, fixes the weight instead. Height is asked next, because it is the one thing a camera can't measure. The shoulder, waist and hip morphs absorb what's left, by least squares over all five measures, with a ±0.4 prior that keeps them small. The combination with the lowest misfit wins. A guess counts as sure only when it beats the best alternative by 4 squared standard deviations. The scan screen shows both as choices, pre-selected, labelled "From scan" or "Not sure", and the crew member confirms or changes them. This reads body proportions, not gender identity.

**Legs check.** Body → H Legs → Leg outline runs the same scan and saves thigh breadth (cm) to today's record. It then behaves like every other check: a ghost from the earliest records, a flag at 5% or more below it (illustrative), a Trends row and handoff lines, and links to NASA's muscle-fitness and cardiovascular risks. The card notes that the zero-g fluid shift alone thins legs up to 6% in the first days (HIDH Table 4.3-4), the change the Preflight / Sol toggle shows.

**Calibration with the app's own model.** Joint positions from the skeleton were tried first. MediaPipe places its shoulder points about 10% of torso length higher than MakeHuman's shoulder joints, so that calibration would have read every scan as narrow-shouldered. Instead:

1. `scripts/blender/build_body.py` renders every basis shape (16) and 9 held-out bodies in the scan pose. It uses arm angles of 22°, 30° and 38°, from 4 camera positions: 2.3–2.9 m, plus a 1.7 m view that crops the feet. That makes 300 frames at 640 × 480, with a 45° vertical field of view, in Workbench, with simple skin, clothing, eyes and hair.
2. `scripts/calibrate-scan.mjs` runs the app's MediaPipe model on every frame in headless Chrome and measures it with `src/scan.mjs`. It fits the arm-angle slope within shapes, records each measure's scatter, and writes `src/body-calibration.mjs`.

**Tuning:**

- Most frame-to-frame scatter came from the cropped view. With the feet cut off, MediaPipe places the hips differently and every ratio shifts 1–4%, so the whole body must be in view.
- Waist and hip widths averaged over a band were steadier than the narrowest or widest line.
- At arm angles near 22°, heavier bodies' arms meet the chest, which inflated the arm reading until the inner half was capped.
- The fit weights were chosen on the held-out bodies: measurement scatter taken as 2.5× the render scatter (real scans are noisier), and a ±0.4 morph prior. That traded some morph accuracy for never being confidently wrong.

**Validation on bodies left out of the calibration** (`tests/fixtures/scan-holdout.json`, checked by `tests/scan.test.mjs`). Profiles are 170 cm, with the mass that matches each body's weight; the scan never sees the true sex or build.

| Held-out body | Guessed (? = not sure) | Morphs expected → recovered (shoulders, waist, hips) |
| --- | --- | --- |
| Woman, heavier | female, average? | 0, 0, 0 → −0.05, −0.01, 0.01 |
| Man, average, shoulders +0.5, hips −0.5 | male, average? | 0.5, 0, −0.5 → 0.24, −0.09, −0.42 |
| Woman, muscular, waist −0.6 | female, muscular? | 0, −0.6, 0 → −0.01, −0.25, −0.01 |
| Man, slight, lighter | male, slight? | 0, 0, 0 → 0.01, −0.31, −0.30 |
| Woman, slight, hips +0.4 | female, slight | 0, 0, 0.4 → −0.09, 0, 0.38 |
| Man, muscular, heavier | male, average? (true: muscular) | 0, 0, 0 → 0, −0.04, −0.10 |
| Woman, lighter, shoulders +0.4 | female, average? | 0.4, 0, 0 → 0.24, −0.09, −0.04 |
| Man, heavy, waist +0.5 | male, average? | 0, 0.5, 0 → −0.05, 0.19, 0.01 |

**Results:**

- **Without mass (camera only, as in the crew card):** sex 8 of 8 and all sure, build 6 of 8 (all marked not sure), and weight within 0.35 of the true heavy/light morph (mean error 0.07).
- **Body shape and build with mass stated:** sex 8 of 8, build 7 of 8. The one wrong build was marked not sure, so no guess was confidently wrong.
- **Morphs:** shoulder, waist and hip morphs recovered to within 0.35. Recovered values lean toward zero, by design of the prior.
- **Legs:** the reference body with HIDH's fluid shift reads −5.5% thigh breadth (the model applies −6%). Thigh breadth for one body repeats to ±0.16 cm (15.3 cm mean) across camera positions and arm angles.
- **Cropped frames:** all 75 frames with the feet cropped were refused.
- **End to end:** `tests/browser/scan-video.spec.ts` feeds a rendered reference body to Chrome as a fake webcam and runs both scans in the app, in video tracking mode. The setup scan picks the male shape with proportions within ±4%, fills the Crew form, then the Legs check saves thigh breadth. An axe check covers the result screen.

**Limits:**

- The calibration and validation bodies are rendered MakeHuman figures in fitted clothes, not measured people, so the numbers carry MediaPipe's behaviour on renders.
- Loose clothing or hair over the shoulders widens the outline.
- Build is often "not sure", by design.
- Thigh breadth is a front-view estimate, not a tape circumference. The Legs threshold is illustrative.
- The scan refines a picture and one trend; it is not an anthropometric or diagnostic measurement.

## Could the app analyse a real person and build their body?

Yes, in steps. The recommended path keeps everything on the device:

1. **Profile (done).** Typed measurements drive morphs in the browser. No per-person Blender run is needed, which suits an offline spacecraft tablet.
2. **On-device body scan (done).** A 5-second front-facing scan with the bundled pose model suggests body shape and build, drives the shoulder, waist and hip morphs, and becomes the Legs check, as described above. Nothing leaves the device.
3. **Tape measurements (optional, not built).** Chest, waist and hip girths map directly onto MakeHuman's measurement targets.

Cloud image-to-3D services were considered and rejected for crew use. Examples are the Higgsfield MCP server's image-to-3D jobs, Hyper3D Rodin and Hunyuan3D (both reachable from the Blender MCP add-on), and Meshy and Tripo. They need internet and credits, and they upload a person's photo to a third party. Their output is a textured mesh, not one with known measurements, and the topology cannot be split into the app's anatomical regions or morphed consistently. Research body models such as SMPL-X fit people well from images, but their licences restrict redistribution in a public app, and the fitting needs a GPU.

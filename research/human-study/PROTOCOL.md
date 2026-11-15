# Real-participant scanner pilot — collection kit

**Status: not started. No participant measurements have been collected.** The rendered-body results remain synthetic validation only. This protocol and analysis code do not constitute evidence of accuracy on people.

## Purpose and scope

Measure repeatability, paired measurement error and failed captures for the actual implemented estimators. This is a small formative Earth-based pilot, not clinical validation, a muscle-loss study or evidence of spaceflight performance. The team must collect the observations with consenting participants and an appropriately trained measurement operator; an AI agent cannot conduct the physical measurements.

Use pseudonymous participant IDs P01, P02, … in the CSV. Keep consent and identity records separate. Participation is voluntary. Explain what videos contain, who can access them and when they will be deleted. Do not recruit through this repository or put identifiable videos in Git. Only use comfortable movements; stop if a participant reports discomfort. Do not use this pilot to assess someone’s health.

## Planned design

Recruit a small convenience sample, for example 6–10 consenting adult volunteers, with a range of body sizes where practical. This is a proposed pilot size, not a power calculation or a representative sample.

Use two separate sessions on different days. Record the actual device model, resolution, camera height/distance, posture, height ruler and app/build version in a session log. Recreate baseline camera positions using marks. Include at least two cameras, normal and dim/backlit conditions, and fitted versus loose clothing. Use the same reference operator initially and log any operator change. Counterbalance the order of conditions and allow breaks.

For each participant, metric, session and condition, perform three independent captures: step out and set up again between captures. Start with the normal-light/fitted-clothing baseline; vary one factor at a time before testing combined difficult conditions. Record every attempt, including camera/permission failures, cropped feet, poor segmentation, insufficient confident frames and missing reference readings. Do not silently replace failures with successful retakes. The `attempt` number identifies independent captures, not video frames.

## Matching the shoulder reference

The current app estimates the **hip–shoulder–elbow included angle**, taking the 90th percentile of confident pose frames over a recording. This is not an isolated glenohumeral angle or an independent 3D reconstruction. Compare like with like.

For the first pilot, use comfortable stationary arm positions in a defined frontal plane, with an upright, stable trunk. A trained operator uses a checked two-arm goniometer, aligned with the same shoulder/upper-arm/trunk convention. Select a few comfortable target positions (for example near 30°, 60° and 90°) and record the actual reference angle, not the target label as though it were measured. Capture the 12-second held-position recording; do not compare its 90th-percentile estimate to an unrelated instantaneous peak or an angle defined by different landmarks. Record reference readings immediately before/after without changing posture, and note drift. The targets are a study design choice, not an exercise prescription.

Record left-side estimates as `shoulder_left_deg` with `reference_method=goniometer_included_angle`. A later dynamic-movement study would need synchronized reference measurements over the same interval and angle convention. Do not treat a handheld reference reading as a gold standard for unconstrained dynamic 3D motion.

The reference method and operator procedures matter: [Kolber & Hanney’s shoulder mobility investigation](https://pmc.ncbi.nlm.nih.gov/articles/PMC3362980/) evaluated specified inclinometer/goniometer protocols and did not validate GhostPilot. Its reported agreement cannot be transferred to this app.

## Matching the thigh-breadth reference

Read `src/scan.mjs` before collecting: the app averages front-view widths perpendicular to each thigh axis at **30%, 35%, 40%, 45% and 50% from the hip landmark toward the knee**, then averages both thighs and scales using stated height. It does not measure thigh circumference, muscle cross-sectional area or volume.

Use a checked breadth caliper or equivalent direct width instrument in the matching frontal plane, without compressing the outline. Identify and document the same landmark locations, levels, stance and axis convention; review the app’s measuring lines. Take direct widths at all five levels on both thighs, and use the mean of the ten widths as the matched reference. Repeat reference placement and record disagreement in the session log. This is a bespoke estimator-matching protocol, not a claimed standard anthropometric examination.

For clothing comparisons, measure the same external outline over the same clothing; a bare-leg caliper width cannot silently stand in for loose-clothing silhouette width. Keep instruments out of the app recording to avoid segmentation occlusion; measure immediately before/after and log posture or outline changes. Record height independently and consistently. If the required matched widths cannot be obtained, leave the reference blank and document why rather than substituting a tape circumference or converting it to an assumed diameter.

Use `metric=thigh_breadth_cm` and `reference_method=caliper_bilateral_band_mean`. Document any mismatch between the app band and the physical reference. Narrowing is not evidence of muscle loss.

## Collection and analysis

1. Copy the header-only [attempts.csv](attempts.csv). One row is one independent capture of one metric. Record device/lighting/clothing/posture/target consistently; successful captures with no reference are retained as unpaired observations. Put `status=failed` and a reason for rejected/failed captures. Missing numbers stay blank.
2. Use the app’s personal records and video review to transcribe estimates, confident-frame failures and timestamps. The public 4DGS model and synthetic demo history are excluded. Keep per-session notes for height, instrument checks, rater, app/build version and exact camera settings alongside the CSV.
3. Run:

```powershell
node scripts/analyze-human-study.mjs research/human-study/attempts.csv
```

The script writes Markdown and JSON reports. With the supplied empty template, it reports **PENDING**, zero participants and no available error estimates. Do not populate this file with invented volunteers to demonstrate accuracy.

The report includes failed-capture counts/rates over all attempts, successful but unpaired captures, MAE/RMSE/bias for successful matched pairs, participant-weighted bias, camera/lighting/clothing/session breakdowns, within-session SD under matching conditions and between-session mean ranges. Raw within-session app SD includes any true pose/reference variation; error SD is also provided when paired references exist.

Repeated frames, captures and sessions are correlated; they are not extra participants. The script deliberately supplies no clinical pass/fail threshold, ICC, confidence interval or naive population limits of agreement. Before interpreting agreement beyond descriptive pilot results, use a method that handles repeated observations, following [Bland & Altman (1999)](https://pubmed.ncbi.nlm.nih.gov/10501650/) or [their multiple-observation methods (2007)](https://pubmed.ncbi.nlm.nih.gov/17613642/), with statistical review. A clinical acceptability threshold would need an intended-use justification established before examining results.

## Report honestly

Include participant count, recruitment/selection limits, all conditions attempted, units, reference definition, instrument/rater uncertainty, missing references, rejected captures, exclusions and raw attempts. Report results separately by condition and participant rather than only an overall average. Record what failed and what needs another iteration. Do not infer astronaut suitability, diagnostic accuracy or clinical safety from a small terrestrial convenience sample.

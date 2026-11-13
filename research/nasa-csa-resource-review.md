# NASA and CSA resource review for GhostPilot

Reviewed 14 November 2026. This review follows all five user-supplied pages into their relevant hazard articles, investigations, and data portals. The source registry in [research.mjs](../src/research.mjs) records 22 resources used in the application. Additional documentation below supports the data-access and submission notes.

## Findings that shape the project

GhostPilot's strongest supported purpose is longitudinal observation, crew reflection, and a traceable handoff for flight surgeon review. NASA's resources support organizing the interface around hazards and showing related measurements together. They do not validate the app's attention task, camera estimates, thresholds, or suggested actions.

The main opportunity is better coverage and provenance: show what was observed, what was not measured, how observations were obtained, which research motivates the view, and what review step follows. A single combined “astronaut health score” would conceal those distinctions. This is our design interpretation of the sources, not a NASA recommendation or approved implementation.

## What each supplied page contributes

| Supplied resource | What it establishes | Use in GhostPilot |
| --- | --- | --- |
| [NASA: Five Hazards of Human Spaceflight](https://www.nasa.gov/hrp/hazards/) | Radiation, isolation/confinement, distance, gravity fields, and hostile/closed environments provide the organizing framework; their effects can interact. | The five Mission Lens nodes. Connecting lines represent context, without claiming causation. |
| [NASA: Risks of Human Spaceflight](https://www.nasa.gov/hrp/risks/) | Specific physiological, behavioral, and radiation risks are distinct from the environmental hazards. Examples include sleep/circadian disruption, altered immunity, reduced fitness, bone changes, and radiation-induced cancer. | Labels distinguish observations from hazards and possible outcomes. Missing measurements remain visible. |
| [NASA: Ongoing HRP Research](https://www.nasa.gov/hrp/ongoing-hrp-research/) | A directory links to investigations in Artemis and low Earth orbit, and to past investigations. It is research context rather than a download of participant readings. | Study-specific references in each hazard view. Study descriptions establish measurement needs, not successful countermeasure results. |
| [CSA: Monitoring radiation for astronaut health](https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp) | The 26 February 2026 announcement describes continued development of the Canadian Active Neutron Spectrometer (CANS), intended for continuous autonomous neutron monitoring. | Radiation evidence explains why an instrument is needed. The article supplies neither a live feed nor downloadable readings. No CANS integration is claimed. |
| [CSA: Why conduct science experiments in space?](https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp) | Research supports deep-space preparation and potential benefits on Earth. Longer missions involve radiation, weightlessness, isolation, delayed communications, and reduced reliance on Earth. | Background card and autonomy context. Earth benefits are motivation for research, without implying this prototype has demonstrated clinical benefits. |

## Hazard-by-hazard evidence and measurement gaps

### Isolation and confinement

[NASA's hazard article](https://www.nasa.gov/hrp/hazard-isolation-and-confinement/) connects isolation with sleep loss, circadian misalignment, workload, and performance concerns. It supports considering routine and workload when looking at attention changes; it does not establish that isolation caused a specific change.

[ARCHeR](https://www.nasa.gov/reference/archer/) combines actigraphy with behavioral performance surveys to study well-being, activity, sleep, and interactions around Artemis missions. Its page describes surveys before and after flight and actigraphy during flight. GhostPilot's docking task and five-point self-reports are separate experimental measures. A one-minute game is not automatically equivalent to a validated vigilance or cognitive test.

[Spaceflight Standard Measures](https://www.nasa.gov/reference/standard-measures/) combines activity/light sensing, sleep reports, cognition, sensorimotor assessments, strength tests, and biological samples across mission phases. This motivates consistent collection and clear units. A sleep-quality rating is not hours slept, and a manually entered heart rate is not a cardiovascular evaluation.

**Applied:** related sleep, energy, and attention observations remain together, with direct research links. Personal and simulated histories remain separate. No sleep-stage, circadian phase, or mental health diagnosis is inferred.

### Altered gravity

[NASA's gravity article](https://www.nasa.gov/hrp/hazard-gravity-fields/) describes adaptation across gravity transitions, including coordination, balance, fluid shifts, and skeletal effects. Recording conditions therefore matter: camera geometry, effort, restraints, and gravity should be comparable.

[CIPHER](https://www.nasa.gov/reference/cipher/) combines assessments of multiple body systems before, during, and after flight, including imaging, vision, cognition, exercise, and sensorimotor tests. A longitudinal movement diary is a small functional observation alongside those much richer assessments.

[Zero T2](https://www.nasa.gov/reference/zero-t2/) investigates whether exercise devices other than a treadmill can preserve health and performance. The investigation motivates attention to exercise constraints on smaller spacecraft. Its description does not establish that omitting exercise equipment is safe or validate a camera-based prescription.

**Applied:** the movement view links to these studies and explains that shoulder estimates cannot measure bone density or strength. The trained 4D Gaussian example is a separately attributed community research asset; it supplies no NASA data or crew health measurements.

### Hostile or closed environments

[NASA's habitat article](https://www.nasa.gov/hrp/hazard-hostile-closed-environments/) discusses microbial transfer, immune changes, and physical living conditions. These require environmental and biological measurements beyond the signals currently collected.

[Immune Biomarkers](https://www.nasa.gov/reference/immune-biomarkers/) describes blood and saliva sampling, including analysis related to stress hormones and latent viruses. A questionnaire or pose change cannot substitute for those assays. A study description also does not establish an individual's immune status.

**Applied:** the habitat view stays unmeasured. The interface links to the investigation and to environmental data exploration, without assigning archived ISS readings to the user's habitat.

### Distance from Earth

[NASA's distance article](https://www.nasa.gov/hrp/hazard-distance-from-earth/) emphasizes self-sufficiency when communication is delayed and supplies and medical support are constrained. It gives up to 20 minutes one way as its Mars example. GhostPilot's 0–30 minute control is a user-adjustable planning range, not a computed ephemeris or a NASA operational limit; 14 minutes is an illustrative default.

[Tempus Pro](https://www.nasa.gov/reference/tempus-pro/) examines integrated medical measurements, imaging, and telemedicine, including simulated diagnostic scenarios. It supports investigating compact information tools under mission constraints. It does not establish that near-real-time communication will be available on Mars.

**Applied:** observations, decisions, cutoffs, and reference metadata are saved locally. A downloaded handoff remains explicitly untransmitted. A browser being online does not establish ground-link availability. The displayed round-trip time assumes a symmetric link and excludes review and processing time.

### Radiation

[NASA's radiation article](https://www.nasa.gov/hrp/hazard-space-radiation/) describes ionizing radiation hazards beyond Earth's protection and the need to monitor exposure. A symptom trend cannot establish a radiation dose or injury.

[CSA's Radi-N2 account](https://www.asc-csa.gc.ca/eng/sciences/radi-n2.asp) explains neutron-sensitive bubble detectors placed in specific station locations, including a worn detector and one in sleeping quarters, for defined collection intervals. Detector location and accumulation period matter when interpreting a measurement. Its classroom comparison also illustrates that Earth and station contexts must be identified.

**Applied:** the radiation view links NASA's hazard explanation, Radi-N2, and the supplied CANS announcement. It remains unmeasured because no dosimeter is connected. The research describes measurement approaches; no dose is generated from attention, mood, movement, or a generic ISS average.

## NASA data sources worth using

These are verified discovery and documentation routes. No external numeric dataset was imported into GhostPilot during this work. Public page access, available documentation, and a successful data download are separate checks.

| Source | Available material and access | Best fit and necessary context |
| --- | --- | --- |
| [RadLab](https://visualization.osdr.nasa.gov/radlab/gui/overview/) | Public radiation archive with instrument/time filters and export options. Its [API documentation](https://visualization.osdr.nasa.gov/radlab/gui/data-api/) describes CSV, TSV, JSON, and HTML output. | Highest-priority future radiation example. Preserve instrument identity, spacecraft/module, UTC time, quantity, units, and retrieval provenance. Display in an archived research view separate from crew records. |
| [Environmental Data App](https://visualization.osdr.nasa.gov/eda/) | Mission dashboards and raw/summary tables for cabin and hardware environmental data, including temperature, humidity, CO₂, and radiation, with flight/ground comparisons. | Highest-priority habitat example. Match mission, hardware versus cabin location, time basis, units, and sampling intervals before comparison. Flight and ground controls are distinct series. |
| [Open Science Data Repository](https://osdr.nasa.gov/bio/repo/) | Space biology datasets; [NASA's overview](https://science.nasa.gov/biological-physical/data/osdr/) explains the integrated GeneLab/ALSDA resources. | Useful for an educational evidence explorer. Confirm species, tissue, assay, controls, mission phase, accession, version, and associated publication. Animal or molecular results do not directly validate a human monitoring threshold. |
| [NASA Life Sciences Portal](https://www.nasa.gov/hrp/nlsp/) | Human flight and analog investigation discovery and a data request route. [NASA's access explanation](https://www.nasa.gov/missions/station/open-source-science-opportunities/) distinguishes directly downloadable non-attributable data from sensitive/attributable data requiring requests. | Best route to investigate relevant human longitudinal measurements. Availability must be checked for each dataset. Public catalog access does not establish unrestricted access to individual astronaut records. |

[NASA's OSDR FAQ](https://science.nasa.gov/reference/osdr-faq/) says most repository data is available without authentication; human-derived processed data can be public while human sequence data requires controlled access. It also explains dataset and visualization citation conventions. [OSDR's terms](https://science.nasa.gov/reference/osdr-help-terms-and-conditions/) should be checked for each intended reuse. The human LSDA and the Ames ALSDA are different archives; the similar names should not be conflated.

**Important radiation unit distinction:** RadLab documents absorbed dose rate in µGy/hour, dose equivalent rate in µSv/hour, and flux in particles per area, solid angle, and time. These are different quantities. A future importer must retain the quantity and units, reject incompatible combinations, and avoid presenting an instrument reading as an individualized effective dose. Dose accumulation would additionally require appropriate integration intervals and treatment of gaps. This is an implementation requirement derived from the documented schema, not an implemented calculation.

**Retrieval limit:** the RadLab overview and API documentation were readable. An attempted ten-minute ISS/DosTel JSON query failed through the web reader, which normalized its query parameters. No numeric response, download checksum, or end-to-end API availability was verified. The OSDR repository and NLSP request-guidelines routes returned no readable body through that reader; their NASA explanatory pages were accessible. No authenticated or restricted datasets were requested.

## What changed in the application

- Each selected hazard has a disclosure with three relevant agency references and a short explanation of what the studies can support.
- The research section includes all five supplied resources, the existing risk-board reference, and four data-discovery routes with public/controlled-access distinctions.
- The 22-source registry contains stable IDs, agency attribution, URLs, purpose, and review date. It is bundled locally, so summaries and source-list export work after an offline reload. Opening external pages still needs a connection.
- New onboard handoffs and Markdown/JSON ground reports include the registry and explicit research-use metadata: no external measurements imported; prototype thresholds unvalidated. Existing saved handoffs retain their original contents.
- NASA resources organize the experience and explain measurement gaps. They do not supply the synthetic demonstration values, the public humanoid reconstruction, or the prototype's 15% attention and 8% shoulder thresholds.

The [Human System Risk Board](https://www.nasa.gov/directorates/esdmd/hhp/human-system-risk-board/) describes evidence review and causal diagrams maintained for human system risks. GhostPilot's context map is an independent visualization, not a reproduction of those vetted causal models.

## Submission provenance and limits

The user supplied the five starting URLs and the requirement to use NASA data or resources for Global Award consideration. These URLs were directly verified as agency publications. The challenge's [Resources tab](https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/?tab=resources) still could not be retrieved, so membership in that official list was not independently verified.

An [organizer answer in NASA's Space Apps repository](https://github.com/nasa/spaceapps/discussions/1827) also discusses using at least one NASA source from the challenge resources and listing the data, resources, and tools used. The discussion page was readable; its wording should be checked against the final challenge rules. This review documents substantive NASA resource use and does not certify award eligibility.

Suggested project-source statement:

> GhostPilot uses NASA Human Research Program resources to organize five-hazard monitoring context and explain measurement gaps, with NASA investigations and CSA research cited in the interface and exports. The prototype uses synthetic demonstration history or locally recorded observations. No external astronaut measurements are imported, and its trend rules are not clinically validated.

For the submission, include the downloaded source list alongside the existing software and 4DGS asset attributions. If an actual archive extract is added later, add its exact accession or query, version, retrieval time, license/terms, file hash, transformations, units, and originating instrument or study citation. Cite only material actually used; distinguish future data plans from completed integration.

## Recommended next research work

1. Start with a small, reproducible RadLab or environmental table extract in an explicitly historical research view. Complete the download and inspect its metadata before making charts or claims. Keep it outside the personal baseline.
2. Agree a sampling procedure for personal observations: comparable camera setup, time/routine context, device information, and explicit missing values. This is a project design decision inspired by standardized collection, not an implementation of NASA's protocol.
3. Evaluate the attention task, pose estimates, and proposed alerts against appropriate reference measurements and independent review before claiming health or operational performance. The cited agency research supplies context rather than that validation.

Broader CSA research can be discovered in its [station experiment catalog](https://www.asc-csa.gc.ca/eng/iss/science/experiments.asp). NASA's [Human Research Roadmap](https://humanresearchroadmap.nasa.gov/) is a further risk/gap discovery route, but its dynamic risk content was not readable in this session and was not used to establish specific findings.

## Implementation verification

On 14 November 2026, the production build and 14 existing unit checks passed. Four Mission Lens browser checks passed, including hazard-specific references, traceable handoffs, mobile data-access disclosures, and source-list download after a production offline reload. Twelve additional browser checks passed: nine viewport reflow checks with the research disclosures expanded, two automated accessibility checks covering desktop/mobile views and dialogs, and the report workflow verifying citations in downloaded Markdown and JSON.

The build initially encountered a sandbox file-access error while bundling Vite's config and passed when run with the required filesystem access. The existing large 4DGS bundle warning remains. Automated accessibility checks do not establish full accessibility conformance or replace assistive-technology testing. Archive API retrieval was not part of the successful application checks.

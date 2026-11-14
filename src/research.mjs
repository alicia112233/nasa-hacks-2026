// Primary sources read on this date. Published resources organize the body index;
// no external measurements enter a crew member's health history or ghost baseline.
export const researchUse = {
  reviewedOn: '2026-11-14',
  externalMeasurementsImported: false,
  nasaArchiveImported: 'NASA EDA RR-3 ISS habitat telemetry and SRAG radiation dose (public/data/nasa-eda-rr-3.json), shown as archived mission context only.',
  prototypeThresholdsValidated: false,
  description: 'NASA HRP hazards and its 17 named risks organize the body index; NASA EDA ISS data shows radiation and habitat context. Trend thresholds are independent prototype choices.',
};

export const researchSources = [
  { id: 'hazards', agency: 'NASA', title: 'Five Hazards of Human Spaceflight', url: 'https://www.nasa.gov/hrp/hazards/', role: 'The five hazards organize Mission Lens. Connections show monitoring context, not causation.', type: 'background' },
  { id: 'risks', agency: 'NASA', title: 'Risks of Human Spaceflight', url: 'https://www.nasa.gov/hrp/risks/', role: 'Health and performance risks are distinct from the hazards that contribute to them.', type: 'background' },
  { id: 'risk-board', agency: 'NASA', title: 'Human System Risk Board', url: 'https://www.nasa.gov/directorates/esdmd/hhp/human-system-risk-board/', role: 'Evidence and contributing factors inform risk review. GhostPilot does not implement a validated NASA risk model.', type: 'background' },
  { id: 'ongoing', agency: 'NASA', title: 'Ongoing HRP Research', url: 'https://www.nasa.gov/hrp/ongoing-hrp-research/', role: 'A directory of investigations connecting health observations to research questions, rather than a feed of crew readings.', type: 'background' },
  { id: 'cans', agency: 'CSA', title: 'Monitoring radiation for astronaut health', url: 'https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp', role: 'CANS is being developed for continuous, autonomous neutron monitoring. This article provides no downloadable measurements or live feed.', type: 'background' },
  { id: 'earth-benefits', agency: 'CSA', title: 'Why conduct science experiments in space?', url: 'https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp', role: 'Connects deep-space health research with potential benefits for health on Earth and the need for onboard autonomy.', type: 'background' },
  { id: 'isolation', agency: 'NASA', title: 'Hazard: Isolation and Confinement', url: 'https://www.nasa.gov/hrp/hazard-isolation-and-confinement/', role: 'Sleep, circadian timing, workload, and behavioral performance are related areas for monitoring.', type: 'evidence' },
  { id: 'gravity', agency: 'NASA', title: 'Hazard: Gravity Fields', url: 'https://www.nasa.gov/hrp/hazard-gravity-fields/', role: 'Gravity transitions affect coordination and adaptation. A shoulder estimate does not measure bone density or strength.', type: 'evidence' },
  { id: 'environment', agency: 'NASA', title: 'Hazard: Hostile/Closed Environments', url: 'https://www.nasa.gov/hrp/hazard-hostile-closed-environments/', role: 'Habitat conditions and microbial exposure require observations beyond mood and movement.', type: 'evidence' },
  { id: 'distance', agency: 'NASA', title: 'Hazard: Distance From Earth', url: 'https://www.nasa.gov/hrp/hazard-distance-from-earth/', role: 'Delayed communication motivates local review and dated handoffs. The adjustable delay is a planning exercise.', type: 'evidence' },
  { id: 'radiation', agency: 'NASA', title: 'Hazard: Space Radiation', url: 'https://www.nasa.gov/hrp/hazard-space-radiation/', role: 'Radiation exposure requires dedicated measurement; symptoms and attention results do not establish a dose.', type: 'evidence' },
  { id: 'archer', agency: 'NASA', title: 'ARCHeR', url: 'https://www.nasa.gov/reference/archer/', role: 'Studies activity, sleep, well-being, and performance using actigraphy and surveys. GhostPilot does not reproduce its instruments or protocol.', type: 'evidence' },
  { id: 'standard-measures', agency: 'NASA', title: 'Spaceflight Standard Measures', url: 'https://www.nasa.gov/reference/standard-measures/', role: 'Combines standardized physical and psychological measurements across mission phases. Self-reported sleep quality is not measured sleep duration.', type: 'evidence' },
  { id: 'cipher', agency: 'NASA', title: 'CIPHER', url: 'https://www.nasa.gov/reference/cipher/', role: 'Uses multiple body-system assessments before, during, and after flight. A pose replay cannot replace these examinations.', type: 'evidence' },
  { id: 'zero-t2', agency: 'NASA', title: 'Zero T2', url: 'https://www.nasa.gov/reference/zero-t2/', role: 'Investigates exercise equipment requirements and health outcomes. It does not validate a camera-based fitness score or an exercise prescription.', type: 'evidence' },
  { id: 'immune', agency: 'NASA', title: 'Immune Biomarkers', url: 'https://www.nasa.gov/reference/immune-biomarkers/', role: 'Investigates immune changes through blood and saliva samples. Well-being scores cannot stand in for those assays.', type: 'evidence' },
  { id: 'tempus', agency: 'NASA', title: 'Tempus Pro', url: 'https://www.nasa.gov/reference/tempus-pro/', role: 'Studies integrated medical measurements and telemedicine. GhostPilot stores handoffs locally and has no transmission service.', type: 'evidence' },
  { id: 'radi-n2', agency: 'CSA', title: 'Radi-N2: Tracking space radiation and its risks', url: 'https://www.asc-csa.gc.ca/eng/sciences/radi-n2.asp', role: 'Bubble detectors measure neutron exposure at specific locations and intervals. Archived instrument readings are not a personal dose.', type: 'evidence' },
  { id: 'radlab', agency: 'NASA', title: 'RadLab radiation archive', url: 'https://visualization.osdr.nasa.gov/radlab/gui/overview/', role: 'Explore archived, instrument-specific radiation time series with downloads and an API. Dose rate, dose equivalent rate, and flux have different units.', type: 'data', access: 'Public archive · download / API', limitation: 'Historical instrument context, not current personal dosimetry. Returned HTTP 500 on 2026-11-14; EDA used instead.' },
  { id: 'eda', agency: 'NASA', title: 'Environmental Data App', url: 'https://visualization.osdr.nasa.gov/eda/', role: 'Explore mission-specific cabin and hardware temperature, humidity, CO₂, and radiation data, including flight/ground comparisons.', type: 'data', access: 'Public archive · downloadable tables', limitation: 'RR-3 extract imported (hourly medians, daily dose). Habitat-unit readings, not your cabin or your dose.' },
  { id: 'osdr', agency: 'NASA', title: 'Open Science Data Repository', url: 'https://osdr.nasa.gov/bio/repo/', role: 'Space biology and selected human research datasets. Check species, study design, accession, version, and citation before reuse.', type: 'data', access: 'Mostly open · some controlled access', limitation: 'Human processed data may be public; human sequence data requires controlled access. No datasets imported.' },
  { id: 'nlsp', agency: 'NASA', title: 'NASA Life Sciences Portal', url: 'https://www.nasa.gov/hrp/nlsp/', role: 'Find human flight and analog investigations in the Life Sciences Data Archive and review the data request route.', type: 'data', access: 'Public catalog · access varies by dataset', limitation: 'Some non-attributable data is downloadable. Sensitive or attributable data requires a request.' },
].map(source => ({ ...source, reviewedOn: researchUse.reviewedOn }));

export const foundationSources = researchSources.filter(source => source.type === 'background');
export const dataResources = researchSources.filter(source => source.type === 'data');

const hazardSourceIds = {
  isolation: ['isolation', 'archer', 'standard-measures'],
  gravity: ['gravity', 'cipher', 'zero-t2'],
  environment: ['environment', 'immune', 'standard-measures'],
  distance: ['distance', 'tempus', 'earth-benefits'],
  radiation: ['radiation', 'cans', 'radi-n2'],
};

/** @param {keyof typeof hazardSourceIds} hazard */
export function sourcesForHazard(hazard) {
  const ids = hazardSourceIds[hazard];
  return ids.map(id => researchSources.find(source => source.id === id));
}

export function researchReferencesMarkdown() {
  return `## Research resources and use\nReviewed: ${researchUse.reviewedOn}. ${researchUse.description}\nNo external measurements have been imported into this report.\n\n${researchSources.map(source => `- [${source.agency}: ${source.title}](${source.url}) — ${source.role}${source.type === 'data' ? ` Access: ${source.access}. ${source.limitation}` : ''}`).join('\n')}\n`;
}

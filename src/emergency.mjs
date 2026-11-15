/** Bundled with the app and precached. This is a workflow demonstration, NOT an approved medical procedure. */
export const emergencyProcedure = {
  id: 'GP-COLLAPSE-DEMO', version: '0.1.0', title: 'Chest pain or collapse',
  review: { status: 'draft — clinician review required', clinician: null, reviewedAt: null },
  sources: [{ title: 'AHA: cardiac arrest recognition', url: 'https://www.heart.org/en/health-topics/cardiac-arrest/about-cardiac-arrest' }],
  steps: {
    activate: { title: 'Activate the onboard emergency response', text: 'Call for crew assistance and the mission medical lead now. Use the mission-approved emergency procedure. Do not wait for a ground reply or complete routine health checks first.', answers: ['Response activated'] },
    responsive: { title: 'Is the crewmate responsive?', text: 'Record what you observe. This workflow does not need a ghost or any earlier health measurements.', answers: ['Responsive', 'Unresponsive', 'Unsure'] },
    breathing: { title: 'Are they breathing normally?', text: 'Gasping is not normal breathing. If unresponsive and not breathing normally, begin the mission-approved resuscitation response immediately, using your training.', answers: ['Breathing normally', 'Not breathing normally', 'Unsure'] },
    urgent: { title: 'Follow the mission resuscitation procedure now', text: 'Unresponsive with abnormal or uncertain breathing: treat as an emergency. Begin CPR according to your training and onboard procedure; use an AED if available. This demo does not supply microgravity CPR technique.', answers: ['Response underway'] },
    assess: { title: 'Keep the crewmate under observation', text: 'Chest pain or collapse needs urgent assessment by the mission medical lead. Follow the onboard procedure and report any change in responsiveness or breathing immediately.', answers: ['Observation underway'] },
    equipment: { title: 'Is an AED available?', text: 'Record availability without interrupting care. If others are present, delegate equipment retrieval.', answers: ['AED available', 'No AED available', 'Availability unknown'] },
    assistance: { title: 'What trained assistance is present?', text: 'Record who can help. Ground contact may be delayed; continue the onboard response.', answers: ['Medical lead present', 'CPR-trained crewmate present', 'No trained assistance present'] },
    support: { title: 'Continue the onboard response', text: 'Use the available equipment and the mission-approved procedure within your training. Keep observing and record changes as care continues.', answers: ['Reassess responsiveness', 'Care transferred to medical lead'] },
  },
};

export function createIncident({ id, crewId, crewName, simulated, now }) {
  return { id, crewId, crewName, simulated, startedAt: now, procedure: structuredClone(emergencyProcedure), step: 'activate', events: [] };
}

export function advanceIncident(incident, response, note, at) {
  const step = incident.procedure.steps[incident.step];
  if (incident.endedAt || !step?.answers.includes(response)) throw new Error('Invalid emergency step or response.');
  const next = { ...incident, events: [...incident.events, { at, step: incident.step, instruction: `${step.title}. ${step.text}`, response, note: note.trim() }] };
  if (incident.step === 'equipment') next.equipment = response;
  if (incident.step === 'assistance') next.assistance = response;
  if (incident.step === 'support' && response === 'Care transferred to medical lead') return { ...next, endedAt: at };
  const responsive = [...next.events].reverse().find(e => e.step === 'responsive')?.response;
  const breathing = [...next.events].reverse().find(e => e.step === 'breathing')?.response;
  const route = { activate: 'responsive', responsive: 'breathing', breathing: responsive !== 'Responsive' && breathing !== 'Breathing normally' ? 'urgent' : 'assess', urgent: 'equipment', assess: 'equipment', equipment: 'assistance', assistance: 'support', support: 'responsive' };
  return { ...next, step: route[incident.step] };
}

export function supportInstruction(incident) {
  const helper = incident.assistance === 'Medical lead present' ? 'Transfer clinical decisions to the medical lead; delegate documentation to another helper.' : incident.assistance === 'CPR-trained crewmate present' ? 'Ask the trained crewmate to assist with the mission response; delegate observation and documentation.' : 'Call for trained help and use your onboard emergency instructions.';
  return `${incident.equipment === 'AED available' ? 'Delegate AED retrieval and follow its prompts as directed by the onboard procedure.' : 'AED availability is not confirmed; continue the mission response without waiting for equipment.'} ${helper}`;
}

export const emergencyHandoff = incident => ({
  schemaVersion: 1, type: 'emergency', transmitted: false, source: incident.simulated ? 'simulated drill' : 'crew-entered observations',
  ...incident, status: incident.endedAt ? 'care transferred' : 'response in progress',
  limitation: 'Workflow demo. No clinician-reviewed mission procedure installed. Event timestamps indicate when the crew recorded an action, not independently verified care.',
});

import { measuredAt } from './references.mjs';
import { checks } from './body.mjs';

const text = (value, label, limit = 1000) => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > limit) throw new Error(`${label} is required (up to ${limit} characters).`);
  return value.trim();
};

/** @param {import('./types').CarePlan} plan @param {string} now */
export function validateCarePlan(plan, now) {
  if (!plan || !['none', 'followed', 'unknown'].includes(plan.procedure?.status)) throw new Error('Record whether a procedure was followed.');
  const procedure = { status: plan.procedure.status, name: '', version: '' };
  if (procedure.status === 'followed') {
    procedure.name = text(plan.procedure.name, 'Procedure name', 200);
    procedure.version = text(plan.procedure.version, 'Procedure version, or “unknown”', 100);
  }
  const nextCheck = text(plan.nextCheck, 'Next check', 300);
  if (!Number.isFinite(Date.parse(plan.dueAt)) || Date.parse(plan.dueAt) <= Date.parse(now)) throw new Error('Choose a future reassessment time.');
  if (!Array.isArray(plan.missingInformation) || !plan.missingInformation.length) throw new Error('List what is still missing, or write “None”.');
  const missingInformation = plan.missingInformation.filter(v => typeof v === 'string' && v.trim()).map(v => text(v, 'Missing information', 500));
  if (!missingInformation.length) throw new Error('List what is still missing, or write “None”.');
  if (missingInformation.length > 20) throw new Error('Use at most 20 information gaps.');
  return { procedure, nextCheck, dueAt: new Date(plan.dueAt).toISOString(), missingInformation };
}

/**
 * A new care event is appended; the original packet and earlier events stay intact.
 * @param {{id: string, packet: import('./types').MissionPacket, updates?: import('./types').CareUpdate[], observation: string, change: import('./types').CareUpdate['change'], plan: import('./types').CarePlan, checkIns: import('./types').CheckIn[], now: string}} options
 * @returns {import('./types').CareUpdate}
 */
export function createCareUpdate({ id, packet, updates = [], observation, change, plan, checkIns, now }) {
  if (!['improved', 'unchanged', 'worse', 'unclear'].includes(change)) throw new Error('Record whether the result changed.');
  const earlier = updates.filter(u => u.packetId === packet.id && u.crewId === packet.crewId && u.source === packet.source);
  const cutoff = earlier.at(-1)?.recordedAt ?? packet.createdAt;
  if (!Number.isFinite(Date.parse(now)) || Date.parse(now) <= Date.parse(cutoff)) throw new Error('A reassessment timestamp must follow the original record and earlier updates.');
  const fields = [...new Set(checks.flatMap(c => [c.field, c.field2]).filter(Boolean))];
  const measurements = checkIns.filter(c => c.crewId === packet.crewId && c.simulated === (packet.source === 'simulated')).flatMap(c => fields.filter(field => typeof c[field] === 'number' && Number.isFinite(c[field]) && Date.parse(measuredAt(c, field)) > Date.parse(cutoff) && Date.parse(measuredAt(c, field)) <= Date.parse(now)).map(field => ({ checkInId: c.id, field, value: c[field], measuredAt: measuredAt(c, field), conditions: structuredClone(c.measurements?.[field]) })));
  return { id, packetId: packet.id, crewId: packet.crewId, source: packet.source, recordedAt: now, observation: text(observation, 'Reassessment observation'), change,
    plan: validateCarePlan(plan, now), measurements };
}

/** @param {import('./types').MissionPacket} packet @param {import('./types').CareUpdate[]} updates @param {string} [now] */
export function careState(packet, updates, now = new Date().toISOString()) {
  const events = updates.filter(u => u.packetId === packet.id && u.crewId === packet.crewId && u.source === packet.source);
  const plan = events.at(-1)?.plan ?? packet.carePlan;
  return { events, plan, due: !!plan && Date.parse(plan.dueAt) <= Date.parse(now) };
}

export const procedureLabel = p => !p || p.status === 'unknown' ? 'Procedure not recorded' : p.status === 'none' ? 'No procedure followed' : `${p.name} · version ${p.version}`;

/** @param {import('./types').MissionPacket} packet @param {import('./types').CareUpdate[]} updates */
export function continuingCarePacket(packet, updates) {
  return { ...structuredClone(packet), continuingCare: { originalPacketId: packet.id, updates: structuredClone(careState(packet, updates).events), groundResponse: null },
    delivery: { downloaded: true, transmittedByGhostPilot: false, receiptConfirmed: false } };
}

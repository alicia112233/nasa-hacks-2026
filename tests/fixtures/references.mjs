import { metricKeys } from '../../src/references.mjs';
export const context = { phase: 'cruise', cameraSetup: 'Camera A, mark 2', posture: 'Upright', lighting: 'Front lit', clothing: 'Fitted', activity: 'Rested' };
export const documented = records => records.map(r => ({ ...r, measurements: Object.fromEntries(metricKeys.map(k => [k, { ...context, measuredAt: r.date, quality: 'good' }])) }));
export const referencesFor = (records, count = 11) => [{ id: 'fixed-test-reference', crewId: records[0]?.crewId, simulated: records[0]?.simulated ?? true, phase: 'cruise', establishedAt: records[Math.min(count, records.length) - 1]?.date, reason: 'Explicit test reference', records: structuredClone(records.slice(0, count)) }];

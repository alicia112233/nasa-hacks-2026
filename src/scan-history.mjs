/**
 * Scan history: every saved scan stays on the crew member's profile, oldest first. The latest body scan shapes the
 * figure; leg outlines are kept for the record but never reshape it. Each scan's thigh breadth is also a reading in the
 * crew member's personal records (Trends → Thigh, and the Legs ghost), linked by the scan's capture time.
 */

/** @param {import('./types').Profile} profile @returns {import('./types').BodyScan[]} */
export const scanHistory = profile => profile.scans ?? (profile.scan ? [profile.scan] : []);

/** @param {import('./types').BodyScan} scan */
export const scanId = scan => scan.id ?? scan.date;

/**
 * The profile fields to save with a new scan. A body scan also becomes the one shaping the figure.
 * @param {import('./types').Profile} profile @param {import('./types').BodyScan} scan
 */
export function addScan(profile, scan) {
  const scans = [...scanHistory(profile), scan];
  return scan.mode === 'legs' ? { scans } : { scans, scan };
}

/**
 * The personal reading a scan wrote, if it is still the one recorded (a later scan the same day replaces it).
 * @param {import('./types').CheckIn[]} checkIns @param {string | undefined} crewId @param {import('./types').BodyScan} scan
 */
export const linkedReading = (checkIns, crewId, scan) =>
  checkIns.find(c => c.crewId === crewId && !c.simulated && typeof c.thighCm === 'number' && c.measurements?.thighCm?.measuredAt === scan.date) ?? null;

/**
 * Delete one scan. If it shaped the figure, the latest remaining body scan takes over, or the standard figure.
 * Its thigh reading leaves the records only while it is still the linked one. Fixed ghosts are snapshots, so they keep it.
 * @param {import('./types').Profile} profile @param {import('./types').CheckIn[]} checkIns @param {string | undefined} crewId @param {string} id
 */
export function deleteScan(profile, checkIns, crewId, id) {
  const history = scanHistory(profile);
  const target = history.find(s => scanId(s) === id);
  if (!target) return { profile: {}, checkIns };
  const scans = history.filter(s => s !== target);
  const shaping = profile.scan && scanId(profile.scan) === id;
  const scan = shaping ? [...scans].reverse().find(s => s.mode !== 'legs') : profile.scan;
  const reading = linkedReading(checkIns, crewId, target);
  const strip = c => {
    const { thighCm: _value, ...rest } = c;
    const { thighCm: _context, ...measurements } = c.measurements ?? {};
    return { ...rest, measurements };
  };
  return { profile: { scans, scan }, checkIns: reading ? checkIns.map(c => (c === reading ? strip(c) : c)) : checkIns };
}

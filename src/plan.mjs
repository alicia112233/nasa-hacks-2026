/**
 * The mission plan: how often each check comes round. Daily checks are due every sol; the others fall on fixed sols
 * (sol % every === on), so a crew member's first days stay short and the weekly checks spread across the week.
 * Symptom checks are reported when noticed, spacewalk checks after a spacewalk, and body temperature when a symptom
 * suggests illness. An open alert brings its check back every day until it clears. Everything else stays in the body
 * index to explore. The cadences are illustrative, in the spirit of ISS routines; a mission's flight surgeons set them.
 */
export const PLAN = {
  sleep: { every: 1 }, sleepHours: { every: 1 }, mood: { every: 1 }, energy: { every: 1 }, heartRate: { every: 1 }, exercise: { every: 1 },
  attention: { every: 3, on: 0 }, workload: { every: 3, on: 1 }, team: { every: 3, on: 1 }, appetite: { every: 3, on: 2 },
  vision: { every: 7, on: 0 }, bp: { every: 7, on: 0 }, legs: { every: 7, on: 1 }, shoulder: { every: 7, on: 2 }, skin: { every: 7, on: 3 }, back: { every: 7, on: 4 },
  temperature: { when: 'unwell' },
  headache: { when: 'noticed' }, dizziness: { when: 'noticed' }, breath: { when: 'noticed' }, gut: { when: 'noticed' },
  joint: { when: 'eva' }, grip: { when: 'eva' },
};

/** Symptoms that make body temperature due the same day. */
export const UNWELL = ['headache', 'gut', 'breath', 'dizziness'];

/** How often, in a word or two. @param {string} id */
export function cadenceLabel(id) {
  const p = PLAN[id];
  if (!p) return '';
  if (p.every === 1) return 'Daily';
  if (p.every === 7) return 'Weekly';
  if (p.every) return `Every ${p.every} days`;
  return { unwell: 'When unwell', noticed: 'When you notice it', eva: 'After a spacewalk' }[p.when] ?? '';
}

/** The latest planned sol on or before this one, or null before the first. @param {string} id @param {number} sol */
export function scheduledSol(id, sol) {
  const p = PLAN[id];
  if (!p?.every) return null;
  const s = sol - (((sol - (p.on ?? 0)) % p.every) + p.every) % p.every;
  return s >= 1 ? s : null;
}

/**
 * Why a check is in today's routine, or null when it isn't due.
 * followup: an open alert; unwell: a symptom today calls for temperature; due: planned for today; overdue: planned for
 * an earlier sol and not done since.
 * @param {{ id: string, sol: number, lastBeforeToday: string | null, dayOfSol: (s: number) => string, alert: boolean, unwell: boolean }} o
 * @returns {null | { why: 'followup' | 'unwell' | 'due' | 'overdue', since?: number }}
 */
export function planState({ id, sol, lastBeforeToday, dayOfSol, alert, unwell }) {
  if (alert) return { why: 'followup' };
  if (PLAN[id]?.when === 'unwell' && unwell) return { why: 'unwell' };
  const s = scheduledSol(id, sol);
  if (s == null) return null;
  // A check never taken is due on its planned sol, never overdue: a member who joins mid-mission starts with a short day.
  if (!lastBeforeToday) return s === sol ? { why: 'due' } : null;
  if (lastBeforeToday >= dayOfSol(s)) return null;
  return s < sol ? { why: 'overdue', since: s } : { why: 'due' };
}

/** What the routine says about a due check, after its cadence. */
export const WHY_TEXT = { followup: 'recheck until the alert clears', unwell: 'due: symptom reported', due: 'due today', overdue: 'overdue' };

import type { MissionState, Profile, Recording } from './types';

/**
 * Crew roster helpers. The mission state keeps everyone in `crew`, the selected member's id in `crewId`, and the selected
 * member's profile in `profile` (kept in step), so views read one profile while each person keeps their own records.
 */

export const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '—';

/**
 * Bring any saved state to the roster shape. A save from before the roster becomes a crew of one; the stored profile is
 * the truth for the selected member; records without a crew member belong to the first one.
 */
export function normalise(state: MissionState): MissionState {
  const base: Profile = state.profile ?? { name: 'Crew member', initials: 'CM', mission: '', duration: 180 };
  let crew = (state.crew?.length ? state.crew : [base]).map((c, i) => ({ ...c, id: c.id ?? (i === 0 && base.id ? base.id : `crew-${i + 1}`) }));
  const crewId = crew.some(c => c.id === state.crewId) ? state.crewId! : crew.find(c => c.id === base.id)?.id ?? crew[0].id;
  crew = crew.map(c => (c.id === crewId ? { ...c, ...state.profile, id: crewId } : c));
  const first = crew[0].id!;
  const tag = <T extends { crewId?: string }>(x: T): T => (x.crewId ? x : { ...x, crewId: first });
  return {
    ...state, crew, crewId,
    profile: crew.find(c => c.id === crewId)!,
    checkIns: state.checkIns.map(tag), actions: state.actions.map(tag), packets: state.packets?.map(tag),
  };
}

/** The mission as one crew member sees it: only their records. */
export function scoped(state: MissionState): MissionState {
  const id = state.crewId;
  return { ...state, checkIns: state.checkIns.filter(c => c.crewId === id), actions: state.actions.filter(a => a.crewId === id), packets: state.packets?.filter(p => p.crewId === id), references: state.references?.filter(r => r.crewId === id), checkRuns: state.checkRuns?.filter(r => r.crewId === id), careUpdates: state.careUpdates?.filter(r => r.crewId === id) };
}

export const recordingsFor = (state: MissionState, recordings: Recording[]) =>
  recordings.filter(r => (r.crewId ?? state.crew?.[0]?.id) === state.crewId);

/** Edit the selected member: profile and roster entry together, initials following the name. */
export function withProfile(state: MissionState, patch: Partial<Profile>): MissionState {
  const profile = { ...state.profile, ...patch, ...(patch.name ? { initials: initialsOf(patch.name) } : {}) };
  return { ...state, profile, crew: (state.crew ?? [profile]).map(c => (c.id === state.crewId ? profile : c)) };
}

export function switchCrew(state: MissionState, id: string): MissionState {
  const next = state.crew?.find(c => c.id === id);
  return next ? { ...state, crewId: id, profile: next } : state;
}

/** A new member on the same mission, selected, with nothing measured yet. */
export function addCrew(state: MissionState, now = Date.now()): MissionState {
  const n = (state.crew?.length ?? 1) + 1;
  const name = `Crew member ${n}`;
  const member: Profile = { id: `crew-${now.toString(36)}`, name, initials: initialsOf(name), mission: state.profile.mission, duration: state.profile.duration, startDate: state.profile.startDate };
  return { ...state, crew: [...(state.crew ?? [state.profile]), member], crewId: member.id, profile: member };
}

/** Remove a member and every record that belongs to them. The last member can't be removed. */
export function removeCrew(state: MissionState, id: string): MissionState {
  const crew = (state.crew ?? []).filter(c => c.id !== id);
  if (!crew.length) return state;
  const crewId = state.crewId === id ? crew[0].id : state.crewId;
  return {
    ...state, crew, crewId, profile: crew.find(c => c.id === crewId)!,
    checkIns: state.checkIns.filter(c => c.crewId !== id), actions: state.actions.filter(a => a.crewId !== id), packets: state.packets?.filter(p => p.crewId !== id),
    references: state.references?.filter(r => r.crewId !== id), checkRuns: state.checkRuns?.filter(r => r.crewId !== id),
    careUpdates: state.careUpdates?.filter(r => r.crewId !== id),
  };
}

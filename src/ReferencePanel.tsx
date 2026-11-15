import { useState } from 'react';
import { defaultContext, establishReference, phases } from './references.mjs';
import { formatDate } from './data';
import type { GhostReference, MissionPhase, MissionState, RecordingContext } from './types';

export default function ReferencePanel({ mission, onContext, onReference }: { mission: MissionState; onContext: (c: RecordingContext) => void; onReference: (r: GhostReference) => void }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const ctx = mission.profile.recordingContext ?? defaultContext;
  const refs = (mission.references ?? []).filter(r => r.simulated === mission.demo);
  const retained = refs.some(r => r.phase === ctx.phase);
  const update = (key: keyof RecordingContext, value: string) => onContext({ ...ctx, [key]: value });
  return <details className="sheet reference-panel">
    <summary>Recording conditions & fixed references · {phases[ctx.phase]} · {refs.length} retained</summary>
    <p>Save the phase and conditions before a check. A new phase reference preserves preflight. References never update automatically.</p>
    <div className="context-fields">
      <label className="field">Mission phase<select value={ctx.phase} onChange={e => update('phase', e.target.value as MissionPhase)}>{Object.entries(phases).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <label className="field">Activity / timing<input value={ctx.activity} placeholder="e.g. rested, before exercise" maxLength={120} onChange={e => update('activity', e.target.value)}/></label>
      <label className="field">Camera setup<input value={ctx.cameraSetup} placeholder="e.g. camera A, mark 2, front view" maxLength={120} onChange={e => update('cameraSetup', e.target.value)}/></label>
      <label className="field">Posture / restraint<input value={ctx.posture} placeholder="e.g. upright, arms clear" maxLength={120} onChange={e => update('posture', e.target.value)}/></label>
      <label className="field">Lighting<input value={ctx.lighting} placeholder="e.g. cabin lights, front lit" maxLength={120} onChange={e => update('lighting', e.target.value)}/></label>
      <label className="field">Clothing<input value={ctx.clothing} placeholder="e.g. same fitted exercise clothes" maxLength={120} onChange={e => update('clothing', e.target.value)}/></label>
    </div>
    <h3>Retained references</h3>
    <ul className="reference-list">{refs.map(r => <li key={r.id}><b>{phases[r.phase]}</b> · established {formatDate(r.establishedAt)} · {r.records.length} entries<p>{r.reason}</p></li>)}</ul>
    {!refs.length && <p className="muted">No reference established. Earlier entries alone do not establish comparable conditions.</p>}
    <p className="review-warning">Do not redefine a changed result as normal. Review unexplained deterioration before establishing a new phase reference. This crew action is not clinical approval.</p>
    <form onSubmit={e => { e.preventDefault(); try { onReference(establishReference({ id: crypto.randomUUID(), crewId: mission.crewId, simulated: mission.demo, records: mission.checkIns, phase: ctx.phase, reason, now: new Date().toISOString(), references: refs })); setReason(''); setError(''); } catch (err) { setError(err instanceof Error ? err.message : 'Could not establish reference.'); } }}>
      <label className="field">Reason for a new phase reference<input required maxLength={400} value={reason} onChange={e => setReason(e.target.value)} placeholder="Why are these readings an appropriate reference?"/></label>
      <button className="btn" disabled={retained || ctx.phase === 'unknown'}>Establish {phases[ctx.phase]} reference</button>
      {retained && <p className="muted">This phase reference is fixed and retained.</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  </details>;
}

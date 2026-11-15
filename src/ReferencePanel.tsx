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
    <summary>Conditions & ghost · {phases[ctx.phase]}</summary>
    <p>Measure the same way each time.</p>
    <div className="context-fields">
      <label className="field">Mission phase<select value={ctx.phase} onChange={e => update('phase', e.target.value as MissionPhase)}>{Object.entries(phases).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <label className="field">Activity / timing<input value={ctx.activity} placeholder="e.g. rested, before exercise" maxLength={120} onChange={e => update('activity', e.target.value)}/></label>
      <label className="field">Camera setup<input value={ctx.cameraSetup} placeholder="e.g. camera A, mark 2, front view" maxLength={120} onChange={e => update('cameraSetup', e.target.value)}/></label>
      <label className="field">Posture / restraint<input value={ctx.posture} placeholder="e.g. upright, arms clear" maxLength={120} onChange={e => update('posture', e.target.value)}/></label>
      <label className="field">Lighting<input value={ctx.lighting} placeholder="e.g. cabin lights, front lit" maxLength={120} onChange={e => update('lighting', e.target.value)}/></label>
      <label className="field">Clothing<input value={ctx.clothing} placeholder="e.g. same fitted exercise clothes" maxLength={120} onChange={e => update('clothing', e.target.value)}/></label>
    </div>
    <h3>Your ghosts</h3>
    <ul className="reference-list">{refs.map(r => <li key={r.id}><b>{phases[r.phase]}</b> · set {formatDate(r.establishedAt)} · {r.records.length} entries<p>{r.reason}</p></li>)}</ul>
    {!refs.length && <p className="muted">No ghost set yet.</p>}
    <p className="review-warning">Don’t reset your ghost to hide a change.</p>
    <form onSubmit={e => { e.preventDefault(); try { onReference(establishReference({ id: crypto.randomUUID(), crewId: mission.crewId, simulated: mission.demo, records: mission.checkIns, phase: ctx.phase, reason, now: new Date().toISOString(), references: refs })); setReason(''); setError(''); } catch (err) { setError(err instanceof Error ? err.message : 'Could not set the ghost.'); } }}>
      <label className="field">Why set a new ghost?<input required maxLength={400} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. adapted to cruise, readings steady for a week"/></label>
      <button className="btn" disabled={retained || ctx.phase === 'unknown'}>Set {phases[ctx.phase]} ghost</button>
      {retained && <p className="muted">This phase already has a ghost.</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  </details>;
}

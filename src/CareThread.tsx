import { useState } from 'react';
import { Download } from 'lucide-react';
import CarePlanFields, { blankCarePlan } from './CarePlanFields';
import { careState, continuingCarePacket, createCareUpdate, procedureLabel } from './continuing-care.mjs';
import { downloadFile, formatDate } from './data';
import { checks } from './body.mjs';
import type { CareUpdate, CheckIn, MissionPacket } from './types';

const measuredValue = (m: CareUpdate['measurements'][number]) => {
  const check = checks.find(c => c.field === m.field);
  const value = check?.options ? check.options[check.kind === 'scale' ? m.value - 1 : m.value] : `${m.value}${check?.unit ? ` ${check.unit}` : ''}`;
  return `${check?.title ?? m.field}: ${value}`;
};

export default function CareThread({ packet, updates, checkIns, onSave, onDownloaded }: { packet: MissionPacket; updates: CareUpdate[]; checkIns: CheckIn[]; onSave: (event: CareUpdate) => Promise<void>; onDownloaded: (id: string) => void }) {
  const state = careState(packet, updates);
  const [observation, setObservation] = useState('');
  const [change, setChange] = useState<CareUpdate['change']>('unclear');
  const [plan, setPlan] = useState(() => ({ ...(state.plan ?? blankCarePlan()), dueAt: '' }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      await onSave(createCareUpdate({ id: crypto.randomUUID(), packet, updates, checkIns, observation, change, plan, now: new Date().toISOString() }));
      setObservation(''); setPlan(old => ({ ...old, dueAt: '' }));
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save reassessment.'); }
    finally { setSaving(false); }
  }
  function download() {
    downloadFile(`ghostpilot-handoff-${packet.id}.json`, JSON.stringify(continuingCarePacket(packet, updates), null, 2), 'application/json'); onDownloaded(packet.id);
  }
  return <li className="care-thread">
    <div className="care-thread-head"><span><b>Sol {packet.sol}</b> · {formatDate(packet.createdAt, { hour: '2-digit', minute: '2-digit' })}<small>{packet.status === 'downloaded' ? 'File downloaded · delivery not confirmed' : 'Saved on this device'}{packet.communication.blackoutDrill ? ' · blackout drill' : ''}</small></span><button className="btn ghost" aria-label={`Download Sol ${packet.sol} handoff`} onClick={download}><Download size={16}/></button></div>
    <p className={state.due ? 'care-due' : ''}>{state.plan ? `${state.due ? 'Reassessment due' : 'Reassess'}: ${state.plan.nextCheck} · ${formatDate(state.plan.dueAt, { hour: '2-digit', minute: '2-digit' })}` : 'No reassessment plan recorded in this older packet.'}</p>
    <details><summary>Care record · {state.events.length} reassessments</summary>
      <div className="care-original"><b>Original observation · {formatDate(packet.createdAt, { hour: '2-digit', minute: '2-digit' })}</b><p>{packet.context || 'No written observation in this older packet.'}</p><p className="muted">{procedureLabel(packet.carePlan?.procedure)}. {packet.observations.length} check-in entries attached. Original snapshot retained.</p>{packet.carePlan && <><p>Planned: {packet.carePlan.nextCheck} · {formatDate(packet.carePlan.dueAt, { hour: '2-digit', minute: '2-digit' })}</p><p className="muted">Missing then: {packet.carePlan.missingInformation.join('; ')}</p></>}</div>
      <ol className="care-timeline">{state.events.map(event => <li key={event.id}><b>{formatDate(event.recordedAt, { hour: '2-digit', minute: '2-digit' })} · {event.change}</b><p>{event.observation}</p><p className="muted">{procedureLabel(event.plan.procedure)}</p><p>Next: {event.plan.nextCheck} · {formatDate(event.plan.dueAt, { hour: '2-digit', minute: '2-digit' })}</p><p className="muted">Missing then: {event.plan.missingInformation.join('; ')}</p>{event.measurements.length ? <details><summary>{event.measurements.length} new measured values</summary><ul>{event.measurements.map((m, i) => <li key={i}>{measuredValue(m)} · {formatDate(m.measuredAt, { hour: '2-digit', minute: '2-digit' })}</li>)}</ul></details> : <p className="muted">No new measured values attached; this event contains crew observations.</p>}</li>)}</ol>
      <div className="care-gaps"><b>Still missing</b><ul>{(state.plan?.missingInformation ?? ['Not documented in this older packet.']).map((gap, i) => <li key={i}>{gap}</li>)}</ul></div>
      <form className="care-reassessment" aria-label={`Reassess Sol ${packet.sol} handoff`} onSubmit={e => void save(e)}>
        <h4>Record a reassessment</h4>
        <label className="field">What changed after the check<textarea required rows={3} maxLength={1000} value={observation} onChange={e => setObservation(e.target.value)} placeholder="Describe what the crew observed after repeating the check"/></label>
        <label className="field">Change reported by crew<select aria-label="Change reported by crew" value={change} onChange={e => setChange(e.target.value as CareUpdate['change'])}><option value="unclear">Unclear</option><option value="improved">Improved</option><option value="unchanged">Unchanged</option><option value="worse">Worse</option></select></label>
        <CarePlanFields plan={plan} onChange={setPlan}/>
        <button className="btn" disabled={saving || !observation.trim()}>{saving ? 'Saving…' : 'Save reassessment'}</button>
        {error && <p className="error" role="alert">{error}</p>}
        <p className="muted">Adds a dated event to this packet. Crew observations are not reviewed ground instructions.</p>
      </form>
    </details>
  </li>;
}

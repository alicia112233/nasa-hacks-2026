import { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import Dialog from './Dialog';
import { downloadFile } from './data';
import { advanceIncident, emergencyHandoff, supportInstruction } from './emergency.mjs';
import type { EmergencyIncident } from './types';

export default function EmergencyWorkflow({ incident, onSave, onClose }: { incident: EmergencyIncident; onSave: (next: EmergencyIncident) => Promise<void>; onClose: () => void }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [incident.step, incident.endedAt]);
  const step = incident.procedure.steps[incident.step];
  async function answer(response: string) {
    setBusy(true); setError('');
    try { await onSave(advanceIncident(incident, response, note, new Date().toISOString())); setNote(''); }
    catch { setError('Couldn’t save this step. Keep going with the response and try again.'); }
    finally { setBusy(false); }
  }
  return <Dialog title="Emergency response" wide onClose={onClose} label="Close and keep emergency log">
    <div className="emergency-meta"><b>{incident.crewName}{incident.simulated ? ' · drill' : ''}</b><span>{incident.procedure.id} v{incident.procedure.version}</span></div>
    <p className="review-warning">Not clinician-reviewed. In a real emergency, follow your mission’s approved medical procedure.</p>
    <div className="emergency-layout">
      <section aria-label="Current emergency step" className="emergency-step">
        <h3 tabIndex={-1} ref={heading} data-autofocus>{incident.endedAt ? 'Care transferred' : step.title}</h3>
        <p>{incident.endedAt ? 'Log saved on this device. Download it for the medical lead.' : step.text}</p>
        {!incident.endedAt && <>
          {incident.step === 'support' && <p>{supportInstruction(incident)}</p>}
          <label className="field">Observation or helper’s name (optional)<textarea rows={2} maxLength={1000} value={note} onChange={e => setNote(e.target.value)}/></label>
          <div className="emergency-answers">{step.answers.map((a, i) => <button key={a} className={`btn ${step.answers.length === 1 && i === 0 ? 'primary' : ''}`} disabled={busy} onClick={() => void answer(a)}>{a}</button>)}</div>
        </>}
        {error && <p className="error" role="alert">{error}</p>}
      </section>
      <aside className="emergency-log" aria-label="Handoff being prepared">
        <h3>Log · {incident.events.length} steps</h3>
        <p className="muted">Started {new Date(incident.startedAt).toISOString().replace('T', ' ').slice(0, 19)} UTC · saved after each answer</p>
        <ol>{incident.events.map((event, i) => <li key={i}><time dateTime={event.at}>{event.at.slice(11, 19)} UTC</time><b>{event.response}</b>{event.note && <p>{event.note}</p>}</li>)}</ol>
        <button className="btn" onClick={() => downloadFile(`ghostpilot-emergency-${incident.id}.json`, JSON.stringify(emergencyHandoff(incident), null, 2), 'application/json')}><Download size={16}/> Download log</button>
      </aside>
    </div>
  </Dialog>;
}

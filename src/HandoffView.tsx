import { useState } from 'react';
import { Check, Download, FileText, Radio } from 'lucide-react';
import { createMissionPacket, lensSnapshot } from './mission-lens.mjs';
import { downloadFile, formatDate } from './data';
import { groundReport, regionSummary } from './report';
import { emergencyHandoff } from './emergency.mjs';
import CarePlanFields, { blankCarePlan } from './CarePlanFields';
import CareThread from './CareThread';
import { validateCarePlan } from './continuing-care.mjs';
import type { CareUpdate, FollowUp, MissionPacket, MissionState, Recording } from './types';

interface Props {
  mission: MissionState; recordings: Recording[]; sol: number;
  delay: number; setDelay: (n: number) => void;
  /** Note carried from a finished region card. */
  note?: string;
  onSavePacket: (p: MissionPacket) => Promise<void>;
  onDownloaded: (id: string) => void;
  onComplete: (a: FollowUp) => void;
  onEmergency: (id: string) => void;
  onSaveCareUpdate: (event: CareUpdate) => Promise<void>;
}

export default function HandoffView({ mission, recordings, sol, delay, setDelay, onSavePacket, onDownloaded, onComplete, onEmergency, onSaveCareUpdate, note = '' }: Props) {
  const [blackout, setBlackout] = useState(false);
  const [context, setContext] = useState(note);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [carePlan, setCarePlan] = useState(blankCarePlan);
  const simulated = mission.demo;
  const packets = (mission.packets ?? []).filter(p => p.source === (simulated ? 'simulated' : 'recorded'));
  const actions = mission.actions.filter(a => a.simulated === simulated);
  const snapshot = lensSnapshot(mission.checkIns, simulated, undefined, mission.references);
  const emergencies = (mission.emergencies ?? []).filter(e => e.simulated === simulated);

  async function save() {
    setSaving(true); setError('');
    try {
      const now = new Date().toISOString();
      const plan = validateCarePlan(carePlan, now);
      const packet = createMissionPacket({ snapshot, profile: mission.profile, actions: mission.actions, context: context.trim(), oneWayMinutes: delay, blackoutDrill: blackout, id: crypto.randomUUID(), createdAt: now }) as MissionPacket;
      packet.carePlan = plan;
      packet.analysis.bodyIndex = regionSummary(mission.checkIns, simulated, mission.references);
      packet.analysis.comparisons = snapshot.analysis.comparisons;
      packet.analysis.referenceSnapshots = structuredClone((mission.references ?? []).filter(r => r.simulated === simulated));
      packet.analysis.cabinReadings = (mission.cabinReadings ?? []).filter(r => r.source === (simulated ? 'simulated' : 'manual'));
      await onSavePacket(packet);
      setContext('');
      setCarePlan(blankCarePlan());
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save on this device.'); }
    finally { setSaving(false); }
  }
  const report = () => groundReport(mission, recordings, sol);

  return <div className="page-grid handoff">
    <section className="sheet">
      <h2>Continuing care</h2>
      <p>Record the observation, procedure and next check for the medical team: onboard clinician, doctor, nurse or flight surgeon.</p>
      <div className="link-state">
        <Radio size={20}/>
        <div><b>{blackout ? 'Blackout drill' : `${delay} min one way · scenario`}</b><span>{blackout ? 'Continue care offline; save each reassessment.' : `Allow ${delay * 2}+ min for a reply if a link is available.`}</span></div>
      </div>
      <label className="field">One-way delay <output>{delay} min</output><input type="range" min={0} max={30} value={delay} disabled={blackout} onChange={e => setDelay(Number(e.target.value))}/></label>
      <label className="check"><input type="checkbox" checked={blackout} onChange={e => setBlackout(e.target.checked)}/> Blackout drill</label>
      <form className="care-form" onSubmit={e => { e.preventDefault(); void save(); }}>
      <label className="field">Observation for medical team<textarea data-tour="observation" required rows={3} maxLength={500} value={context} onChange={e => setContext(e.target.value)} placeholder="What did the crew observe, and when did it start?"/></label>
      <CarePlanFields plan={carePlan} onChange={setCarePlan}/>
      <button className="btn primary" disabled={saving || !snapshot.latest || !context.trim()}>{saving ? 'Saving…' : 'Save handoff'}</button>
      </form>
      {!snapshot.latest && <p className="muted">Run a check first.</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="delivery-note"><b>How to share a handoff</b><p>This prototype has no ground connection. Download the saved packet, then transfer the file through your mission’s communication channel when it is available. GhostPilot cannot confirm delivery.</p></div>
    </section>

    <section className="sheet">
      <h2>Saved <small>{packets.length}</small></h2>
      <h3>Emergency handoffs</h3>
      <ol className="packets">{emergencies.slice().reverse().map(e => <li key={e.id}><span><b>{e.crewName} · {e.endedAt ? 'Care transferred' : 'In progress'}</b><br/>{formatDate(e.startedAt, { hour: '2-digit', minute: '2-digit' })} · {e.events.length} steps · {e.procedure.id} v{e.procedure.version} · unreviewed demo · not sent</span><div className="row-actions"><button className="btn" onClick={() => onEmergency(e.id)}>{e.endedAt ? 'Review log' : 'Resume response'}</button><button className="btn" onClick={() => downloadFile(`ghostpilot-emergency-${e.id}.json`, JSON.stringify(emergencyHandoff(e), null, 2), 'application/json')}>Download emergency handoff</button></div></li>)}</ol>
      {!emergencies.length && <p className="muted">No emergency logs. Emergency response works without a baseline or earlier checks.</p>}
      <h3>Care records</h3>
      <ol className="packets care-records">{packets.slice().reverse().map(p => <CareThread key={p.id} packet={p} updates={mission.careUpdates ?? []} checkIns={mission.checkIns} onSave={onSaveCareUpdate} onDownloaded={onDownloaded}/>)}</ol>
      {!packets.length && <p className="muted">None yet.</p>}

      <h3>Ground report</h3>
      <div className="row-actions">
        <button className="btn" onClick={() => downloadFile(`ghostpilot-sol-${sol}.md`, report().md)}><FileText size={16}/> Markdown</button>
        <button className="btn" onClick={() => downloadFile(`ghostpilot-sol-${sol}.json`, JSON.stringify(report().json, null, 2), 'application/json')}><Download size={16}/> JSON</button>
      </div>

      <h3>Follow-ups</h3>
      <ol className="packets">{actions.slice().reverse().map(a => <li key={a.id} className={a.status}>
        <span><b>{a.title}</b> · {formatDate(a.scheduledAt)}</span>
        {a.status === 'scheduled' ? <button className="btn ghost" onClick={() => onComplete(a)}><Check size={16}/> Done</button> : <span className="muted">Done</span>}
      </li>)}</ol>
      {!actions.length && <p className="muted">None yet.</p>}
    </section>
  </div>;
}

import { useState } from 'react';
import { Check, Download, FileText, Radio } from 'lucide-react';
import { createMissionPacket, lensSnapshot } from './mission-lens.mjs';
import { downloadFile, formatDate } from './data';
import { groundReport, regionSummary } from './report';
import type { FollowUp, MissionPacket, MissionState, Recording } from './types';

interface Props {
  mission: MissionState; recordings: Recording[]; sol: number;
  delay: number; setDelay: (n: number) => void;
  /** Note carried from a finished region card. */
  note?: string;
  onSavePacket: (p: MissionPacket) => Promise<void>;
  onDownloaded: (id: string) => void;
  onComplete: (a: FollowUp) => void;
}

export default function HandoffView({ mission, recordings, sol, delay, setDelay, onSavePacket, onDownloaded, onComplete, note = '' }: Props) {
  const [blackout, setBlackout] = useState(false);
  const [context, setContext] = useState(note);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const simulated = mission.demo;
  const packets = (mission.packets ?? []).filter(p => p.source === (simulated ? 'simulated' : 'recorded'));
  const actions = mission.actions.filter(a => a.simulated === simulated);
  const snapshot = lensSnapshot(mission.checkIns, simulated);

  async function save() {
    setSaving(true); setError('');
    try {
      const packet = createMissionPacket({ snapshot, profile: mission.profile, actions: mission.actions, context: context.trim(), oneWayMinutes: delay, blackoutDrill: blackout, id: crypto.randomUUID(), createdAt: new Date().toISOString() }) as MissionPacket;
      packet.analysis.bodyIndex = regionSummary(mission.checkIns, simulated);
      await onSavePacket(packet);
      setContext('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save on this device.'); }
    finally { setSaving(false); }
  }
  function download(p: MissionPacket) {
    downloadFile(`ghostpilot-handoff-sol-${p.sol}.json`, JSON.stringify({ ...p, status: 'downloaded' }, null, 2), 'application/json');
    onDownloaded(p.id);
  }
  const report = () => groundReport(mission, recordings, sol);

  return <div className="page-grid handoff">
    <section className="sheet">
      <h2>Onboard handoff</h2>
      <div className="link-state">
        <Radio size={20}/>
        <div><b>{blackout ? 'Blackout' : `${delay} min one way`}</b><span>{blackout ? 'No ground link. Handoffs queue on board.' : `Ground answer in ${delay * 2}+ min.`}</span></div>
      </div>
      <label className="field">One-way delay <output>{delay} min</output><input type="range" min={0} max={30} value={delay} disabled={blackout} onChange={e => setDelay(Number(e.target.value))}/></label>
      <label className="check"><input type="checkbox" checked={blackout} onChange={e => setBlackout(e.target.checked)}/> Blackout drill</label>
      <label className="field">Note for the surgeon<textarea rows={3} maxLength={500} value={context} onChange={e => setContext(e.target.value)}/></label>
      <button className="btn primary" disabled={saving || !snapshot.latest} onClick={save}>{saving ? 'Saving…' : 'Save handoff'}</button>
      {!snapshot.latest && <p className="muted">Run a check first.</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <p className="muted">Saved on this device. Downloads are not transmissions.</p>
    </section>

    <section className="sheet">
      <h2>Saved <small>{packets.length}</small></h2>
      <ol className="packets">{packets.slice().reverse().map(p => <li key={p.id}>
        <span><b>Sol {p.sol}</b> · {formatDate(p.createdAt, { hour: '2-digit', minute: '2-digit' })} · {p.status === 'downloaded' ? 'Downloaded · not sent' : 'Queued · not sent'}{p.communication.blackoutDrill ? ' · blackout' : ''}</span>
        <button className="btn ghost" aria-label={`Download Sol ${p.sol} handoff`} onClick={() => download(p)}><Download size={16}/></button>
      </li>)}</ol>
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

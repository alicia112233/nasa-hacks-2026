import { useState } from 'react';
import { Check, Download, FileText, Printer, Send } from 'lucide-react';
import { createMissionPacket, lensSnapshot } from './mission-lens.mjs';
import { downloadFile, formatDate } from './data';
import { groundReport, regionSummary } from './report';
import { emergencyHandoff } from './emergency.mjs';
import CarePlanFields from './CarePlanFields';
import CareThread from './CareThread';
import { validateCarePlan } from './continuing-care.mjs';
import { dayKey } from './body.mjs';
import type { CarePlan, CareUpdate, FollowUp, MissionPacket, MissionState, Recording } from './types';

type Row = { region: { id: string; letter: string; label: string }; check: { id: string; title: string; needs?: string }; state: 'done' | 'off' | 'todo'; item: { flagged: boolean }; result: { text: string } | null };
type Summary = {
  rows: Row[]; done: number; total: number;
  physical: { done: number; total: number }; mental: { done: number; total: number };
  attention: { region: { letter: string; label: string }; check: { id: string; title: string }; label: string; urgent: boolean; step: string | null }[];
  notMeasured: { region: { letter: string; label: string }; check: { id: string; title: string; needs?: string } }[];
};

interface Props {
  mission: MissionState; recordings: Recording[]; sol: number; summary: Summary;
  delay: number; setDelay: (n: number) => void;
  onSavePacket: (p: MissionPacket) => Promise<void>;
  onDownloaded: (id: string) => void;
  onComplete: (a: FollowUp) => void;
  onEmergency: (id: string) => void;
  onSaveCareUpdate: (event: CareUpdate) => Promise<void>;
}

/** The follow-up plan a handoff carries, filled in from the day: what was not measured, and tomorrow's check. */
function dayPlan(summary: Summary): CarePlan {
  const notDone = summary.rows.filter(r => r.state === 'todo').map(r => r.check.title);
  const missing = [...summary.notMeasured.map(n => `${n.check.title}: ${(n.check.needs ?? 'needs equipment').replace(/^Needs /, 'needs ')}`), ...(notDone.length ? [`Not checked today: ${notDone.join(', ')}`] : [])];
  return { procedure: { status: 'unknown', name: '', version: '' }, nextCheck: 'Tomorrow’s daily check', dueAt: new Date(Date.now() + 86400000).toISOString(), missingInformation: missing.length ? missing : ['None identified'] };
}
const result = (row: Row) => row.result ? row.result.text.replace(/^Today /, '') : 'Not done';
const status = (row: Row) => row.state === 'off' ? (row.item.flagged ? 'Trend' : 'Off') : '';

export default function ReportView({ mission, recordings, sol, summary, delay, setDelay, onSavePacket, onDownloaded, onComplete, onEmergency, onSaveCareUpdate }: Props) {
  const [blackout, setBlackout] = useState(false);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [plan, setPlan] = useState(() => dayPlan(summary));
  const simulated = mission.demo;
  const packets = (mission.packets ?? []).filter(p => p.source === (simulated ? 'simulated' : 'recorded'));
  const today = packets.filter(p => dayKey(p.createdAt) === dayKey(new Date().toISOString())).at(-1);
  const actions = mission.actions.filter(a => a.simulated === simulated);
  const snapshot = lensSnapshot(mission.checkIns, simulated, undefined, mission.references);
  const emergencies = (mission.emergencies ?? []).filter(e => e.simulated === simulated);
  const trends = summary.attention.filter(a => a.label === 'Trend').length;
  const doneRows = summary.rows.filter(r => r.state !== 'todo');
  const regions = [...new Map(doneRows.map(r => [r.region.letter, r.region])).values()];
  const notDone = summary.rows.filter(r => r.state === 'todo');
  const headline = `${summary.done} of ${summary.total} checks done${trends ? ` · ${trends} trend${trends === 1 ? '' : 's'}` : ''}${summary.attention.length - trends ? ` · ${summary.attention.length - trends} reported` : ''}`;

  async function handOff() {
    setSaving(true); setError('');
    try {
      const now = new Date().toISOString();
      const carePlan = validateCarePlan(plan, now);
      const packet = createMissionPacket({ snapshot, profile: mission.profile, actions: mission.actions, context: note.trim() || headline, oneWayMinutes: delay, blackoutDrill: blackout, id: crypto.randomUUID(), createdAt: now }) as MissionPacket;
      packet.carePlan = carePlan;
      packet.analysis.bodyIndex = regionSummary(mission.checkIns, simulated, mission.references);
      packet.analysis.comparisons = snapshot.analysis.comparisons;
      packet.analysis.referenceSnapshots = structuredClone((mission.references ?? []).filter(r => r.simulated === simulated));
      packet.analysis.cabinReadings = (mission.cabinReadings ?? []).filter(r => r.source === (simulated ? 'simulated' : 'manual'));
      await onSavePacket(packet);
      setNote('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save on this device.'); }
    finally { setSaving(false); }
  }
  const ground = () => groundReport(mission, recordings, sol);

  return <div className="page-grid report">
    <article className="sheet report-sheet" aria-labelledby="report-title">
      <header className="report-head">
        <h2 id="report-title">Daily report</h2>
        <p>{mission.profile.name}{mission.profile.mission ? ` · ${mission.profile.mission}` : ''} · Sol {sol} · {formatDate(new Date().toISOString())} · {simulated ? 'Demo data' : 'Your records'}</p>
      </header>
      <dl className="report-stats">
        <div><dt>Physical</dt><dd>{summary.physical.done}/{summary.physical.total}</dd></div>
        <div><dt>Mental</dt><dd>{summary.mental.done}/{summary.mental.total}</dd></div>
        <div><dt>Trends</dt><dd>{trends}</dd></div>
        <div><dt>Reported</dt><dd>{summary.attention.length - trends}</dd></div>
      </dl>

      <section aria-labelledby="report-attention">
        <h3 id="report-attention">Needs attention</h3>
        {summary.attention.length ? <ul className="report-attention">{summary.attention.map(a => <li key={`${a.region.letter}-${a.check.id}`}>
          <b className={`report-label ${a.label === 'Trend' || a.urgent ? 'flag' : ''}`}>{a.label}</b>
          <span><strong>{a.check.title}</strong> · {a.region.letter} {a.region.label}{a.step && <><br/>{a.step}</>}</span>
        </li>)}</ul> : <p className="muted">Nothing off today.</p>}
      </section>

      <section aria-labelledby="report-results">
        <h3 id="report-results">Results</h3>
        {doneRows.length ? <table className="ledger small report-table">
          <thead><tr><th scope="col">Check</th><th scope="col">Today</th><th scope="col"><span className="sr">Status</span></th></tr></thead>
          {regions.map(region => <tbody key={region.letter}>
            <tr className="report-region"><th scope="rowgroup" colSpan={3}>{region.letter} {region.label}</th></tr>
            {doneRows.filter(r => r.region.letter === region.letter).map(r => <tr key={r.check.id} className={r.state}>
              <th scope="row">{r.check.title}</th><td>{result(r)}</td><td>{status(r) && <b className={`report-label ${r.item.flagged ? 'flag' : ''}`}>{status(r)}</b>}</td>
            </tr>)}
          </tbody>)}
        </table> : <p className="muted">No checks done yet today.</p>}
        {notDone.length > 0 && <p className="report-todo"><b>Not done today</b> {notDone.map(r => r.check.title).join(' · ')}</p>}
      </section>

      <section aria-labelledby="report-gaps">
        <h3 id="report-gaps">Not measured onboard</h3>
        <p>{summary.notMeasured.map(n => `${n.check.title} (${n.region.label.toLowerCase()})`).join(' · ')}</p>
      </section>
      {note.trim() && <section aria-labelledby="report-note"><h3 id="report-note">Note for the medical team</h3><p className="report-note">{note}</p></section>}
    </article>

    <section className="sheet handoff-sheet" aria-labelledby="handoff-title">
      <h2 id="handoff-title">Hand off</h2>
      {today && <p className="handoff-done"><Check size={18} aria-hidden="true"/> Handed off at {formatDate(today.createdAt, { hour: '2-digit', minute: '2-digit' })}. Saved on this device.</p>}
      <label className="field">Note for the medical team<textarea rows={3} maxLength={500} value={note} onChange={e => setNote(e.target.value)} placeholder="Optional. Anything the numbers don’t show."/></label>
      <details className="report-plan"><summary>Follow-up plan · {plan.nextCheck || 'not set'}</summary><CarePlanFields plan={plan} onChange={setPlan}/></details>
      <details className="report-link"><summary>Link · {blackout ? 'blackout drill' : `${delay} min one way`}</summary>
        <label className="field">One-way delay <output>{delay} min</output><input type="range" min={0} max={30} value={delay} disabled={blackout} onChange={e => setDelay(Number(e.target.value))}/></label>
        <label className="check"><input type="checkbox" checked={blackout} onChange={e => setBlackout(e.target.checked)}/> Blackout drill</label>
      </details>
      <button className="btn primary" disabled={saving || !snapshot.latest} onClick={() => void handOff()}><Send size={16} aria-hidden="true"/>{saving ? 'Saving…' : today ? 'Hand off again' : 'Hand off today’s report'}</button>
      {!snapshot.latest && <p className="muted">Do a check first.</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="row-actions report-downloads">
        <button className="btn" onClick={() => window.print()}><Printer size={16} aria-hidden="true"/> Save as PDF</button>
        <button className="btn" onClick={() => downloadFile(`ghostpilot-sol-${sol}.md`, ground().md)}><FileText size={16} aria-hidden="true"/> Markdown</button>
        <button className="btn" onClick={() => downloadFile(`ghostpilot-sol-${sol}.json`, JSON.stringify(ground().json, null, 2), 'application/json')}><Download size={16} aria-hidden="true"/> JSON</button>
      </div>
      <p className="muted">Send the file over mission comms.</p>

      <h3>Past reports <small>{packets.length}</small></h3>
      <ol className="packets care-records">{packets.slice().reverse().map(p => <CareThread key={p.id} packet={p} updates={mission.careUpdates ?? []} checkIns={mission.checkIns} onSave={onSaveCareUpdate} onDownloaded={onDownloaded}/>)}</ol>
      {!packets.length && <p className="muted">None yet.</p>}

      {emergencies.length > 0 && <><h3>Emergency logs</h3>
      <ol className="packets">{emergencies.slice().reverse().map(e => <li key={e.id}><span><b>{e.crewName} · {e.endedAt ? 'Care transferred' : 'In progress'}</b><br/>{formatDate(e.startedAt, { hour: '2-digit', minute: '2-digit' })} · {e.events.length} steps · not sent</span><div className="row-actions"><button className="btn" onClick={() => onEmergency(e.id)}>{e.endedAt ? 'Review log' : 'Resume response'}</button><button className="btn" onClick={() => downloadFile(`ghostpilot-emergency-${e.id}.json`, JSON.stringify(emergencyHandoff(e), null, 2), 'application/json')}><Download size={16}/> Download log</button></div></li>)}</ol></>}

      {actions.length > 0 && <><h3>Follow-ups</h3>
      <ol className="packets">{actions.slice().reverse().map(a => <li key={a.id} className={a.status}>
        <span><b>{a.title}</b> · {formatDate(a.scheduledAt)}</span>
        {a.status === 'scheduled' ? <button className="btn ghost" onClick={() => onComplete(a)}><Check size={16}/> Done</button> : <span className="muted">Done</span>}
      </li>)}</ol></>}
    </section>
  </div>;
}

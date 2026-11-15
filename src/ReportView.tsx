import { useMemo, useState } from 'react';
import { Check, Download, FileText, Printer, Send } from 'lucide-react';
import { createMissionPacket, lensSnapshot } from './mission-lens.mjs';
import { downloadFile, formatDate } from './data';
import { groundReport, regionSummary } from './report';
import CarePlanFields from './CarePlanFields';
import CareThread from './CareThread';
import { validateCarePlan } from './continuing-care.mjs';
import { dayKey, regionStatuses, topicOf } from './body.mjs';
import { daySummary } from './today.mjs';
import { analyze } from './rules.mjs';
import { compactExport } from './export.mjs';
import type { CarePlan, CareUpdate, MissionPacket, MissionState, Recording } from './types';

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
  onSaveCareUpdate: (event: CareUpdate) => Promise<void>;
}

const topics = (rows: Row[]) => rows.map(r => topicOf(r.check).toLowerCase()).join(', ');
/** The follow-up plan a handoff carries, filled in from the day: what was not measured, and tomorrow's check. */
function dayPlan(summary: Summary): CarePlan {
  const notDone = summary.rows.filter(r => r.state === 'todo');
  const missing = [...summary.notMeasured.map(n => `${n.check.title}: ${(n.check.needs ?? 'needs equipment').replace(/^Needs /, 'needs ')}`), ...(notDone.length ? [`Not checked today: ${topics(notDone)}`] : [])];
  return { procedure: { status: 'unknown', name: '', version: '' }, nextCheck: 'Tomorrow’s daily check', dueAt: new Date(Date.now() + 86400000).toISOString(), missingInformation: missing.length ? missing : ['None identified'] };
}
const result = (row: Row) => row.result ? row.result.text.replace(/^Today /, '') : '';
const status = (row: Row) => row.state === 'off' ? 'Alert' : '';
/** Noon on a day key, in the app's mission timezone, so every check that day falls on it. */
const noonOf = (day: string) => `${day}T12:00:00+08:00`;

export default function ReportView({ mission, recordings, sol, summary, delay, setDelay, onSavePacket, onDownloaded, onSaveCareUpdate }: Props) {
  const [blackout, setBlackout] = useState(false);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [plan, setPlan] = useState(() => dayPlan(summary));
  const simulated = mission.demo;
  const todayKey = dayKey(new Date().toISOString());
  const [day, setDay] = useState(todayKey);
  const records = mission.checkIns.filter(c => c.simulated === simulated);
  // Every day with readings, newest first; today is always there to fill in.
  const days = [...new Set([todayKey, ...records.map(c => dayKey(c.date))])].sort().reverse();
  const solOf = (d: string) => d === todayKey ? sol : records.find(c => dayKey(c.date) === d)?.sol;
  const isToday = day === todayKey;
  // A past day is rebuilt from the readings up to that day, so its trends are the ones it had then.
  const shown: Summary = useMemo(() => {
    if (isToday) return summary;
    const upTo = mission.checkIns.filter(c => dayKey(c.date) <= day);
    return daySummary(regionStatuses(upTo, simulated, noonOf(day), mission.references), analyze(upTo, simulated, mission.references).baseline) as unknown as Summary;
  }, [isToday, summary, mission.checkIns, mission.references, simulated, day]);
  const packets = (mission.packets ?? []).filter(p => p.source === (simulated ? 'simulated' : 'recorded'));
  const handedOff = packets.filter(p => dayKey(p.createdAt) === day).at(-1);
  const snapshot = lensSnapshot(mission.checkIns, simulated, undefined, mission.references);
  const doneRows = shown.rows.filter(r => r.state !== 'todo');
  const regions = [...new Map(doneRows.map(r => [r.region.letter, r.region])).values()];
  const notDone = shown.rows.filter(r => r.state === 'todo');
  const headline = `${summary.done} of ${summary.total} checks done${summary.attention.length ? ` · ${summary.attention.length} alert${summary.attention.length === 1 ? '' : 's'}` : ''}`;

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
  const dayLabel = (d: string) => `${d === todayKey ? 'Today' : formatDate(noonOf(d))}${solOf(d) ? ` · Sol ${solOf(d)}` : ''}`;

  return <div className="page-grid report">
    <article className="sheet report-sheet" aria-labelledby="report-title">
      <header className="report-head">
        <div className="report-title-row">
          <h2 id="report-title">Daily report</h2>
          <label className="report-day"><span className="sr">Day</span><select value={day} onChange={e => setDay(e.target.value)}>{days.map(d => <option key={d} value={d}>{dayLabel(d)}</option>)}</select></label>
        </div>
        <p>{mission.profile.name}{mission.profile.mission ? ` · ${mission.profile.mission}` : ''}{solOf(day) ? ` · Sol ${solOf(day)}` : ''} · {formatDate(noonOf(day))}</p>
      </header>
      <dl className="report-stats">
        <div><dt>Physical</dt><dd>{shown.physical.done}/{shown.physical.total}</dd></div>
        <div><dt>Mental</dt><dd>{shown.mental.done}/{shown.mental.total}</dd></div>
        <div><dt>Alerts</dt><dd>{shown.attention.length}</dd></div>
        <div><dt>To check</dt><dd>{notDone.length}</dd></div>
      </dl>

      <section aria-labelledby="report-attention">
        <h3 id="report-attention">Needs attention</h3>
        {shown.attention.length ? <ul className="report-attention">{shown.attention.map(a => <li key={`${a.region.letter}-${a.check.id}`}>
          <b className="report-label flag">{a.label}</b>
          <span><strong>{a.check.title}</strong> · {a.region.letter} {a.region.label}{a.step && <><br/>{a.step}</>}</span>
        </li>)}</ul> : <p className="muted">Nothing off.</p>}
      </section>

      <section aria-labelledby="report-results">
        <h3 id="report-results">Results</h3>
        {doneRows.length ? <table className="ledger small report-table">
          <thead><tr><th scope="col">Check</th><th scope="col">Result</th><th scope="col"><span className="sr">Status</span></th></tr></thead>
          {regions.map(region => <tbody key={region.letter}>
            <tr className="report-region"><th scope="rowgroup" colSpan={3}>{region.letter} {region.label}</th></tr>
            {doneRows.filter(r => r.region.letter === region.letter).map(r => <tr key={r.check.id} className={r.state}>
              <th scope="row">{r.check.title}</th><td>{result(r)}</td><td>{status(r) && <b className="report-label flag">{status(r)}</b>}</td>
            </tr>)}
          </tbody>)}
        </table> : <p className="muted">No checks done{isToday ? ' yet today' : ' that day'}.</p>}
        {notDone.length > 0 && <p className="report-todo"><b>{isToday ? `Still to check (${notDone.length})` : `Not checked (${notDone.length})`}</b> {topics(notDone)}</p>}
      </section>

      <section aria-labelledby="report-gaps">
        <h3 id="report-gaps">Not measured onboard</h3>
        <p>{shown.notMeasured.map(n => `${n.check.title} (${n.region.label.toLowerCase()})`).join(' · ')}</p>
      </section>
      {isToday && note.trim() && <section aria-labelledby="report-note"><h3 id="report-note">Note</h3><p className="report-note">{note}</p></section>}
    </article>

    <section className="sheet handoff-sheet" aria-labelledby="handoff-title">
      <h2 id="handoff-title">Hand off</h2>
      {handedOff ? <p className="handoff-done"><Check size={18} aria-hidden="true"/> Handed off at {formatDate(handedOff.createdAt, { hour: '2-digit', minute: '2-digit' })}. Saved on this device.</p>
        : !isToday && <p className="muted">Not handed off that day.</p>}
      {isToday ? <>
        <label className="field">Note for the medical team<textarea rows={3} maxLength={500} value={note} onChange={e => setNote(e.target.value)} placeholder="Optional. Anything the numbers don’t show."/></label>
        <details className="report-plan"><summary>Follow-up plan · {plan.nextCheck || 'not set'}</summary><div className="report-section-body"><CarePlanFields plan={plan} onChange={setPlan}/></div></details>
        <details className="report-link"><summary>Link · {blackout ? 'blackout drill' : `${delay} min one way`}</summary><div className="report-section-body">
          <label className="field">One-way delay <output>{delay} min</output><input type="range" min={0} max={30} value={delay} disabled={blackout} onChange={e => setDelay(Number(e.target.value))}/></label>
          <label className="check"><input type="checkbox" checked={blackout} onChange={e => setBlackout(e.target.checked)}/> Blackout drill</label>
        </div></details>
        <button className="btn primary" disabled={saving || !snapshot.latest} onClick={() => void handOff()}><Send size={16} aria-hidden="true"/>{saving ? 'Saving…' : handedOff ? 'Hand off again' : 'Hand off today’s report'}</button>
        {!snapshot.latest && <p className="muted">Do a check first.</p>}
        {error && <p className="error" role="alert">{error}</p>}
      </> : <button className="btn" onClick={() => setDay(todayKey)}>Back to today</button>}
      <div className="row-actions report-downloads">
        <button className="btn" onClick={() => window.print()}><Printer size={16} aria-hidden="true"/> Save as PDF</button>
        <button className="btn" onClick={() => downloadFile(`ghostpilot-sol-${sol}.md`, ground().md)}><FileText size={16} aria-hidden="true"/> Markdown</button>
        <button className="btn" onClick={() => downloadFile(`ghostpilot-sol-${sol}.json`, JSON.stringify(compactExport(ground().json), null, 2), 'application/json')}><Download size={16} aria-hidden="true"/> JSON</button>
      </div>
      <p className="muted">Send the file over mission comms.</p>

      <h3>Handed-off reports <small>{packets.length}</small></h3>
      <ol className="packets care-records">{packets.slice().reverse().map(p => <CareThread key={p.id} packet={p} updates={mission.careUpdates ?? []} checkIns={mission.checkIns} onSave={onSaveCareUpdate} onDownloaded={onDownloaded}/>)}</ol>
      {!packets.length && <p className="muted">None yet.</p>}
    </section>
  </div>;
}

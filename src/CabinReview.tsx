import { useState } from 'react';
import { crewHeadaches } from './daily.mjs';
import { formatDate } from './data';
import type { CabinReading, MissionState } from './types';

export default function CabinReview({ mission, onSave }: { mission: MissionState; onSave: (r: CabinReading) => void }) {
  const [procedure, setProcedure] = useState(false);
  const [error, setError] = useState('');
  const reports: string[] = crewHeadaches(mission.checkIns, mission.demo);
  const readings = (mission.cabinReadings ?? []).filter(r => r.source === (mission.demo ? 'simulated' : 'manual')).slice().sort((a, b) => a.date.localeCompare(b.date));
  const latest = readings.at(-1);
  const stale = latest && Date.now() - Date.parse(latest.date) > 3600000;
  return <section className="cabin-review" aria-labelledby="cabin-review-title">
    <h3 id="cabin-review-title">Cabin air check</h3>
    <p>{reports.length >= 2 ? `${reports.length} crew reported headaches in the last day. High CO₂ is one possible cause: check current readings and follow your air-quality procedure.` : reports.length === 1 ? '1 crew member reported a headache in the last day.' : 'No headaches reported in the last day.'}</p>
    <p className="muted"><a href="https://www.nasa.gov/ochmo-tb-004-carbon-dioxide-2/" target="_blank" rel="noreferrer">NASA CO₂ guidance</a></p>
    <div className="cabin-current"><b>Latest cabin reading</b>
      {latest ? <><p>{latest.co2Ppm} ppm CO₂ · {latest.temperatureC ?? '—'} °C · {latest.humidityPct ?? '—'}% RH</p><p className="muted">{latest.location} · {formatDate(latest.date, { hour: '2-digit', minute: '2-digit' })} · {stale ? 'over an hour old; take a new reading' : 'within the last hour'}</p></> : <p>No cabin reading yet. Log one below.</p>}
    </div>
    <details><summary>Log a cabin reading</summary>
      <form className="context-fields" onSubmit={e => {
        e.preventDefault(); const f = new FormData(e.currentTarget); const date = new Date(String(f.get('date')));
        if (!Number.isFinite(date.getTime()) || date.getTime() > Date.now()) { setError('The time can’t be in the future.'); return; }
        const optional = (key: string) => f.get(key) === '' ? undefined : Number(f.get(key));
        onSave({ id: crypto.randomUUID(), date: date.toISOString(), location: String(f.get('location')).trim(), co2Ppm: Number(f.get('co2')), temperatureC: optional('temperature'), humidityPct: optional('humidity'), source: mission.demo ? 'simulated' : 'manual' }); setError(''); e.currentTarget.reset();
      }}>
        <label className="field">CO₂ (ppm)<input name="co2" type="number" min={0} max={1000000} required/></label>
        <label className="field">Observed at<input name="date" type="datetime-local" required/></label>
        <label className="field">Location / sensor<input name="location" required maxLength={120}/></label>
        <label className="field">Temperature °C (optional)<input name="temperature" type="number" step="0.1" min={-100} max={100}/></label>
        <label className="field">Humidity % (optional)<input name="humidity" type="number" min={0} max={100}/></label>
        <button className="btn">Save reading</button>
      </form>{error && <p className="error" role="alert">{error}</p>}
    </details>
    <button className="btn" aria-expanded={procedure} onClick={() => setProcedure(!procedure)}>Air-quality steps</button>
    {procedure && <div className="review-warning"><b>Use your mission’s approved air-quality procedure.</b><ol><li>Tell the medical lead who has headaches, since when, and where.</li><li>Take fresh readings where they are, and check the sensor works.</li><li>Follow your air-quality procedure and its limits. Archived NASA data can’t tell you today’s exposure.</li><li>Log readings, actions and changes in the handoff. If anyone collapses or symptoms are severe, tell the medical lead now.</li></ol></div>}
  </section>;
}

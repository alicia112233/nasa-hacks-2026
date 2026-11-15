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
    <h3 id="cabin-review-title">Crew & cabin review</h3>
    <p>{reports.length >= 2 ? `${reports.length} crew members reported headaches within 24 hours. Review current cabin measurements and the onboard air-quality procedure.` : `${reports.length} crew member${reports.length === 1 ? '' : 's'} reported a headache within 24 hours. A shared-symptom prompt needs at least two.`} {mission.demo && 'Simulated reports.'}</p>
    <p className="muted">This prompts a review; it does not establish a cause. Fluid shifts, individual susceptibility and other factors can contribute. <a href="https://www.nasa.gov/ochmo-tb-004-carbon-dioxide-2/" target="_blank" rel="noreferrer">NASA CO₂ evidence</a>.</p>
    <div className="cabin-current"><b>{mission.demo ? 'Simulated cabin measurement' : 'Crew-entered cabin measurement'}</b>
      {latest ? <><p>{latest.co2Ppm} ppm CO₂ · {latest.temperatureC ?? '—'} °C · {latest.humidityPct ?? '—'}% RH</p><p className="muted">{latest.location} · {formatDate(latest.date, { hour: '2-digit', minute: '2-digit' })} · {stale ? 'More than 1 hour old; obtain a current measurement.' : 'Recorded within the last hour.'} No live sensor connection.</p></> : <p>No current cabin measurements recorded. The NASA 2016 charts below cannot describe today’s cabin.</p>}
    </div>
    <details><summary>Log a cabin measurement</summary>
      <form className="context-fields" onSubmit={e => {
        e.preventDefault(); const f = new FormData(e.currentTarget); const date = new Date(String(f.get('date')));
        if (!Number.isFinite(date.getTime()) || date.getTime() > Date.now()) { setError('Enter an observation time that is not in the future.'); return; }
        const optional = (key: string) => f.get(key) === '' ? undefined : Number(f.get(key));
        onSave({ id: crypto.randomUUID(), date: date.toISOString(), location: String(f.get('location')).trim(), co2Ppm: Number(f.get('co2')), temperatureC: optional('temperature'), humidityPct: optional('humidity'), source: mission.demo ? 'simulated' : 'manual' }); setError(''); e.currentTarget.reset();
      }}>
        <label className="field">CO₂ (ppm)<input name="co2" type="number" min={0} max={1000000} required/></label>
        <label className="field">Observed at<input name="date" type="datetime-local" required/></label>
        <label className="field">Location / sensor<input name="location" required maxLength={120}/></label>
        <label className="field">Temperature °C (optional)<input name="temperature" type="number" step="0.1" min={-100} max={100}/></label>
        <label className="field">Humidity % (optional)<input name="humidity" type="number" min={0} max={100}/></label>
        <button className="btn">Save {mission.demo ? 'simulated' : 'cabin'} measurement</button>
      </form>{error && <p className="error" role="alert">{error}</p>}
    </details>
    <button className="btn" aria-expanded={procedure} onClick={() => setProcedure(!procedure)}>Review cabin procedure demo</button>
    {procedure && <div className="review-warning"><b>GP-CABIN-DEMO v0.1 · offline · unreviewed</b><ol><li>Notify the mission medical lead about the shared symptoms; record onset times and locations.</li><li>Obtain current cabin readings at the affected locations and check sensor validity.</li><li>Use the mission-approved air-quality procedure and its limits. Do not infer an exposure from NASA’s archived data.</li><li>Record readings, actions and symptom changes in the handoff. For collapse or severe symptoms, open emergency response immediately.</li></ol></div>}
  </section>;
}

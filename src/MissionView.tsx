import { useState } from 'react';
import { ArrowUpRight, Download } from 'lucide-react';
import { checks, coverage, hazards, regions, risksUrl } from './body.mjs';
import { researchSources } from './research.mjs';
import { downloadFile } from './data';
import NasaData, { useEda } from './NasaData';
import type { MissionState, RegionId } from './types';

interface Props {
  mission: MissionState;
  onOpenRegion: (id: RegionId) => void;
  onSource: (demo: boolean) => void;
  onReloadDemo: () => void;
  onClear: () => Promise<void>;
}

export default function MissionView({ mission, onOpenRegion, onSource, onReloadDemo, onClear }: Props) {
  const rows = coverage();
  const { data } = useEda();
  const [confirm, setConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState('');

  async function clear() {
    setClearing(true);
    setClearError('');
    try {
      await onClear();
      setConfirm(false);
    } catch {
      setClearError('Could not delete personal records. Check device storage and try again.');
    } finally {
      setClearing(false);
    }
  }

  return <div className="page-grid mission">
    <section className="sheet span">
      <h2>NASA risk coverage <small>{rows.length} risks · {hazards.length} hazards</small></h2>
      <div className="hazard-key">{hazards.map(h => <a key={h.id} href={h.url} target="_blank" rel="noreferrer"><i style={{ background: h.color }}/>{h.label}</a>)}</div>
      <div className="scroll" tabIndex={0} role="region" aria-label="Risk coverage table">
        <table className="ledger">
          <thead><tr><th scope="col">Risk</th><th scope="col">Hazard</th><th scope="col">Region</th><th scope="col">Check</th></tr></thead>
          <tbody>{rows.map(r => <tr key={r.id}>
            <th scope="row"><a href={r.url} target="_blank" rel="noreferrer">{r.label}<ArrowUpRight size={12}/></a></th>
            <td>{r.hazards.map(h => { const hz = hazards.find(x => x.id === h)!; return <span key={h} className="ink-item"><i className="ink" style={{ background: hz.color }}/>{hz.label}</span>; })}</td>
            <td>{r.regions.map(id => { const reg = regions.find(x => x.id === id)!; return <button key={id} className="chip" onClick={() => onOpenRegion(id as RegionId)}>{reg.letter} {reg.label}</button>; })}</td>
            <td>{(() => {
              const own = checks.filter(c => c.risks.includes(r.id));
              const needs = own.filter(c => c.needs).map(c => c.needs!);
              const parts = [own.some(c => c.kind === 'camera') ? 'Camera' : null, own.some(c => c.field && c.kind !== 'camera') ? 'Self-check' : null, own.some(c => c.kind === 'data') ? 'NASA data' : null].filter(Boolean);
              return <span className="check-cell">{parts.join(' · ')}{needs.length > 0 && <span className="needs"><i className="hatch-mark" aria-hidden="true"/>{[...new Set(needs)].join(', ')}</span>}</span>;
            })()}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <p className="muted">Source: <a href={risksUrl} target="_blank" rel="noreferrer">Risks of Human Spaceflight<ArrowUpRight size={12}/></a>.</p>
    </section>

    <section className="sheet">
      <h2>ISS radiation</h2>
      <NasaData series="dose"/>
    </section>
    <section className="sheet">
      <h2>ISS habitat air</h2>
      <NasaData series="air"/>
    </section>

    <section className="sheet">
      <h2>Data</h2>
      <div className="seg" role="group" aria-label="Data source">
        <button aria-pressed={mission.demo} onClick={() => onSource(true)}>Demo</button>
        <button aria-pressed={!mission.demo} onClick={() => onSource(false)}>My records</button>
      </div>
      
      <button className="link" onClick={onReloadDemo}>Reload demo history</button>
      <div className="danger">
        {confirm ? <><span>Delete all personal records on this device? This includes videos, pose data, follow-ups, handoffs and your crew profile. Downloaded files must be deleted separately.</span><button className="btn danger-btn" disabled={clearing} onClick={clear}>{clearing ? 'Deleting…' : 'Delete'}</button><button className="link" disabled={clearing} onClick={() => setConfirm(false)}>Cancel</button></>
          : <button className="btn outline-danger" onClick={() => setConfirm(true)}>Clear personal records</button>}
        {clearError && <p className="error" role="alert">{clearError}</p>}
      </div>
    </section>

    <section className="sheet">
      <h2>Sources <small>{researchSources.length + 1}</small></h2>
      <ul className="sources">
        {data && <li><a href={data.source.portal} target="_blank" rel="noreferrer">NASA EDA · {data.mission} habitat and radiation<ArrowUpRight size={12}/></a><small>Imported · retrieved {data.source.retrievedAt.slice(0, 10)} · sha256 {data.source.sha256.slice(0, 12)}</small></li>}
        {researchSources.map(s => <li key={s.id}><a href={s.url} target="_blank" rel="noreferrer">{s.agency} · {s.title}<ArrowUpRight size={12}/></a></li>)}
      </ul>
      <button className="btn ghost" onClick={() => downloadFile('ghostpilot-sources.json', JSON.stringify({ sources: researchSources, nasaData: data?.source ?? null }, null, 2), 'application/json')}><Download size={16}/> Source list</button>
    </section>
  </div>;
}

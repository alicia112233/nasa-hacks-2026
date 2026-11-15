import { ArrowUpRight } from 'lucide-react';
import { checks, coverage, hazards, regions, risksUrl } from './body.mjs';
import type { RegionId } from './types';

/** Every NASA human spaceflight risk, the hazards behind it, and the region and check that cover it. */
export default function RisksView({ onOpenRegion }: { onOpenRegion: (id: RegionId) => void }) {
  const rows = coverage();
  return <div className="page-grid risks-page">
    <section className="sheet span">
      <h2>NASA risk coverage <small>{rows.length} risks · {hazards.length} hazards</small></h2>
      <div className="hazard-key">{hazards.map(h => <a key={h.id} href={h.url} target="_blank" rel="noreferrer"><i style={{ background: h.color }}/>{h.label}</a>)}</div>
      <table className="ledger risk-table" role="table" aria-label="Risk coverage table">
          <thead role="rowgroup"><tr role="row"><th scope="col" role="columnheader">Risk</th><th scope="col" role="columnheader">Hazard</th><th scope="col" role="columnheader">Region</th><th scope="col" role="columnheader">Check</th></tr></thead>
          <tbody role="rowgroup">{rows.map(r => <tr key={r.id} role="row">
            <th scope="row" role="rowheader"><a href={r.url} target="_blank" rel="noreferrer">{r.label}<ArrowUpRight size={12}/></a></th>
            <td role="cell">{r.hazards.map(h => { const hz = hazards.find(x => x.id === h)!; return <span key={h} className="ink-item"><i className="ink" style={{ background: hz.color }}/>{hz.label}</span>; })}</td>
            <td role="cell">{r.regions.map(id => { const reg = regions.find(x => x.id === id)!; return <button key={id} className="chip" onClick={() => onOpenRegion(id as RegionId)}>{reg.letter} {reg.label}</button>; })}</td>
            <td role="cell">{(() => {
              const own = checks.filter(c => c.risks.includes(r.id));
              const needs = own.filter(c => c.needs).map(c => c.needs!);
              const parts = [own.some(c => c.kind === 'camera') ? 'Camera' : null, own.some(c => c.field && c.kind !== 'camera') ? 'Self-check' : null, own.some(c => c.kind === 'data') ? 'NASA data' : null].filter(Boolean);
              return <span className="check-cell">{parts.join(' · ')}{needs.length > 0 && <span className="needs"><i className="hatch-mark" aria-hidden="true"/>{[...new Set(needs)].join(', ')}</span>}</span>;
            })()}</td>
          </tr>)}</tbody>
        </table>
      <p className="muted">Source: <a href={risksUrl} target="_blank" rel="noreferrer">Risks of Human Spaceflight<ArrowUpRight size={12}/></a>.</p>
    </section>

  </div>;
}

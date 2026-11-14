import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { analyze, median } from './rules.mjs';
import { formatDate } from './data';
import type { CheckIn } from './types';

const metrics = [
  { key: 'reactionMs', label: 'Attention', unit: 'ms', worse: 'up' },
  { key: 'sleep', label: 'Sleep', unit: '/5', worse: 'down' },
  { key: 'mood', label: 'Mood', unit: '/5', worse: 'down' },
  { key: 'energy', label: 'Energy', unit: '/5', worse: 'down' },
  { key: 'heartRate', label: 'Heart rate', unit: 'bpm', worse: 'none' },
  { key: 'leftRange', label: 'L shoulder', unit: '°', worse: 'down' },
  { key: 'exerciseMin', label: 'Exercise', unit: 'min', worse: 'down' },
  { key: 'appetite', label: 'Appetite', unit: '/5', worse: 'down' },
  { key: 'workload', label: 'Workload', unit: '/5', worse: 'down' },
  { key: 'team', label: 'Crew', unit: '/5', worse: 'down' },
] as const;
type Key = typeof metrics[number]['key'];
const axis = { fontSize: 12, fill: '#3b3a37', fontFamily: 'Barlow Condensed' };

export default function TrendsView({ checkIns, simulated }: { checkIns: CheckIn[]; simulated: boolean }) {
  const [key, setKey] = useState<Key>('reactionMs');
  const analysis = useMemo(() => analyze(checkIns, simulated), [checkIns, simulated]);
  const rows = metrics.map(m => {
    const ghost = median(analysis.baselineRecords.map((c: CheckIn) => c[m.key]));
    const now = median(analysis.recent.map((c: CheckIn) => c[m.key]));
    const change = ghost && now != null ? Math.round((now - ghost) / ghost * 100) : null;
    const worse = change != null && m.worse !== 'none' && Math.abs(change) >= 8 && (m.worse === 'up' ? change > 0 : change < 0);
    return { ...m, ghost, now, change, worse };
  });
  const active = rows.find(r => r.key === key)!;
  const data = analysis.records.map((c: CheckIn) => ({ sol: c.sol, value: c[key] ?? null }));

  return <div className="page-grid trends">
    <section className="sheet">
      <h2>You against your ghost</h2>
      <table className="ledger">
        <thead><tr><th scope="col">Measure</th><th scope="col">Last 3</th><th scope="col">Ghost</th><th scope="col">Change</th></tr></thead>
        <tbody>{rows.map(r => <tr key={r.key} className={`${r.key === key ? 'on' : ''} ${r.worse ? 'worse' : ''}`}>
          <th scope="row"><button aria-pressed={r.key === key} onClick={() => setKey(r.key)}>{r.label}</button></th>
          <td>{r.now != null ? `${Math.round(r.now)}${/^[/°]/.test(r.unit) ? '' : ' '}${r.unit}` : '—'}</td>
          <td>{r.ghost != null ? `${Math.round(r.ghost)}${/^[/°]/.test(r.unit) ? '' : ' '}${r.unit}` : '—'}</td>
          <td>{r.change != null ? `${r.change > 0 ? '+' : ''}${r.change}%` : '—'}</td>
        </tr>)}</tbody>
      </table>
      <p className="muted">Ghost = median of your earliest {analysis.baselineRecords.length} check-ins. Last 3 = median of the latest three. {simulated ? 'Demo data.' : 'Your records only.'}</p>
    </section>
    <section className="sheet">
      <h2>{active.label} <small>{active.unit}</small></h2>
      <div className="chart tall" role="img" aria-label={`${active.label} by sol with ghost line`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 12, left: -8, bottom: 0 }}>
            <CartesianGrid stroke="#d9d3c3" vertical={false}/>
            <XAxis dataKey="sol" tick={axis} stroke="#111" tickFormatter={s => `S${s}`}/>
            <YAxis tick={axis} stroke="#111" width={44} domain={['auto', 'auto']}/>
            <Tooltip contentStyle={{ background: '#f4f1e8', border: '1.5px solid #111', borderRadius: 0, fontFamily: 'Barlow' }} labelFormatter={s => `Sol ${s}`}/>
            {active.ghost != null && <ReferenceLine y={active.ghost} stroke="#7a7466" strokeDasharray="5 4" label={{ value: 'Ghost', position: 'insideTopLeft', fill: '#3b3a37', fontSize: 12 }}/>}
            <Line dataKey="value" name={active.label} stroke={active.worse ? '#c8102e' : '#111'} strokeWidth={2} dot={{ r: 3, fill: '#f4f1e8' }} connectNulls isAnimationActive={false}/>
          </LineChart>
        </ResponsiveContainer>
      </div>
      <h3>History</h3>
      <div className="scroll" tabIndex={0} role="region" aria-label="Check-in history">
        <table className="ledger small">
          <thead><tr><th scope="col">Sol</th><th scope="col">Date</th><th scope="col">Attn</th><th scope="col">Sleep</th><th scope="col">HR</th><th scope="col">Shoulder</th></tr></thead>
          <tbody>{analysis.records.slice().reverse().map((c: CheckIn) => <tr key={c.id}><td>{c.sol}</td><td>{formatDate(c.date)}</td><td>{c.reactionMs ?? '—'}</td><td>{c.sleep ?? '—'}</td><td>{c.heartRate ?? '—'}</td><td>{c.leftRange ?? '—'}</td></tr>)}</tbody>
        </table>
        {!analysis.records.length && <p className="muted pad">No check-ins yet.</p>}
      </div>
    </section>
  </div>;
}

import { useEffect, useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { analyze } from './rules.mjs';
import { formatDate } from './data';
import { phases } from './references.mjs';
import type { CheckIn, GhostReference } from './types';

export const trendMetrics = [
  { key: 'reactionMs', label: 'Attention', unit: 'ms', worse: 'up' },
  { key: 'sleep', label: 'Sleep', unit: '/5', worse: 'down' },
  { key: 'mood', label: 'Mood', unit: '/5', worse: 'down' },
  { key: 'energy', label: 'Energy', unit: '/5', worse: 'down' },
  { key: 'heartRate', label: 'Heart rate', unit: 'bpm', worse: 'none' },
  { key: 'leftRange', label: 'L shoulder', unit: '°', worse: 'down' },
  { key: 'exerciseMin', label: 'Exercise', unit: 'min', worse: 'down' },
  { key: 'thighCm', label: 'Thigh', unit: 'cm', worse: 'down' },
  { key: 'appetite', label: 'Appetite', unit: '/5', worse: 'down' },
  { key: 'workload', label: 'Workload', unit: '/5', worse: 'down' },
  { key: 'team', label: 'Crew', unit: '/5', worse: 'down' },
] as const;
type Key = typeof trendMetrics[number]['key'];
const axis = { fontSize: 12, fill: '#3b3a37', fontFamily: 'Barlow Condensed' };
/** Change that marks a row, in percent; thigh breadth matches the Legs rule (src/rules.mjs). */
const alertAt = (key: string) => (key === 'thighCm' ? 5 : 8);
const show = (v: number, unit: string) => `${unit === 'cm' ? v.toFixed(1) : Math.round(v)}${/^[/°]/.test(unit) ? '' : ' '}${unit}`;

export default function TrendsView({ checkIns, simulated, references, tourMetric }: { checkIns: CheckIn[]; simulated: boolean; references?: GhostReference[]; tourMetric?: string }) {
  const [key, setKey] = useState<Key>('reactionMs');
  // The tutorial opens Trends on the measure it is following.
  useEffect(() => { if (tourMetric) setKey(tourMetric as Key); }, [tourMetric]);
  const analysis = useMemo(() => analyze(checkIns, simulated, references), [checkIns, simulated, references]);
  const flags: Record<string, boolean> = { reactionMs: analysis.attentionFlag, sleep: analysis.wellbeingFlag,
    leftRange: analysis.movementFlag, thighCm: analysis.legFlag };
  const rows = trendMetrics.map(m => {
    const ghost = analysis.baseline[m.key];
    const now = analysis.current[m.key];
    const change = ghost && now != null ? Math.round((now - ghost) / ghost * 100) : null;
    const comparison = analysis.comparisons[m.key];
    const comparable = comparison.comparable;
    const worse = flags[m.key] ?? (comparable && change != null && m.worse !== 'none'
      && Math.abs(change) >= alertAt(m.key) && (m.worse === 'up' ? change > 0 : change < 0));
    return { ...m, ghost, now, change, worse, comparison };
  });
  const active = rows.find(r => r.key === key)!;
  const data: { sol: number; value: number | null }[] = analysis.records.map((c: CheckIn) => ({ sol: c.sol, value: (c[key] as number | undefined) ?? null }));
  // The text names exactly what the chart shades: the ghost's sols and the last 3 readings, with their values.
  const c = active.comparison as typeof active.comparison & { auto?: boolean; ghostSols?: [number, number] | null; recentSols?: [number, number] | null };
  const sols = (span?: [number, number] | null) => !span ? '' : span[0] === span[1] ? `S${span[0]}` : `S${span[0]}–S${span[1]}`;
  const ghostWhen = c.ghostSols && c.ghostSols[1] === 0 ? 'preflight' : sols(c.ghostSols);
  const onChart = (span?: [number, number] | null) => !!span && span[1] > 0 && data.some(d => d.sol === span[0]) && data.some(d => d.sol === span[1]);
  const rating = active.unit === '/5';
  const summary = active.comparison.comparable && active.now != null && active.ghost != null
    ? `Last 3 readings (${sols(c.recentSols)}): ${show(active.now, active.unit)}. Ghost (${ghostWhen}): ${show(active.ghost, active.unit)}.${active.change != null ? ` Change ${active.change > 0 ? '+' : ''}${active.change}%.` : ''}`
    : active.comparison.reason;

  return <div className="page-grid trends">
    <section className="sheet">
      <h2>You against your ghost</h2>
      <table className="ledger">
        <thead><tr><th scope="col">Measure</th><th scope="col">Last 3</th><th scope="col">Ghost</th><th scope="col">Change</th></tr></thead>
        <tbody>{rows.map(r => <tr key={r.key} className={`${r.key === key ? 'on' : ''} ${r.worse ? 'worse' : ''}`}>
          <th scope="row"><button aria-pressed={r.key === key} onClick={() => setKey(r.key)}>{r.label}</button><small className="metric-last">{r.comparison.lastMeasuredAt ? formatDate(r.comparison.lastMeasuredAt, { hour: '2-digit', minute: '2-digit' }) : 'Never measured'}</small></th>
          <td>{r.now != null ? show(r.now, r.unit) : '—'}</td>
          <td>{r.ghost != null ? show(r.ghost, r.unit) : '—'}</td>
          <td>{r.comparison.state === 'unreliable' ? 'Unreliable' : !r.comparison.comparable ? 'Need readings' : r.change != null ? `${r.change > 0 ? '+' : ''}${r.change}%` : '—'}</td>
        </tr>)}</tbody>
      </table>
      <p className="muted">Last 3 and Ghost are medians: your latest 3 readings, and your earlier steady readings.</p>
    </section>
    <section className="sheet">
      <div className="trend-focus" data-tour={tourMetric ? 'trend-chart' : undefined}>
      <h2>{active.label} <small>{active.unit}</small></h2>
      <div className="comparison-note" role="status"><b>{active.comparison.state === 'unreliable' ? 'Comparison unreliable' : active.worse ? 'Alert' : active.comparison.comparable ? 'No alert' : 'More readings needed'}</b><p>{summary}</p><p className="muted">{active.comparison.comparable ? `Both are shaded on the chart; each value is the median of its readings. ${c.auto ? 'Ghost: your earliest readings.' : `Ghost: ${phases[active.comparison.phase as keyof typeof phases].toLowerCase()}.`}` : ''}{active.key === 'thighCm' && ' Fluid shifts also thin the legs, so a narrower outline alone doesn’t mean muscle loss.'}</p></div>
      <div className="chart tall" role="img" aria-label={`${active.label} by sol. ${summary}`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 12, left: -8, bottom: 0 }}>
            <CartesianGrid stroke="#d9d3c3" vertical={false}/>
            <XAxis dataKey="sol" tick={axis} stroke="#111" tickFormatter={s => `S${s}`}/>
            <YAxis tick={axis} stroke="#111" width={44} domain={rating ? [1, 5] : ['auto', 'auto']} ticks={rating ? [1, 2, 3, 4, 5] : undefined} allowDecimals={!rating && active.unit === 'cm'}/>
            {onChart(c.ghostSols) && <ReferenceArea x1={c.ghostSols![0]} x2={c.ghostSols![1]} fill="#d9d3c3" fillOpacity={0.45} ifOverflow="extendDomain" label={{ value: 'Ghost', position: 'insideTopLeft', fill: '#3b3a37', fontSize: 12 }}/>}
            {onChart(c.recentSols) && <ReferenceArea x1={c.recentSols![0]} x2={c.recentSols![1]} fill="#f4e3b2" fillOpacity={0.8} ifOverflow="extendDomain" label={{ value: 'Last 3', position: 'insideTopRight', fill: '#3b3a37', fontSize: 12 }}/>}
            <Tooltip contentStyle={{ background: '#f4f1e8', border: '1.5px solid #111', borderRadius: 0, fontFamily: 'Barlow' }} labelFormatter={s => `Sol ${s}`}/>
            {active.ghost != null && <ReferenceLine y={active.ghost} stroke="#7a7466" strokeDasharray="5 4" label={{ value: `Ghost ${show(active.ghost, active.unit)}`, position: 'insideBottomRight', fill: '#3b3a37', fontSize: 12 }}/>}
            <Line dataKey="value" name={active.label} stroke={active.worse ? '#c8102e' : '#111'} strokeWidth={2} dot={{ r: 3, fill: '#f4f1e8' }} connectNulls isAnimationActive={false}/>
          </LineChart>
        </ResponsiveContainer>
      </div>
      </div>
      <h3>History</h3>
      <div className="scroll" tabIndex={0} role="region" aria-label="Check-in history">
        <table className="ledger small">
          <thead><tr><th scope="col">Sol</th><th scope="col">Date</th><th scope="col">Attn</th><th scope="col">Sleep</th><th scope="col">HR</th><th scope="col">Shoulder</th><th scope="col">Thigh</th></tr></thead>
          <tbody>{analysis.records.slice().reverse().map((c: CheckIn) => <tr key={c.id}><td>{c.sol}</td><td>{formatDate(c.date)}</td><td>{c.reactionMs ?? '—'}</td><td>{c.sleep ?? '—'}</td><td>{c.heartRate ?? '—'}</td><td>{c.leftRange ?? '—'}</td><td>{c.thighCm ?? '—'}</td></tr>)}</tbody>
        </table>
        {!analysis.records.length && <p className="muted pad">No check-ins yet.</p>}
      </div>
    </section>
  </div>;
}

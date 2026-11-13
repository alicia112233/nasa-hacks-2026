import { useState } from 'react';
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChevronDown, TrendingUp } from 'lucide-react';
import { analyze } from './rules.mjs';
import type { CheckIn } from './types';
import { formatDate } from './data';

interface Props { checkIns: CheckIn[]; simulated: boolean; expanded?: boolean }
type Metric = 'reactionMs' | 'sleep' | 'leftRange';
const metricInfo = {
  reactionMs: { label: 'Attention', unit: 'ms', description: 'Median response time', color: '#50755a' },
  sleep: { label: 'Sleep', unit: '/5', description: 'Self-reported sleep quality', color: '#6f82a0' },
  leftRange: { label: 'Movement', unit: '°', description: 'Estimated left shoulder range', color: '#9a8652' },
};

export default function TrendChart({ checkIns, simulated, expanded }: Props) {
  const [metric, setMetric] = useState<Metric>('reactionMs');
  const [days, setDays] = useState(14);
  const analysis = analyze(checkIns, simulated);
  const info = metricInfo[metric];
  const baseline = analysis.baseline[metric];
  const data = analysis.records.slice(-days).map((record: CheckIn) => ({ sol: record.sol, value: record[metric], date: formatDate(record.date), simulated: record.simulated }));
  return <section className={`panel trend-panel ${expanded ? 'expanded-chart' : ''}`}><div className="panel-heading"><div><div className="eyebrow">THE BIGGER PICTURE</div><h2>Your rhythm over time.</h2></div><button className="range-button" onClick={() => setDays(days === 14 ? 7 : 14)}>Last {days} days <ChevronDown size={14}/></button></div><div className="chart-toolbar"><div className="chart-tabs" role="group" aria-label="Trend metric">{(Object.keys(metricInfo) as Metric[]).map(m => <button key={m} className={metric === m ? 'active' : ''} aria-pressed={metric === m} onClick={() => setMetric(m)}>{metricInfo[m].label}</button>)}</div><span className="chart-unit">{info.description} <span>({info.unit})</span></span></div>{data.length ? <div className="chart-container" style={{ height: expanded ? 300 : 174 }}><ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{ left: -14, top: 13, right: 20, bottom: 0 }}><defs><linearGradient id={`chart-fill-${metric}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={info.color} stopOpacity={.16}/><stop offset="100%" stopColor={info.color} stopOpacity={0}/></linearGradient></defs><CartesianGrid vertical={false} stroke="#e9ece4" strokeDasharray="3 4"/><XAxis dataKey="sol" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#52634b', fontFamily: 'DM Mono' }} tickFormatter={value => `S${value}`} minTickGap={18} dy={7}/><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#52634b', fontFamily: 'DM Mono' }} domain={metric === 'sleep' ? [1, 5] : ['dataMin - 15', 'dataMax + 15']} tickCount={4}/><Tooltip content={({ active, payload }) => active && payload?.length ? <div className="chart-tooltip"><small>Sol {payload[0].payload.sol} · {payload[0].payload.date}</small><strong>{payload[0].value} {info.unit}</strong><span>{simulated ? 'Simulated check-in' : 'Recorded check-in'}</span></div> : null}/>{baseline != null && <ReferenceLine y={baseline} stroke="#acb79b" strokeDasharray="5 5"/>}<Area type="monotone" dataKey="value" stroke={info.color} strokeWidth={2} fill={`url(#chart-fill-${metric})`} dot={{ r: 3, fill: '#fafbf7', strokeWidth: 2 }} activeDot={{ r: 5 }} connectNulls={false} isAnimationActive={false}/></AreaChart></ResponsiveContainer></div> : <div className="empty-state"><TrendingUp size={28}/><strong>Your story starts with a check-in.</strong><p>Your personal trends will appear here as you build a history.</p></div>}<div className="chart-footer"><span><i className="legend-dot current"/> {simulated ? 'Simulated history' : 'Your check-ins'} <i className="dashed-legend"/> Your baseline</span><small>{analysis.enough ? `${analysis.baselineRecords.length} check-ins in your baseline` : 'At least 6 check-ins to show a trend'}</small></div></section>;
}

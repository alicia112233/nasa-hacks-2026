import { ArrowRight, Play } from 'lucide-react';
import { recommendChecks } from './daily.mjs';
import type { MissionState, RegionId } from './types';

export type Recommendation = { checkId: string; field: string; region: string; title: string; seconds: number; reason: string; priority?: number };
type Row = { region: { id: string; letter: string; label: string }; check: { id: string; title: string; field: string; seconds?: number }; state: 'done' | 'off' | 'todo' };
type Side = { rows: Row[]; done: number; total: number; trends: string[]; reported: string[]; next: Row | null };
export type DaySummary = { physical: Side; mental: Side; done: number; total: number; attention: unknown[] };

const TAU = Math.PI * 2;
/** One arc of the ring, clockwise from 12 o'clock, leaving a 2px gap of card stock between checks. */
function arc(i: number, n: number, r = 50) {
  const gap = n > 1 ? 2.6 / r : 0, step = TAU / n;
  const a0 = -Math.PI / 2 + i * step + gap / 2, a1 = a0 + step - gap;
  const at = (a: number) => `${(60 + r * Math.cos(a)).toFixed(2)} ${(60 + r * Math.sin(a)).toFixed(2)}`;
  return n === 1 ? `M60 10 A50 50 0 1 1 59.99 10` : `M${at(a0)} A${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${at(a1)}`;
}

/** A ring of today's checks in one area: a segment per check, ink when done, red for an alert, amber for the next. */
function Ring({ name, side, onStart }: { name: string; side: Side; onStart: (row: Row) => void }) {
  const alerts = [...new Set([...side.trends, ...side.reported])];
  const status = alerts.length ? `${alerts.length === 1 ? 'Alert' : `${alerts.length} alerts`}: ${alerts.join(', ')}` : side.done === side.total ? 'All done' : side.done ? 'Nothing off so far' : 'Not started';
  const body = <>
    <span className="sr">{name}: </span>
    <span className="ring-art">
      <svg viewBox="0 0 120 120" aria-hidden="true">
        {side.rows.map((row, i) => <path key={row.check.id} d={arc(i, side.rows.length)} className={`seg ${row === side.next ? 'next' : row.state}`} style={{ animationDelay: `${i * 45}ms` }}><title>{`${row.check.title}: ${row.state === 'todo' ? 'to do' : row.state === 'off' ? 'alert' : 'done'}`}</title></path>)}
      </svg>
      <span className="ring-figure"><b>{side.done}</b><small>/{side.total}</small><span className="sr"> checks done today.</span></span>
    </span>
    <span className="ring-name" aria-hidden="true">{name}</span>
    <span className={`ring-status ${alerts.length ? 'off' : ''}`}>{status}</span>
    {side.next && <span className="sr">. Start {side.next.check.title}.</span>}
  </>;
  return side.next
    ? <button className="ring" onClick={() => onStart(side.next!)}>{body}</button>
    : <div className="ring">{body}</div>;
}

interface Props {
  mission: MissionState;
  summary: DaySummary;
  sol: number;
  headaches: number;
  onStart: (r: Recommendation & { region: RegionId }) => void;
  onCabin: () => void;
  onReport: () => void;
}

/** The first thing on the Body page: today's two rings, then the one thing to do next. */
export default function TodayPanel({ mission, summary, sol, headaches, onStart, onCabin, onReport }: Props) {
  const next = recommendChecks({ checkIns: mission.checkIns, simulated: mission.demo, references: mission.references })[0] as Recommendation | undefined;
  const start = (row: Row) => onStart({ checkId: row.check.id, field: row.check.field, region: row.region.id as RegionId, title: row.check.title, seconds: row.check.seconds ?? 0, reason: '' });
  const alertCount = new Set([...summary.physical.trends, ...summary.physical.reported, ...summary.mental.trends, ...summary.mental.reported]).size;
  return <section className="sheet today" aria-labelledby="today-title">
    <div className="today-head"><h2 id="today-title">Today</h2><span>Sol {String(sol).padStart(3, '0')}</span></div>
    <div className="rings">
      <Ring name="Physical" side={summary.physical} onStart={start}/>
      <Ring name="Mental" side={summary.mental} onStart={start}/>
    </div>
    <p className="ring-key" aria-hidden="true"><span><i className="done"/>Done</span><span><i className="off"/>Alert</span><span><i className="next"/>Next</span><span><i className="todo"/>To do</span></p>
    {next ? <div className="today-next">
      <span className="today-next-label">Next</span>
      <div><b>{next.title}</b>{(next.priority ?? 0) >= 70 && <p>{next.reason}</p>}</div>
      <button className="btn primary" onClick={() => onStart(next as Recommendation & { region: RegionId })}><Play size={16} aria-hidden="true"/> {next.seconds ? `Start · ${next.seconds} s` : 'Open'}</button>
    </div> : <div className="today-next">
      <span className="today-next-label">Next</span>
      <div><b>Hand off today’s report</b></div>
      <button className="btn primary" onClick={onReport}>Open report</button>
    </div>}
    {headaches >= 2 && <div className="today-alert"><p><b>{headaches} crew reported headaches in the last day.</b> Check the cabin air.</p><button className="btn" onClick={onCabin}>Check cabin</button></div>}
    <button className="today-report" onClick={onReport}><span>Today’s report</span><span>{summary.done} of {summary.total} checks{alertCount ? ` · ${alertCount} alert${alertCount === 1 ? '' : 's'}` : ''}</span><ArrowRight size={16} aria-hidden="true"/></button>
  </section>;
}

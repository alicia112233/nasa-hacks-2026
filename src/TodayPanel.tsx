import type React from 'react';
import { ArrowRight, Play } from 'lucide-react';
import { recommendChecks } from './daily.mjs';
import { cadenceLabel } from './plan.mjs';
import { checks } from './body.mjs';
import type { MissionState, RegionId } from './types';

export type Recommendation = { checkId: string; field: string; region: string; title: string; seconds: number; prep?: number; reason: string; priority?: number };
type Row = { region: { id: string; letter: string; label: string }; check: { id: string; title: string; field: string; seconds?: number }; state: 'done' | 'off' | 'todo' };
type Side = { rows: Row[]; done: number; total: number; trends: string[]; reported: string[]; next: Row | null };
export type DaySummary = { physical: Side; mental: Side; done: number; total: number; attention: unknown[] };

/** The ring's circumference: the fill is drawn as a dash of the done share, from 12 o'clock clockwise. */
const C = 2 * Math.PI * 50;

/** A ring of today's checks in one area: it fills up in green as checks are done; alerts are named under it. */
function Ring({ name, side, onStart }: { name: string; side: Side; onStart: (row: Row) => void }) {
  const alerts = [...new Set([...side.trends, ...side.reported])];
  const status = alerts.length ? `${alerts.length === 1 ? 'Alert' : `${alerts.length} alerts`}: ${alerts.join(', ')}` : !side.total ? 'No checks due' : side.done === side.total ? 'Routine complete' : side.done ? 'Nothing off so far' : 'Not started';
  const offset = C * (1 - (side.total ? side.done / side.total : 0));
  const body = <>
    <span className="sr">{name}: </span>
    <span className="ring-art">
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle className="ring-track" cx="60" cy="60" r="50"/>
        {side.done > 0 && <circle className="ring-fill" cx="60" cy="60" r="50" transform="rotate(-90 60 60)" strokeDasharray={C} strokeDashoffset={offset} style={{ '--ring-c': C } as React.CSSProperties}/>}
      </svg>
      <span className="ring-figure"><b>{side.done}</b><small>/{side.total}</small><span className="sr"> planned checks completed today.</span></span>
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
  const next = recommendChecks({ checkIns: mission.checkIns, simulated: mission.demo, references: mission.references, startDate: mission.profile.startDate })[0] as Recommendation | undefined;
  const start = (row: Row) => onStart({ checkId: row.check.id, field: row.check.field, region: row.region.id as RegionId, title: row.check.title, seconds: row.check.seconds ?? 0, reason: '' });
  const alertCount = new Set([...summary.physical.trends, ...summary.physical.reported, ...summary.mental.trends, ...summary.mental.reported]).size;
  return <section className="sheet today" aria-labelledby="today-title">
    <div className="today-head"><h2 id="today-title">Today</h2><span>Sol {String(sol).padStart(3, '0')}</span></div>
    <p className="muted">Checks completed · today’s planned checks and follow-ups.</p>
    <div className="rings">
      <Ring name="Physical" side={summary.physical} onStart={start}/>
      <Ring name="Mental" side={summary.mental} onStart={start}/>
    </div>
    {next ? <div className="today-next">
      <span className="today-next-label">Next</span>
      <div><b>{next.title}</b><p>{next.reason}</p>{!!next.prep && <p>{next.prep >= 60 ? `${next.prep / 60} min` : `${next.prep} s`} preparation first.</p>}</div>
      <button className="btn primary" onClick={() => onStart(next as Recommendation & { region: RegionId })}><Play size={16} aria-hidden="true"/> {next.seconds ? `Start · ${next.seconds} s` : 'Open'}</button>
    </div> : <div className="today-next">
      <span className="today-next-label">Next</span>
      <div><b>Hand off today’s report</b></div>
      <button className="btn primary" onClick={onReport}>Open report</button>
    </div>}
    {headaches >= 2 && <div className="today-alert"><p><b>{headaches} crew reported headaches in the last day.</b> Check the cabin air.</p><button className="btn" onClick={onCabin}>Check cabin</button></div>}
    <button className="today-report" onClick={onReport}><span>Today’s report</span><span>{summary.done} of {summary.total} checks{alertCount ? ` · ${alertCount} alert${alertCount === 1 ? '' : 's'}` : ''}</span><ArrowRight size={16} aria-hidden="true"/></button>
    <details className="routine-plan"><summary>Mission plan</summary><p className="muted">Illustrative cadence. A mission’s medical team sets its actual plan. All checks remain available on the body.</p><ul>{checks.filter(c => c.field).map(c => <li key={c.id}><span>{c.title}</span><span>{cadenceLabel(c.id)}</span></li>)}</ul></details>
  </section>;
}

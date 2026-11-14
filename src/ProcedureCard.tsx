import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Camera, Check, ChevronDown, Move3d, Play, RotateCcw, ScanLine, Send } from 'lucide-react';
import { hazards, risks, totalSeconds } from './body.mjs';
import { median } from './rules.mjs';
import { HOW, LEVELS, WHY, nextSteps, resultLine } from './guidance.mjs';
import NasaData from './NasaData';
import type { CheckIn, FollowUp, RegionId } from './types';

type Check = { id: string; title: string; kind: string; field?: string; seconds?: number; unit?: string; options?: string[]; needs?: string; series?: 'dose' | 'air'; min?: number; max?: number; risks: string[] };
type Item = { check: Check; value: number | null; last: number | null; done: boolean; flagged: boolean; reported: boolean };
interface Props {
  region: { id: RegionId; letter: string; label: string; checks: Check[]; risks: string[]; hazards: string[] };
  status: { state: string; items: Item[] };
  analysis: { baselineRecords: CheckIn[]; recent: CheckIn[]; current: Record<string, number | null>; baseline: Record<string, number | null>; attentionDelta: number | null; movementDelta: number | null; legDelta: number | null };
  simulated: boolean;
  actions: FollowUp[];
  onSave: (field: string, value: number) => void;
  onAttention: () => void;
  /** Open a camera check: 'shoulder' records movement, 'legs' runs the body scan. */
  onCamera: (checkId: string) => void;
  onMovement: () => void;
  onFollowUp: (action: FollowUp) => void;
  /** Finish by handing off: opens Handoff with this region's summary as the note. */
  onHandoff: (note: string) => void;
}

const followUps = ['Repeat this check tomorrow', 'Note it for the flight surgeon', 'Review the mission-approved procedure'];
const fmt = (s: number) => s >= 60 ? `${Math.floor(s / 60)} MIN${s % 60 ? ` ${s % 60} S` : ''}` : `${s} S`;

export default function ProcedureCard({ region, status, analysis, simulated, actions, onSave, onAttention, onCamera, onMovement, onFollowUp, onHandoff }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [plan, setPlan] = useState(false);
  const items = status.items;
  const ghost = useMemo(() => Object.fromEntries(region.checks.filter(c => c.field).map(c => [c.field!, median(analysis.baselineRecords.map(r => (r as unknown as Record<string, number>)[c.field!]))])), [region, analysis]);
  // Actionable checks write a value; instrument and NASA-data rows stay outside the count.
  const actionable = items.filter(i => i.check.field);
  const pending = actionable.filter(i => !i.done);
  const doneCount = actionable.length - pending.length;
  const next = pending[0];
  const complete = actionable.length > 0 && !pending.length;
  const flagged = items.filter(i => i.flagged);
  const reported = items.filter(i => i.reported);
  const regionHazards = hazards.filter(h => region.hazards.includes(h.id));
  const regionRisks = risks.filter(r => region.risks.includes(r.id));
  useEffect(() => { setOpen(null); setPlan(false); setDraft(''); }, [region.id]);

  function begin() {
    const next = pending[0]?.check;
    if (!next) return;
    if (next.kind === 'task') onAttention();
    else if (next.kind === 'camera') onCamera(next.id);
    else setOpen(next.id);
  }
  function save(check: Check, value: number) {
    onSave(check.field!, value);
    const after = pending.find(i => i.check.id !== check.id && (i.check.kind === 'scale' || i.check.kind === 'symptom' || i.check.kind === 'number'));
    setOpen(after ? after.check.id : null);
    setDraft('');
  }
  function note(i: Item) {
    const c = i.check;
    if (c.field === 'reactionMs') return `Response ${analysis.attentionDelta}% slower than your ghost.`;
    if (c.field === 'leftRange') return `Left shoulder range ${Math.abs(analysis.movementDelta ?? 0)}% below your ghost.`;
    if (c.field === 'thighCm') return `Thigh breadth ${Math.abs(analysis.legDelta ?? 0)}% below your ghost.`;
    if (c.field === 'sleep') return `Sleep ${analysis.current.sleep}/5 against a ghost of ${analysis.baseline.sleep}/5.`;
    return c.title;
  }
  const open_ = items.find(i => i.check.id === open);
  // What to do about this region's off readings: a level and up to three plain steps.
  const guide = useMemo(() => nextSteps(items), [items]);
  /** Run a check again from a guidance step: tasks and cameras open their own screens, the rest open in place. */
  function retake(checkId: string) {
    const c = items.find(i => i.check.id === checkId)?.check;
    if (!c) return;
    if (c.kind === 'task') onAttention();
    else if (c.kind === 'camera') onCamera(c.id);
    else setOpen(c.id);
  }
  const regionActions = actions.filter(a => a.kind === region.id && a.status === 'scheduled');
  const followUp = (title: string, when: Date) => onFollowUp({ id: crypto.randomUUID(), title, kind: region.id as FollowUp['kind'], notes: '', checklist: [], createdAt: new Date().toISOString(), scheduledAt: when.toISOString(), status: 'scheduled', simulated });
  const summary = () => [`${region.letter} ${region.label}: ${doneCount} of ${actionable.length} checks done today.`, ...flagged.map(note),
    ...reported.map(i => `Reported ${i.check.title.toLowerCase()} (${i.check.options?.[i.last ?? 0].toLowerCase()}).`)].join(' ');
  const shortDate = (iso: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(iso));
  // Step numbers follow the actionable checks, so they match the count.
  let number = 0;

  return <article className="card" aria-labelledby="card-title">
    <div className="tabs" aria-label="NASA hazards">
      {regionHazards.map(h => <a key={h.id} href={h.url} target="_blank" rel="noreferrer" style={{ background: h.color }} aria-label={`${h.label} hazard (NASA)`}><span>{h.label}</span></a>)}
    </div>
    <div className="card-main">
      <header className="card-head">
        <span className="letter" aria-hidden="true">{region.letter}</span>
        <h2 id="card-title">{region.label}</h2>
        {actionable.length ? <div className="card-progress">
          <span aria-live="polite"><b>{doneCount}</b> of {actionable.length} complete</span>
          <span className="progress-line">
            <span className="ticks" aria-hidden="true">{actionable.map(i => <i key={i.check.id} className={i.done ? 'done' : i === next ? 'next' : ''}/>)}</span>
            <small>{pending.length ? `${fmt(totalSeconds(pending.map(i => i.check)))} left` : 'Done today'}</small>
          </span>
        </div> : <span className="card-time">Reference</span>}
      </header>

      {(flagged.length > 0 || reported.length > 0) && <div className={`note ${flagged.length || guide?.level === 'now' ? 'flag' : ''}`} role="status">
        {/* Trends keep the red TREND label; reported symptoms show how urgent they are. Act now outranks both. */}
        <b>{guide?.level === 'now' ? LEVELS.now : flagged.length ? 'Trend' : guide ? LEVELS[guide.level] : 'Reported'}</b>
        <div>
          <p>{flagged.length ? flagged.map(note).join(' ') : `Last report: ${reported.map(i => `${i.check.title.toLowerCase()} (${i.check.options?.[i.last ?? 0].toLowerCase()})`).join(', ')}.`}</p>
          {/* What to do, in order. Once the region is finished, the done panel below owns follow-up and hand off. */}
          {guide && <ol className="next-steps" aria-label="What to do">
            {guide.steps.map(step => <li key={step.text}>
              <span>{step.text}</span>
              {step.action === 'retake' && <button className="link" onClick={() => retake(step.checkId)}>Retake</button>}
              {step.action === 'followup' && !complete && (regionActions.length
                ? <span className="muted">Follow-up set.</span>
                : !plan && <button className="link" onClick={() => setPlan(true)}>Plan follow-up</button>)}
              {step.action === 'handoff' && !complete && <button className={guide.level === 'now' ? 'btn' : 'link'} onClick={() => onHandoff(summary())}>Hand off</button>}
            </li>)}
          </ol>}
          {plan && !regionActions.length && <form className="plan" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); followUp(String(f.get('action')), new Date(String(f.get('when')))); setPlan(false); }}>
            <select name="action" aria-label="Follow-up">{followUps.map(a => <option key={a}>{a}</option>)}</select>
            <input name="when" type="date" aria-label="Reassess on" required defaultValue={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}/>
            <button className="btn">Save</button>
          </form>}
          {!guide && !complete && !regionActions.length && !plan && <button className="link" onClick={() => setPlan(true)}>Plan follow-up</button>}
          {regionActions.length > 0 && !complete && <p className="muted">Follow-up set: {regionActions[0].title.toLowerCase()}.</p>}
        </div>
      </div>}

      <ol className="steps">
        {items.map(item => {
          const c = item.check;
          const isOpen = open === c.id;
          const g = c.field ? ghost[c.field] : null;
          const valueText = item.value == null ? '' : c.options ? c.options[c.kind === 'scale' ? item.value - 1 : item.value] : `${item.value} ${c.unit ?? ''}`;
          const instrument = c.kind === 'instrument';
          const isNext = item === next;
          const result = item.done && item.value != null ? resultLine(c, item.value, g) : null;
          if (c.field) number++;
          return <li key={c.id} className={`${isOpen ? 'open' : ''} ${instrument ? 'instrument' : ''} ${isNext ? 'next' : ''}`}>
            <button className="step" aria-expanded={isOpen} onClick={() => {
              if (c.kind === 'task') onAttention();
              else if (c.kind === 'camera' && !isOpen) setOpen(c.id);
              else setOpen(isOpen ? null : c.id);
            }}>
              <span className="n">{c.field ? number : ''}</span>
              <span className="t">{c.title}{result ? <small className={result.level === 'watch' ? 'off' : ''}>{result.text}</small>
                : g != null && <small>Ghost {c.kind === 'symptom' ? c.options![Math.round(g)] : `${c.unit === 'cm' ? g.toFixed(1) : Math.round(g)}${c.kind === 'scale' ? '/5' : c.unit ? ` ${c.unit}` : ''}`}</small>}</span>
              <span className="time">{isNext && <em className="next-tag">Next</em>}{instrument ? c.needs : c.kind === 'data' ? 'NASA data' : fmt(c.seconds!)}</span>
              {c.kind === 'data' ? <span aria-hidden="true"/> : <span className={`box ${item.done ? 'done' : ''} ${item.flagged ? 'flag' : ''}`} role="img" aria-label={item.done ? `Done: ${valueText}` : instrument ? 'Not measured onboard' : 'Not done today'}>
                {item.done && <Check size={16} strokeWidth={3}/>}
              </span>}
              {(c.kind === 'data' || instrument || c.kind === 'camera') && <ChevronDown className="chev" size={16} aria-hidden="true"/>}
            </button>
            {isOpen && <div className="step-body">
              {HOW[c.id] && <dl className="how-why">
                <div><dt>How</dt><dd>{HOW[c.id]}</dd></div>
                <div><dt>Why</dt><dd>{WHY[c.id]}</dd></div>
              </dl>}
              {(c.kind === 'scale' || c.kind === 'symptom') && <div className="choices" role="group" aria-label={c.title}>
                {c.options!.map((label, i) => { const v = c.kind === 'scale' ? i + 1 : i; return <button key={label} aria-pressed={item.value === v} onClick={() => save(c, v)}>{c.kind === 'scale' && <b>{v}</b>}{label}</button>; })}
              </div>}
              {c.kind === 'number' && <form className="number" onSubmit={e => { e.preventDefault(); const v = Number(draft); if (Number.isFinite(v) && v >= c.min! && v <= c.max!) save(c, Math.round(v)); }}>
                <label><span className="sr">{c.title}</span><input autoFocus type="number" inputMode="numeric" min={c.min} max={c.max} required value={draft} placeholder={item.value != null ? String(item.value) : ''} onChange={e => setDraft(e.target.value)}/><span>{c.unit}</span></label>
                <button className="btn">Save</button>
              </form>}
              {c.id === 'shoulder' && <div className="row-actions">
                <p>{item.value != null ? `Today ${item.value}°` : 'Not recorded today.'}{g != null && ` Ghost ${Math.round(g)}°.`} Same camera spot each time.</p>
                <button className="btn" onClick={() => onCamera('shoulder')}><Camera size={16}/> Record 12 s</button>
                <button className="btn ghost" onClick={onMovement}><Move3d size={16}/> Compare movement</button>
              </div>}
              {c.id === 'legs' && <div className="row-actions">
                <p>{item.value != null ? `Today ${item.value} cm` : 'Not scanned today.'}{g != null && ` Ghost ${g.toFixed(1)} cm.`} Zero-g fluid shift alone thins legs up to 6% in the first days (NASA HIDH).</p>
                <button className="btn" onClick={() => onCamera('legs')}><ScanLine size={16}/> Scan 5 s</button>
              </div>}
              {c.kind === 'data' && <NasaData series={c.series!}/>}
              {instrument && <p className="muted">Not measured onboard by GhostPilot. Log it in the handoff when the {c.needs!.replace(/^Needs /, '').toLowerCase()} is used.</p>}
              {c.kind === 'data' && c.needs && <p className="muted">{c.needs}. This chart is NASA's ISS record, not your dose.</p>}
            </div>}
          </li>;
        })}
      </ol>

      {complete && <section className="done-panel" role="status" aria-label={`${region.label} complete`}>
        <span className="box done" aria-hidden="true"><Check size={16} strokeWidth={3}/></span>
        <div>
          <p><b>{actionable.length === 1 ? 'Done today.' : `All ${actionable.length} done today.`}</b> {flagged.length ? 'A trend is noted above.' : reported.length ? 'A report is noted above.' : 'Nothing trending against your ghost.'}</p>
          <div className="row-actions">
            {regionActions.length
              ? <span className="muted">Reassess set for {shortDate(regionActions[0].scheduledAt)}.</span>
              : <button className="btn" onClick={() => followUp('Repeat this check tomorrow', new Date(Date.now() + 86400000))}><RotateCcw size={16} aria-hidden="true"/> Reassess tomorrow</button>}
            <button className={`btn ${flagged.length || reported.length ? 'primary' : ''}`} onClick={() => onHandoff(summary())}><Send size={16} aria-hidden="true"/> Hand off</button>
          </div>
        </div>
      </section>}

      <footer className="card-foot">
        <p className="risks">NASA risks · {regionRisks.map((r, i) => <span key={r.id}>{i > 0 && ' · '}<a href={r.url} target="_blank" rel="noreferrer">{r.label}<ArrowUpRight size={11}/></a></span>)}</p>
        {next && !open_ && <><span id="next-check" className="sr">Next: {next.check.title}</span><button className="btn primary" aria-describedby="next-check" onClick={begin}><Play size={16}/> {doneCount ? 'Continue' : 'Begin'}</button></>}
      </footer>
    </div>
  </article>;
}

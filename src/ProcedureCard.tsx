import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Camera, Check, ChevronDown, Move3d, Play, ScanLine } from 'lucide-react';
import { hazards, risks, totalSeconds } from './body.mjs';
import { median } from './rules.mjs';
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
}

const followUps = ['Repeat this check tomorrow', 'Note it for the flight surgeon', 'Review the mission-approved procedure'];
const fmt = (s: number) => s >= 60 ? `${Math.floor(s / 60)} MIN${s % 60 ? ` ${s % 60} S` : ''}` : `${s} S`;

export default function ProcedureCard({ region, status, analysis, simulated, actions, onSave, onAttention, onCamera, onMovement, onFollowUp }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [plan, setPlan] = useState(false);
  const items = status.items;
  const ghost = useMemo(() => Object.fromEntries(region.checks.filter(c => c.field).map(c => [c.field!, median(analysis.baselineRecords.map(r => (r as unknown as Record<string, number>)[c.field!]))])), [region, analysis]);
  const pending = items.filter(i => i.check.field && !i.done);
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
  const regionActions = actions.filter(a => a.kind === region.id && a.status === 'scheduled');

  return <article className="card" aria-labelledby="card-title">
    <div className="tabs" aria-label="NASA hazards">
      {regionHazards.map(h => <a key={h.id} href={h.url} target="_blank" rel="noreferrer" style={{ background: h.color }} aria-label={`${h.label} hazard (NASA)`}><span>{h.label}</span></a>)}
    </div>
    <div className="card-main">
      <header className="card-head">
        <span className="letter" aria-hidden="true">{region.letter}</span>
        <h2 id="card-title">{region.label}</h2>
        <span className="card-time">{pending.length ? `${pending.length} ${pending.length === 1 ? 'check' : 'checks'} · ${fmt(totalSeconds(pending.map(i => i.check)))}` : items.some(i => i.check.field) ? 'Done today' : 'Reference'}</span>
      </header>

      {(flagged.length > 0 || reported.length > 0) && <div className={`note ${flagged.length ? 'flag' : ''}`} role="status">
        <b>{flagged.length ? 'Trend' : 'Reported'}</b>
        <div>
          <p>{flagged.length ? flagged.map(note).join(' ') : `Last report: ${reported.map(i => `${i.check.title.toLowerCase()} (${i.check.options?.[i.last ?? 0].toLowerCase()})`).join(', ')}.`}</p>
          {regionActions.length ? <p className="muted">Follow-up set: {regionActions[0].title.toLowerCase()}.</p>
            : plan ? <form className="plan" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); onFollowUp({ id: crypto.randomUUID(), title: String(f.get('action')), kind: region.id as FollowUp['kind'], notes: '', checklist: [], createdAt: new Date().toISOString(), scheduledAt: new Date(String(f.get('when'))).toISOString(), status: 'scheduled', simulated }); setPlan(false); }}>
              <select name="action" aria-label="Follow-up">{followUps.map(a => <option key={a}>{a}</option>)}</select>
              <input name="when" type="date" aria-label="Reassess on" required defaultValue={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}/>
              <button className="btn">Save</button>
            </form>
            : <button className="link" onClick={() => setPlan(true)}>Plan follow-up</button>}
        </div>
      </div>}

      <ol className="steps">
        {items.map((item, n) => {
          const c = item.check;
          const isOpen = open === c.id;
          const g = c.field ? ghost[c.field] : null;
          const valueText = item.value == null ? '' : c.options ? c.options[c.kind === 'scale' ? item.value - 1 : item.value] : `${item.value} ${c.unit ?? ''}`;
          const instrument = c.kind === 'instrument';
          return <li key={c.id} className={`${isOpen ? 'open' : ''} ${instrument ? 'instrument' : ''}`}>
            <button className="step" aria-expanded={isOpen} onClick={() => {
              if (c.kind === 'task') onAttention();
              else if (c.kind === 'camera' && !isOpen) setOpen(c.id);
              else setOpen(isOpen ? null : c.id);
            }}>
              <span className="n">{n + 1}</span>
              <span className="t">{c.title}{g != null && <small>Ghost {c.kind === 'symptom' ? c.options![Math.round(g)] : `${c.unit === 'cm' ? g.toFixed(1) : Math.round(g)}${c.kind === 'scale' ? '/5' : c.unit ? ` ${c.unit}` : ''}`}</small>}</span>
              <span className="time">{instrument ? c.needs : c.kind === 'data' ? 'NASA data' : fmt(c.seconds!)}</span>
              {c.kind === 'data' ? <span aria-hidden="true"/> : <span className={`box ${item.done ? 'done' : ''} ${item.flagged ? 'flag' : ''}`} role="img" aria-label={item.done ? `Done: ${valueText}` : instrument ? 'Not measured onboard' : 'Not done today'}>
                {item.done && <Check size={16} strokeWidth={3}/>}
              </span>}
              {(c.kind === 'data' || instrument || c.kind === 'camera') && <ChevronDown className="chev" size={16} aria-hidden="true"/>}
            </button>
            {isOpen && <div className="step-body">
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

      <footer className="card-foot">
        <p className="risks">NASA risks · {regionRisks.map((r, i) => <span key={r.id}>{i > 0 && ' · '}<a href={r.url} target="_blank" rel="noreferrer">{r.label}<ArrowUpRight size={11}/></a></span>)}</p>
        {pending.length > 0 && !open_ && <button className="btn primary" onClick={begin}><Play size={16}/> Begin</button>}
      </footer>
    </div>
  </article>;
}

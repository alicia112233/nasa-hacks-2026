import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { formatDate } from './data';
import { BUILDS, LIMITS } from './physique.mjs';
import { compareScan, thighCm, validScan } from './scan.mjs';
import { linkedReading, scanHistory, scanId } from './scan-history.mjs';
import type { BodyScan, CheckIn, Profile } from './types';

interface Props {
  profile: Profile;
  onProfile: (patch: Partial<Profile>) => void;
  onLegs: () => void;
  onScan: () => void;
  onClose: () => void;
  /** Records on this device, to tell whether a scan's thigh reading is still in Trends. */
  checkIns: CheckIn[];
  onDeleteScan: (id: string) => void;
  /** A just-added member: the name field opens ready to type. */
  editName?: boolean;
  onNamed?: () => void;
  /** Others are on the roster, so this member can be removed. */
  canRemove: boolean;
  onRemove: () => void;
}

const LABEL: Record<string, string> = { female: 'Female', male: 'Male', slight: 'Slight', average: 'Average', muscular: 'Muscular' };
const inRange = (v: number, [lo, hi]: number[]) => Number.isFinite(v) && v >= lo && v <= hi;
const BREADTHS = ['shoulders', 'waist', 'hips', 'arms'] as const;
const HEAD: Record<string, string> = { shoulders: 'Shoulders', waist: 'Waist', hips: 'Hips', arms: 'Arms' };
const pct = (x: number) => !Number.isFinite(x) ? '—' : `${x > 0.005 ? '+' : x < -0.005 ? '−' : ''}${Math.abs(Math.round(x * 100))}%`;
const when = (s: BodyScan) => formatDate(s.date, { hour: '2-digit', minute: '2-digit' });
/** Shown before Show all. */
const RECENT = 6;

/** Click-to-edit text: the value reads as a heading until clicked; Enter or leaving the field saves, Escape cancels. */
function EditText({ value, label, className, onSave, start = false, onDone }: { value: string; label: string; className: string; onSave: (v: string) => void; start?: boolean; onDone?: () => void }) {
  const [editing, setEditing] = useState(start);
  if (!editing) return <button className={`edit-text ${className}`} onClick={() => setEditing(true)}>{value || label}<Pencil size={className === 'crew-name' ? 20 : 14} aria-hidden="true"/><span className="sr"> · edit {label.toLowerCase()}</span></button>;
  const save = (v: string) => { const t = v.trim(); if (t && t !== value) onSave(t); setEditing(false); onDone?.(); };
  return <input className={`edit-text-input ${className}`} aria-label={label} autoFocus data-autofocus={start || undefined} defaultValue={value} maxLength={40}
    onFocus={e => e.currentTarget.select()}
    onBlur={e => save(e.currentTarget.value)}
    onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { e.stopPropagation(); setEditing(false); onDone?.(); } }}/>;
}

/** A number that saves when you leave the field or press Enter, and only when it is in range. */
function EditNumber({ value, label, unit, limits, step, onSave }: { value?: number; label: string; unit: string; limits: number[]; step: number; onSave: (v: number) => void }) {
  return <label className="crew-number"><span className="sr">{label}</span>
    <input key={value ?? 'empty'} type="number" inputMode="decimal" min={limits[0]} max={limits[1]} step={step} defaultValue={value ?? ''}
      onBlur={e => { const v = Number(e.currentTarget.value); if (e.currentTarget.value !== '' && inRange(v, limits) && v !== value) onSave(v); }}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}/>
    <span>{unit}</span>
  </label>;
}

/**
 * Profile editor inside the dialog opened from the top bar. Edits save as they change,
 * and the scan and Legs links lead directly to their respective flows.
 */
export default function CrewCard({ profile, onProfile, onLegs, onScan, onClose, checkIns, onDeleteScan, editName = false, onNamed, canRemove, onRemove }: Props) {
  const [confirm, setConfirm] = useState(false);
  const [showAll, setShowAll] = useState(false);
  /** The scan waiting for delete confirmation, and where focus goes once that is answered. */
  const [pending, setPending] = useState<string | null>(null);
  const focusAfter = useRef<string | null>(null);
  const root = useRef<HTMLElement>(null);
  const scan = profile.scan;
  const height = inRange(profile.heightCm ?? NaN, LIMITS.heightCm) ? profile.heightCm! : null;
  const history = scanHistory(profile).slice().reverse();
  const shown = showAll ? history : history.slice(0, RECENT);
  const target = history.find(s => scanId(s) === pending);
  const reading = target ? linkedReading(checkIns, profile.id, target) : null;
  const shaping = !!target && !!scan && scanId(scan) === scanId(target);
  const fallback = shaping && history.some(s => s !== target && s.mode !== 'legs');
  useEffect(() => {
    const at = focusAfter.current;
    if (at == null) return;
    focusAfter.current = null;
    const find = (selector: string) => root.current?.querySelector<HTMLElement>(selector);
    // After a delete, stay in the history; with nothing left, the Scan row's button is next.
    const element = at === 'confirm' ? find('.scan-confirm .link') : at ? find(`[data-scan="${CSS.escape(at)}"]`) : find('.scan-history-table') ?? find('.scan-row-action');
    element?.focus();
  });
  function ask(id: string | null, focus: string) { focusAfter.current = focus; setPending(id); }
  const fromScan = () => scan?.detected && scan.detected.build === profile.build ? <small>{scan.detected.sure.build ? 'From scan' : 'Best guess from scan'}</small> : null;
  const byHand = scan ? {} : { setByHand: true };

  return <article ref={root} className="crew-profile" aria-labelledby="profile-title">
      <header className="card-head">
        <span className="letter" aria-hidden="true">{profile.initials || '—'}</span>
        <div className="crew-head">
          <h3 id="profile-title"><EditText value={profile.name} label="Name" className="crew-name" start={editName} onDone={onNamed} onSave={name => onProfile({ name })}/></h3>
          <EditText value={profile.mission} label="Mission" className="crew-mission" onSave={mission => onProfile({ mission })}/>
        </div>
      </header>

      <dl className="crew-facts" aria-label="Body">
        <div>
          <dt>Scan</dt>
          <dd>{scan ? formatDate(scan.date) : <span className="muted-ink">Not scanned</span>}
            <button className="link scan-row-action" onClick={onScan}>{scan ? 'Rescan' : 'Scan me'}</button></dd>
        </div>
        <div>
          <dt id="crew-body">Avatar model</dt>
          <dd><span className="seg" role="group" aria-labelledby="crew-body">{(['female', 'male'] as const).map(v => <button key={v} aria-pressed={profile.sex === v} onClick={() => onProfile({ sex: v, ...byHand })}>{LABEL[v]}</button>)}</span></dd>
        </div>
        <div>
          <dt id="crew-build">Build</dt>
          <dd><span className="seg" role="group" aria-labelledby="crew-build">{(BUILDS as NonNullable<Profile['build']>[]).map(v => <button key={v} aria-pressed={(profile.build ?? 'average') === v} onClick={() => onProfile({ build: v, ...byHand })}>{LABEL[v]}</button>)}</span>{fromScan()}</dd>
        </div>
        <div>
          <dt>Height</dt>
          <dd><EditNumber value={height ?? undefined} label="Height" unit="cm" limits={LIMITS.heightCm} step={1} onSave={v => onProfile({ heightCm: Math.round(v) })}/></dd>
        </div>
        <div>
          <dt>Mass</dt>
          <dd><EditNumber value={profile.massKg} label="Mass" unit="kg" limits={LIMITS.massKg} step={0.5} onSave={v => onProfile({ massKg: v, ...byHand })}/></dd>
        </div>
      </dl>

      {history.length > 0 && <div className="scan-history">
        <div className="scan-history-head"><h4 id="scan-history-title">Scan history <small>{history.length}</small></h4><button className="link" onClick={onLegs}>Thigh trend in H Legs</button></div>
        <div className="scroll scan-history-table" tabIndex={0} role="region" aria-labelledby="scan-history-title">
          <table className="ledger small">
            <thead><tr><th scope="col">Date</th><th scope="col">Type</th><th scope="col">Thigh</th>{BREADTHS.map(m => <th key={m} scope="col">{HEAD[m]}</th>)}<th scope="col"><span className="sr">Delete</span></th></tr></thead>
            <tbody>{shown.map(s => {
              const id = scanId(s), current = !!scan && scanId(scan) === id;
              const cm = thighCm(s, height ?? undefined);
              const vs = validScan(s) ? compareScan(s, { female: (s.detected?.sex ?? profile.sex) === 'female' ? 1 : 0 }) : null;
              return <tr key={id} className={current ? 'on' : ''}>
                <th scope="row">{when(s)}{current && <small>Shapes figure</small>}</th>
                <td>{s.mode === 'legs' ? 'Legs' : 'Body'}</td>
                <td>{cm != null ? `${cm} cm` : '—'}</td>
                {BREADTHS.map(m => <td key={m}>{vs ? pct(vs[m].you) : '—'}</td>)}
                <td><button className="icon-btn" data-scan={id} aria-label={`Delete scan from ${when(s)}`} onClick={() => ask(id, 'confirm')}><Trash2 size={16} aria-hidden="true"/></button></td>
              </tr>;
            })}</tbody>
          </table>
        </div>
        <p className="muted">% against the standard figure</p>
        {history.length > RECENT && <button className="link" onClick={() => setShowAll(!showAll)}>{showAll ? 'Show recent' : `Show all ${history.length}`}</button>}
        {target && <div className="crew-remove scan-confirm" role="group" aria-label="Confirm scan deletion">
          <span>Delete the {when(target)} scan?{reading ? ` Its ${reading.thighCm} cm thigh reading leaves Trends too.` : ''}{shaping ? (fallback ? ' The figure goes back to your previous scan.' : ' The figure goes back to the standard one.') : ''}</span>
          <button className="btn danger-btn" onClick={() => { onDeleteScan(scanId(target)); ask(null, ''); }}>Delete</button>
          <button className="link" onClick={() => ask(null, scanId(target))}>Cancel</button>
        </div>}
      </div>}

      <footer className="card-foot crew-foot">
        <button className="btn" onClick={onClose}>Done</button>
        {canRemove && (confirm
          ? <div className="crew-remove" role="group" aria-label="Confirm removal"><span>Remove {profile.name} and their records?</span>
            <button className="btn danger-btn" onClick={onRemove}>Remove</button><button className="link" onClick={() => setConfirm(false)}>Cancel</button></div>
          : <button className="btn outline-danger" onClick={() => setConfirm(true)}>Remove from crew</button>)}
      </footer>
  </article>;
}

import { useState, type KeyboardEvent } from 'react';
import { Pencil } from 'lucide-react';
import { formatDate } from './data';
import { BUILDS, LIMITS, physique, zeroGForSol } from './physique.mjs';
import { thighCm } from './scan.mjs';
import type { Profile } from './types';

interface Props {
  profile: Profile;
  onProfile: (patch: Partial<Profile>) => void;
  onLegs: () => void;
  /** A just-added member: the name field opens ready to type. */
  editName?: boolean;
  onNamed?: () => void;
  /** Others are on the roster, so this member can be removed. */
  canRemove: boolean;
  onRemove: () => void;
}

const LABEL: Record<string, string> = { female: 'Female', male: 'Male', slight: 'Slight', average: 'Average', muscular: 'Muscular' };
const inRange = (v: number, [lo, hi]: number[]) => Number.isFinite(v) && v >= lo && v <= hi;

/** Click-to-edit text: the value reads as a heading until clicked; Enter or leaving the field saves, Escape cancels. */
function EditText({ value, label, className, onSave, start = false, onDone }: { value: string; label: string; className: string; onSave: (v: string) => void; start?: boolean; onDone?: () => void }) {
  const [editing, setEditing] = useState(start);
  if (!editing) return <button className={`edit-text ${className}`} onClick={() => setEditing(true)}>{value || label}<Pencil size={className === 'crew-name' ? 20 : 14} aria-hidden="true"/><span className="sr"> · edit {label.toLowerCase()}</span></button>;
  const save = (v: string) => { const t = v.trim(); if (t && t !== value) onSave(t); setEditing(false); onDone?.(); };
  return <input className={`edit-text-input ${className}`} aria-label={label} autoFocus defaultValue={value} maxLength={40}
    onFocus={e => e.currentTarget.select()}
    onBlur={e => save(e.currentTarget.value)}
    onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setEditing(false); onDone?.(); } }}/>;
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
 * The crew member's card, opened from the name plate above the body. Everything about the person is here and edits in
 * place: name and mission in the head, and one Body list (scan, shape, build, height, mass) that shapes the figure beside it.
 * The scan itself is the Scan me button above the body. The crew member is chosen in the top bar.
 */
export default function CrewCard({ profile, onProfile, onLegs, editName = false, onNamed, canRemove, onRemove }: Props) {
  const [confirm, setConfirm] = useState(false);
  const scan = profile.scan;
  const height = inRange(profile.heightCm ?? NaN, LIMITS.heightCm) ? profile.heightCm! : null;
  const cm = scan ? thighCm(scan, height ?? undefined) : null;
  const zeroG = height ? physique(profile, zeroGForSol(99)).statureCm : null;
  const fromScan = (field: 'sex' | 'build') => scan?.detected && scan.detected[field] === profile[field] ? <small>{scan.detected.sure[field] ? 'From scan' : 'Scan’s best guess'}</small> : null;
  const byHand = scan ? {} : { setByHand: true };

  return <article className="card crew-card" aria-labelledby="card-title">
    <div className="tabs" aria-hidden="true"><span className="crew-tab"><span>Crew</span></span></div>
    <div className="card-main">
      <header className="card-head">
        <span className="letter" aria-hidden="true">{profile.initials || '—'}</span>
        <div className="crew-head">
          <h2 id="card-title"><EditText value={profile.name} label="Name" className="crew-name" start={editName} onDone={onNamed} onSave={name => onProfile({ name })}/></h2>
          <EditText value={profile.mission} label="Mission" className="crew-mission" onSave={mission => onProfile({ mission })}/>
        </div>
      </header>

      <dl className="crew-facts" aria-label="Body">
        <div>
          <dt>Scan</dt>
          <dd>{scan
            ? <>{formatDate(scan.date)}{cm != null && <> · thigh {cm} cm, tracked in <button className="link" onClick={onLegs}>H Legs</button></>} · <button className="link" onClick={() => onProfile({ scan: undefined })}>Remove</button></>
            : <span className="muted-ink">Not scanned. Scan me reads shape, build and weight.</span>}</dd>
        </div>
        <div>
          <dt id="crew-body">Body</dt>
          <dd><span className="seg" role="group" aria-labelledby="crew-body">{(['female', 'male'] as const).map(v => <button key={v} aria-pressed={profile.sex === v} onClick={() => onProfile({ sex: v, ...byHand })}>{LABEL[v]}</button>)}</span>{fromScan('sex')}</dd>
        </div>
        <div>
          <dt id="crew-build">Build</dt>
          <dd><span className="seg" role="group" aria-labelledby="crew-build">{(BUILDS as NonNullable<Profile['build']>[]).map(v => <button key={v} aria-pressed={(profile.build ?? 'average') === v} onClick={() => onProfile({ build: v, ...byHand })}>{LABEL[v]}</button>)}</span>{fromScan('build')}</dd>
        </div>
        <div>
          <dt>Height</dt>
          <dd><EditNumber value={height ?? undefined} label="Height" unit="cm" limits={LIMITS.heightCm} step={1} onSave={v => onProfile({ heightCm: Math.round(v) })}/>
            <small>{zeroG ? `${zeroG} cm in zero g · the scan’s ruler` : 'The scan’s ruler: a camera can’t measure size'}</small></dd>
        </div>
        <div>
          <dt>Mass</dt>
          <dd>{scan
            ? <span className="muted-ink">From the scan</span>
            : <EditNumber value={profile.massKg} label="Mass" unit="kg" limits={LIMITS.massKg} step={0.5} onSave={v => onProfile({ massKg: v, setByHand: true })}/>}</dd>
        </div>
      </dl>

      <footer className="card-foot crew-foot">
        <p className="risks">Stays on this device. Clear everyone from Mission → Data.</p>
        {canRemove && (confirm
          ? <div className="crew-remove" role="group" aria-label="Confirm removal"><span>Remove {profile.name} and their records?</span>
            <button className="btn danger-btn" onClick={onRemove}>Remove</button><button className="link" onClick={() => setConfirm(false)}>Cancel</button></div>
          : <button className="btn outline-danger" onClick={() => setConfirm(true)}>Remove from crew</button>)}
      </footer>
    </div>
  </article>;
}

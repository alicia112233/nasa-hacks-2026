import { useState } from 'react';
import type { CheckIn, MeasurementContext } from './types';

export type ReadingCheck = { id: string; title: string; field?: string; field2?: string; unit?: string; min?: number; max?: number; min2?: number; max2?: number; step?: number; methods?: string[]; timeLabel?: string; skip?: string };
const localNow = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);

/** Instrument and numeric readings keep their original time, unit and collection method. */
export default function ReadingForm({ check, onSave, onSkip }: { check: ReadingCheck; onSave: (values: Partial<CheckIn>, metadata: Record<string, Partial<MeasurementContext>>) => void; onSkip: () => void }) {
  const [value, setValue] = useState('');
  const [second, setSecond] = useState('');
  const [at, setAt] = useState(localNow);
  const [method, setMethod] = useState(check.methods?.[0] ?? 'Entered by crew');
  const [error, setError] = useState('');
  return <form className="reading-form" aria-label={`Record ${check.title.toLowerCase()}`} onSubmit={e => {
    e.preventDefault();
    const first = Number(value), other = Number(second), when = new Date(at);
    if (!value.trim() || !Number.isFinite(first) || first < check.min! || first > check.max!) { setError('Enter a reading within the displayed range.'); return; }
    if (check.field2 && (!second.trim() || !Number.isFinite(other) || other < check.min2! || other > check.max2! || other >= first)) { setError('Enter both cuff values. Systolic must be higher than diastolic.'); return; }
    if (!Number.isFinite(when.getTime()) || when.getTime() > Date.now()) { setError('Choose the time the reading was taken, up to now.'); return; }
    const fields = check.field2 ? [check.field!, check.field2] : [check.field!];
    const metadata = Object.fromEntries(fields.map(field => [field, { measuredAt: when.toISOString(), unit: check.unit, method }]));
    onSave({ [check.field!]: first, ...(check.field2 ? { [check.field2]: other } : {}) }, metadata);
  }}>
    <div className="context-fields">
      <label className="field">{check.field2 ? 'Systolic' : `${check.title} (${check.unit})`}<input autoFocus type="number" inputMode={check.step ? 'decimal' : 'numeric'} min={check.min} max={check.max} step={check.step ?? 1} required value={value} onChange={e => setValue(e.target.value)}/></label>
      {check.field2 && <label className="field">Diastolic<input type="number" inputMode="numeric" min={check.min2} max={check.max2} required value={second} onChange={e => setSecond(e.target.value)}/></label>}
      {check.methods && <label className="field">Method<select value={method} onChange={e => setMethod(e.target.value)}>{check.methods.map(m => <option key={m}>{m}</option>)}</select></label>}
      <label className="field">{check.timeLabel ?? 'Measured at'}<input type="datetime-local" required max={localNow()} value={at} onChange={e => setAt(e.target.value)}/></label>
    </div>
    {check.field2 && <p className="muted">Both readings in {check.unit}.</p>}
    {error && <p className="error" role="alert">{error}</p>}
    <div className="row-actions"><button className="btn">Save</button>{check.skip && <button type="button" className="link" onClick={onSkip}>{check.skip}</button>}</div>
  </form>;
}

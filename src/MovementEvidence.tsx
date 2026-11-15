import { useEffect, useState } from 'react';
import { formatDate } from './data';
import { comparisonIssue } from './references.mjs';
import type { GhostReference, Recording } from './types';

function RecordingVideo({ recording, label }: { recording: Recording; label: string }) {
  const [url, setUrl] = useState('');
  useEffect(() => { const objectUrl = URL.createObjectURL(recording.blob); setUrl(objectUrl); return () => URL.revokeObjectURL(objectUrl); }, [recording]);
  return <figure className="movement-video"><video key={recording.id} src={url || undefined} controls playsInline aria-label={label}/><figcaption>{label} · {formatDate(recording.date, { hour: '2-digit', minute: '2-digit' })}<br/>{recording.leftRange == null ? 'No confident left-shoulder estimate' : `Left shoulder estimate ${recording.leftRange}°`} · {recording.confidentFrames?.left ?? 'Unknown'} confident frames</figcaption></figure>;
}

export default function MovementEvidence({ recordings, references, onRecord }: { recordings: Recording[]; references: GhostReference[]; onRecord: () => void }) {
  const ordered = recordings.slice().sort((a, b) => a.date.localeCompare(b.date));
  const [selected, setSelected] = useState(ordered.at(-1)?.id ?? '');
  const current = ordered.find(r => r.id === selected) ?? ordered.at(-1);
  const reference = references.find(r => !r.simulated && r.phase === current?.conditions?.phase) ?? references.find(r => !r.simulated && r.phase === 'preflight');
  const candidate = reference?.records.map(r => ({ entry: r, recording: ordered.find(v => v.id === r.measurements?.leftRange?.recordingId && v.id !== current?.id && v.date < (current?.date ?? '')) })).find(r => r.recording);
  const previous = candidate?.recording;
  const issue = current && candidate ? comparisonIssue({ measurements: { leftRange: current.conditions } }, candidate.entry, 'leftRange') : null;
  return <section className="movement-evidence" aria-labelledby="movement-evidence-title">
    <div className="row-actions"><h3 id="movement-evidence-title">Your movement evidence</h3><button className="btn" onClick={onRecord}>Record movement</button></div>
    <p className="muted">Angles are estimates. Trust the video.</p>
    {ordered.length > 1 && <label className="field">Recording to review<select value={current?.id ?? ''} onChange={e => setSelected(e.target.value)}>{ordered.slice().reverse().map(r => <option key={r.id} value={r.id}>{formatDate(r.date, { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · {r.leftRange ?? 'No angle'}°</option>)}</select></label>}
    {current ? <>
      <div className="movement-video-pair"><RecordingVideo recording={current} label="Crew recording"/>{previous ? <RecordingVideo recording={previous} label="Ghost recording"/> : <div className="movement-reference-gap"><b>No ghost video yet</b></div>}</div>
      {issue && <p className="comparison-note">Can’t compare. {issue}</p>}
      {previous && !issue && <p className="muted">Same phase and conditions.</p>}
      <p className="muted">{current.conditions ? `Phase: ${current.conditions.phase}. Camera: ${current.conditions.cameraSetup || 'not recorded'}. Posture: ${current.conditions.posture || 'not recorded'}. Lighting: ${current.conditions.lighting || 'not recorded'}. Clothing: ${current.conditions.clothing || 'not recorded'}.` : 'Conditions weren’t saved with this recording.'}</p>
    </> : <p>No recording yet. Record one to review it here.</p>}
  </section>;
}

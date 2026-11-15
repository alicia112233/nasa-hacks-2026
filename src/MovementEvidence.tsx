import { useEffect, useState } from 'react';
import { formatDate } from './data';
import { comparisonIssue } from './references.mjs';
import type { GhostReference, Recording } from './types';

function RecordingVideo({ recording, label }: { recording: Recording; label: string }) {
  const [url, setUrl] = useState('');
  useEffect(() => { const objectUrl = URL.createObjectURL(recording.blob); setUrl(objectUrl); return () => URL.revokeObjectURL(objectUrl); }, [recording]);
  return <figure className="movement-video"><video key={recording.id} src={url || undefined} controls playsInline aria-label={label}/><figcaption>{label} · {formatDate(recording.date, { hour: '2-digit', minute: '2-digit' })}<br/>{recording.leftRange == null ? 'No confident left-shoulder estimate' : `Left shoulder estimate ${recording.leftRange}°`} · {recording.confidentFrames?.left ?? 'Unknown'} confident frames</figcaption></figure>;
}

/**
 * The ghost video for a recording: one from a fixed phase or preflight ghost when it has one; otherwise, as with every
 * other measure, your earliest readings: the first earlier recording that gave an angle.
 */
export function ghostRecording(recordings: Recording[], references: GhostReference[], current?: Recording) {
  const ordered = recordings.slice().sort((a, b) => a.date.localeCompare(b.date));
  const earlier = ordered.filter(v => current && v.id !== current.id && v.date < current.date);
  const reference = references.find(r => !r.simulated && r.phase === current?.conditions?.phase) ?? references.find(r => !r.simulated && r.phase === 'preflight');
  const fixed = reference?.records.map(r => ({ entry: r, recording: earlier.find(v => v.id === r.measurements?.leftRange?.recordingId) })).find(r => r.recording);
  if (fixed) return { recording: fixed.recording!, entry: fixed.entry, auto: false };
  const first = earlier.find(v => v.leftRange != null);
  return first ? { recording: first, entry: { measurements: { leftRange: first.conditions } }, auto: true } : null;
}

export default function MovementEvidence({ recordings, references, onRecord }: { recordings: Recording[]; references: GhostReference[]; onRecord: () => void }) {
  const ordered = recordings.slice().sort((a, b) => a.date.localeCompare(b.date));
  const [selected, setSelected] = useState(ordered.at(-1)?.id ?? '');
  const current = ordered.find(r => r.id === selected) ?? ordered.at(-1);
  const ghost = ghostRecording(ordered, references, current);
  const previous = ghost?.recording;
  const issue = current && ghost ? comparisonIssue({ measurements: { leftRange: current.conditions } }, ghost.entry, 'leftRange') : null;
  return <section className="movement-evidence" aria-labelledby="movement-evidence-title">
    <div className="row-actions"><h3 id="movement-evidence-title">Your movement evidence</h3><button className="btn" onClick={onRecord}>Record movement</button></div>
    <p className="muted">Angles are estimates. Trust the video.</p>
    {ordered.length > 1 && <label className="field">Recording to review<select value={current?.id ?? ''} onChange={e => setSelected(e.target.value)}>{ordered.slice().reverse().map(r => <option key={r.id} value={r.id}>{formatDate(r.date, { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · {r.leftRange ?? 'No angle'}°</option>)}</select></label>}
    {current ? <>
      <div className="movement-video-pair"><RecordingVideo recording={current} label="Crew recording"/>{previous ? <RecordingVideo recording={previous} label="Ghost recording"/> : <div className="movement-reference-gap"><b>No ghost video yet</b><span>Record once more: your first recording with an angle becomes your ghost.</span></div>}</div>
      {issue && <p className="comparison-note">Can’t compare. {issue}</p>}
      {previous && !issue && <p className="muted">{ghost?.auto ? 'Ghost: your first recording with an angle.' : 'Ghost: your fixed ghost recording. Same phase and conditions.'}{current.leftRange != null && previous.leftRange != null ? ` Left shoulder ${current.leftRange}° against ${previous.leftRange}°.` : ''}</p>}
      <p className="muted">{current.conditions ? `Phase: ${current.conditions.phase}. Camera: ${current.conditions.cameraSetup || 'not recorded'}. Posture: ${current.conditions.posture || 'not recorded'}. Lighting: ${current.conditions.lighting || 'not recorded'}. Clothing: ${current.conditions.clothing || 'not recorded'}.` : 'Conditions weren’t saved with this recording.'}</p>
    </> : <p>No recording yet. Record one to review it here.</p>}
  </section>;
}

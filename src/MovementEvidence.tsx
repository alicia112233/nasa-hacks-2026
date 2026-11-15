import { useEffect, useState } from 'react';
import { formatDate } from './data';
import { comparisonIssue } from './references.mjs';
import type { GhostClip, GhostReference, Recording } from './types';

function RecordingVideo({ recording, label }: { recording: Recording; label: string }) {
  const [url, setUrl] = useState('');
  useEffect(() => { const objectUrl = URL.createObjectURL(recording.blob); setUrl(objectUrl); return () => URL.revokeObjectURL(objectUrl); }, [recording]);
  return <figure className="movement-video"><video key={recording.id} src={url || undefined} controls playsInline aria-label={label}/><figcaption>{label} · {formatDate(recording.date, { hour: '2-digit', minute: '2-digit' })}<br/>{recording.leftRange == null ? 'No confident left-shoulder estimate' : `Left shoulder estimate ${recording.leftRange}°`} · {recording.confidentFrames?.left ?? 'Unknown'} confident frames</figcaption></figure>;
}

type GhostKind = 'chosen' | 'fixed' | 'first';
/**
 * The ghost video for a recording. The first clip with an angle is the ghost, kept for reference, unless a clip was
 * chosen on purpose (the latest choice wins) or a fixed phase or preflight ghost has a clip.
 */
export function ghostRecording(recordings: Recording[], references: GhostReference[], current?: Recording, clips: GhostClip[] = []) {
  const ordered = recordings.slice().sort((a, b) => a.date.localeCompare(b.date));
  const others = ordered.filter(v => current && v.id !== current.id);
  const choice = clips.at(-1);
  const chosen = choice && others.find(v => v.id === choice.recordingId);
  if (chosen) return { recording: chosen, entry: { measurements: { leftRange: chosen.conditions } }, kind: 'chosen' as GhostKind, choice };
  const earlier = others.filter(v => v.date < (current?.date ?? ''));
  const reference = references.find(r => !r.simulated && r.phase === current?.conditions?.phase) ?? references.find(r => !r.simulated && r.phase === 'preflight');
  const fixed = reference?.records.map(r => ({ entry: r, recording: earlier.find(v => v.id === r.measurements?.leftRange?.recordingId) })).find(r => r.recording);
  if (fixed) return { recording: fixed.recording!, entry: fixed.entry, kind: 'fixed' as GhostKind };
  const first = earlier.find(v => v.leftRange != null);
  return first ? { recording: first, entry: { measurements: { leftRange: first.conditions } }, kind: 'first' as GhostKind } : null;
}

const when = (date: string) => formatDate(date, { hour: '2-digit', minute: '2-digit' });

export default function MovementEvidence({ recordings, references, onRecord, clips = [], onGhostClip }: { recordings: Recording[]; references: GhostReference[]; onRecord: () => void; clips?: GhostClip[]; onGhostClip?: (recordingId: string, reason: string) => void }) {
  const ordered = recordings.slice().sort((a, b) => a.date.localeCompare(b.date));
  const [selected, setSelected] = useState(ordered.at(-1)?.id ?? '');
  const [choosing, setChoosing] = useState(false);
  const [reason, setReason] = useState('');
  const current = ordered.find(r => r.id === selected) ?? ordered.at(-1);
  const ghost = ghostRecording(ordered, references, current, clips);
  // The clip that is the ghost for the latest recording: the one a new choice would replace.
  const ghostNow = ghostRecording(ordered, references, ordered.at(-1), clips)?.recording;
  const canChoose = !!onGhostClip && !!current && current.leftRange != null && current.id !== ghostNow?.id;
  const firstClip = ordered.find(v => v.leftRange != null);
  const history = clips.map(c => ({ ...c, recording: ordered.find(v => v.id === c.recordingId) })).filter(c => c.recording);
  const previous = ghost?.recording;
  const issue = current && ghost ? comparisonIssue({ measurements: { leftRange: current.conditions } }, ghost.entry, 'leftRange') : null;
  return <section className="movement-evidence" aria-labelledby="movement-evidence-title">
    <div className="row-actions"><h3 id="movement-evidence-title">Your movement evidence</h3><button className="btn" onClick={onRecord}>Record movement</button></div>
    <p className="muted">Angles are estimates. Trust the video.</p>
    {ordered.length > 1 && <label className="field">Recording to review<select value={current?.id ?? ''} onChange={e => setSelected(e.target.value)}>{ordered.slice().reverse().map(r => <option key={r.id} value={r.id}>{formatDate(r.date, { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · {r.leftRange ?? 'No angle'}°</option>)}</select></label>}
    {current ? <>
      <div className="movement-video-pair"><RecordingVideo recording={current} label="Crew recording"/>{previous ? <RecordingVideo recording={previous} label="Ghost recording"/> : <div className="movement-reference-gap"><b>No ghost video yet</b><span>The first clip you record is your ghost, kept for reference. Record once more to compare.</span></div>}</div>
      {issue && <p className="comparison-note">Can’t compare. {issue}</p>}
      {previous && !issue && <p className="ghost-clip-note">{ghost?.kind === 'chosen' ? `Ghost: the clip you chose on ${formatDate(ghost.choice!.setAt)} (“${ghost.choice!.reason.replace(/[.\s]+$/, '')}”).` : ghost?.kind === 'fixed' ? 'Ghost: the clip in your fixed phase ghost. Same phase and conditions.' : 'Ghost: the first clip you recorded, kept for reference.'}{current.leftRange != null && previous.leftRange != null ? ` Left shoulder ${current.leftRange}° against ${previous.leftRange}°.` : ''}</p>}
      {/* Changing the ghost clip is deliberate and stays on record; it changes the videos compared, not the alert rules. */}
      {canChoose && !choosing && <button className="link ghost-clip-use" onClick={() => setChoosing(true)}>Use this clip as your ghost</button>}
      {canChoose && choosing && <form className="ghost-clip-form" onSubmit={e => { e.preventDefault(); if (!reason.trim()) return; onGhostClip!(current.id, reason.trim()); setReason(''); setChoosing(false); }}>
        <label className="field">Why this clip?<input required autoFocus maxLength={200} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. first clip had my hips cut off"/></label>
        <div className="row-actions"><button className="btn">Use as ghost</button><button type="button" className="link" onClick={() => { setChoosing(false); setReason(''); }}>Cancel</button></div>
        <p className="muted">Earlier ghost clips stay listed. Alerts still use your readings’ ghost.</p>
      </form>}
      {history.length > 0 && <ol className="ghost-clip-history" aria-label="Ghost clip changes">
        {firstClip && <li>First clip · {when(firstClip.date)}</li>}
        {history.map(c => <li key={c.setAt}>Changed {formatDate(c.setAt)} to the clip from {when(c.recording!.date)} · {c.reason}</li>)}
      </ol>}
      <p className="muted">{current.conditions ? `Phase: ${current.conditions.phase}. Camera: ${current.conditions.cameraSetup || 'not recorded'}. Posture: ${current.conditions.posture || 'not recorded'}. Lighting: ${current.conditions.lighting || 'not recorded'}. Clothing: ${current.conditions.clothing || 'not recorded'}.` : 'Conditions weren’t saved with this recording.'}</p>
    </> : <p>No recording yet. Record one to review it here.</p>}
  </section>;
}

import { useState } from 'react';
import { ArrowDownRight, ArrowUpRight, ArrowRight, Check, ChevronRight, ClipboardCheck, Clock3, Eye, Info, Moon, Move3d, ShieldQuestion, X } from 'lucide-react';
import { analyze } from './rules.mjs';
import type { CheckIn, FlagKind, FollowUp } from './types';

const protocols = {
  movement: {
    eyebrow: 'MOVEMENT · PROTOTYPE M-01', title: 'A little less reach on the left.',
    normalTitle: 'A closer look at your movement.', icon: Move3d,
    observation: 'The last three shoulder sessions show a smaller estimated range on your left side.',
    uncertainty: 'Camera position, body rotation, restraints, effort, and gravity can change these estimates. A pose estimate cannot establish an injury or measure bone health.',
    checklist: ['Review camera position and comparable conditions', 'Note any pain or stiffness before repeating', 'Review the original video alongside the replay'],
    actions: ['Repeat standardized movement', 'Log symptoms & monitor', 'Review mission-approved protocol'],
  },
  attention: {
    eyebrow: 'ATTENTION · PROTOTYPE F-01', title: 'Your attention needs a little attention.',
    normalTitle: 'A closer look at your attention.', icon: Eye,
    observation: 'Response times have increased across your last three docking check-ins, alongside poorer reported sleep and lower energy.',
    uncertainty: 'This game is an experimental attention task. Practice, interruptions, device latency, and stress may affect results. It cannot diagnose fatigue or illness.',
    checklist: ['Reflect on recent sleep and rest opportunities', 'Note interruptions, workload, or device changes', 'Review the mission-approved fatigue checklist'],
    actions: ['Complete a fatigue review', 'Record a rest or workload action', 'Repeat the flight check'],
  },
  wellbeing: {
    eyebrow: 'WELLBEING · PROTOTYPE W-01', title: 'Make a little room for recovery.',
    normalTitle: 'A moment to check in with yourself.', icon: Moon,
    observation: 'Your recent self-reported sleep and energy are below your usual levels.',
    uncertainty: 'Self-reports are subjective and short trends can vary naturally. These observations are not a mental health assessment or a medical diagnosis.',
    checklist: ['Review the last three sleep and energy entries', 'Reflect on workload and changes to your routine', 'Check your mission-approved wellbeing guidance'],
    actions: ['Log a recovery action', 'Schedule a wellbeing check', 'Review mission-approved protocol'],
  },
};

interface Props { kind: FlagKind; checkIns: CheckIn[]; simulated: boolean; asOf?: string; onClose: () => void; onSave: (action: FollowUp) => void }

export default function Evidence({ kind, checkIns, simulated, asOf, onClose, onSave }: Props) {
  const p = protocols[kind];
  const Icon = p.icon;
  const analysis = analyze(checkIns, simulated);
  const flagged = kind === 'movement' ? analysis.movementFlag : kind === 'attention' ? analysis.attentionFlag : analysis.wellbeingFlag;
  const [checked, setChecked] = useState<string[]>([]);
  const [action, setAction] = useState(p.actions[0]);
  const [notes, setNotes] = useState('');
  const tomorrow = new Date(Date.now() + 86400000);
  tomorrow.setHours(9, 0, 0, 0);
  const localDate = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const [scheduled, setScheduled] = useState(localDate);
  const value = kind === 'movement' ? analysis.current.leftRange : kind === 'attention' ? analysis.current.reactionMs : analysis.current.sleep;
  const baseline = kind === 'movement' ? analysis.baseline.leftRange : kind === 'attention' ? analysis.baseline.reactionMs : analysis.baseline.sleep;
  const delta = kind === 'movement' ? analysis.movementDelta : analysis.attentionDelta;
  const unit = kind === 'movement' ? '°' : kind === 'attention' ? 'ms' : '/5';
  const evidenceDate = asOf ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Singapore', day: 'numeric', month: 'short' }).format(new Date(asOf)) : null;

  return <div className="modal-overlay"><section className="modal evidence-modal" role="dialog" aria-modal="true" aria-labelledby="evidence-title"><button className="modal-close icon-button" aria-label="Close evidence" onClick={onClose}><X size={20}/></button><div className="evidence-icon"><Icon size={24}/></div><div className="eyebrow">{p.eyebrow}</div><h2 id="evidence-title">{flagged ? p.title : p.normalTitle}</h2><span className={`pill ${simulated ? 'amber' : 'sage'}`}>{simulated ? 'Simulated mission evidence' : 'Your recorded evidence'}</span>{evidenceDate && <p className="historical-evidence-note">Evidence through {evidenceDate}. Later observations are excluded.</p>}<div className="evidence-section"><h3><Eye size={16}/> What your copilot observed</h3><p>{flagged ? p.observation : analysis.enough ? 'This measure has not crossed the prototype’s trend threshold.' : 'There is not enough comparable history to establish a trend yet. Keep collecting check-ins under similar conditions.'}</p><div className="evidence-stats"><div><small>LAST 3 CHECK-INS</small><strong>{value ?? '—'}<em>{unit}</em></strong></div><div><small>PERSONAL BASELINE</small><strong>{baseline ?? '—'}<em>{unit}</em></strong></div>{kind !== 'wellbeing' && <div><small>OBSERVED CHANGE</small><strong className="text-amber">{delta != null ? `${delta > 0 ? '+' : ''}${delta}%` : '—'}{delta != null && (delta < 0 ? <ArrowDownRight size={19}/> : <ArrowUpRight size={19}/>)}</strong></div>}</div><div className="evidence-source"><Info size={13}/> Median of {analysis.recent.length} recent entries compared with {analysis.baselineRecords.length} earlier entries. {simulated ? 'All values above are synthetic.' : 'Recorded data only; demo entries are excluded.'}</div>{flagged && kind !== 'wellbeing' && <div className="context-note">Also on your radar: sleep {analysis.current.sleep}/5 · energy {analysis.current.energy}/5. {analysis.recent.some((c: CheckIn) => c.symptoms.includes('Shoulder discomfort')) && 'Shoulder discomfort was reported.'}</div>}</div><div className="uncertainty-box"><ShieldQuestion size={19}/><div><h3>What remains uncertain</h3><p>{p.uncertainty}</p></div></div><form onSubmit={e => { e.preventDefault(); onSave({ id: crypto.randomUUID(), title: action, kind, notes, checklist: checked, createdAt: new Date().toISOString(), scheduledAt: new Date(scheduled).toISOString(), status: 'scheduled', simulated }); }}><div className="evidence-section"><h3><ClipboardCheck size={16}/> Investigate, then take a small step</h3><p className="muted">A prototype reflection checklist. Use mission-approved procedures for medical decisions.</p><div className="protocol-checklist">{p.checklist.map(item => <label key={item}><input type="checkbox" checked={checked.includes(item)} onChange={e => setChecked(e.target.checked ? [...checked, item] : checked.filter(s => s !== item))}/><span>{item}</span></label>)}</div><div className="action-choices">{p.actions.map(a => <button key={a} type="button" className={action === a ? 'selected' : ''} onClick={() => setAction(a)}><span className="radio-mark">{action === a && <Check size={11}/>}</span>{a}<ChevronRight size={14}/></button>)}</div><label className="form-label">What will you do?<textarea rows={2} maxLength={1000} placeholder="Record your action and anything you want to reassess…" value={notes} onChange={e => setNotes(e.target.value)}/></label><label className="form-label"><span><Clock3 size={14}/> Reassess on</span><input required type="datetime-local" value={scheduled} min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)} onChange={e => setScheduled(e.target.value)}/></label></div><button className="button primary full-width" type="submit">Log action & schedule check <ArrowRight size={16}/></button></form><p className="fine-print">Saved locally. Reminders appear in your action log when you reopen GhostPilot.</p></section></div>;
}

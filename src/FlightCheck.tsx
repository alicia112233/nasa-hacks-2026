import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowLeft, Check, CircleCheck, Clock3, Crosshair, Heart, Moon, Rocket, Sparkles, X, Zap } from 'lucide-react';
import { summarizeReaction } from './rules.mjs';
import type { CheckIn } from './types';

interface Props { onClose: () => void; onSave: (check: CheckIn) => void; sol: number }
const choices = ['Very low', 'Low', 'Okay', 'Good', 'Great'];
const moodFaces = ['☹', '◔', '−', '◡', '☺'];

export default function FlightCheck({ onClose, onSave, sol }: Props) {
  const [step, setStep] = useState(0);
  const [quick, setQuick] = useState(false);
  const [seconds, setSeconds] = useState(60);
  const [signal, setSignal] = useState<{ x: number; y: number } | null>(null);
  const [samples, setSamples] = useState<number[]>([]);
  const [missed, setMissed] = useState(0);
  const [feedback, setFeedback] = useState('Awaiting signal');
  const [sleep, setSleep] = useState(4);
  const [mood, setMood] = useState(4);
  const [energy, setEnergy] = useState(4);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [heartRate, setHeartRate] = useState('');
  const [notes, setNotes] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const scrollBody = useRef<HTMLDivElement>(null);
  const game = useRef({ shownAt: 0, nextAt: 0, active: false, samples: [] as number[], missed: 0 });
  const duration = quick ? 15 : 60;

  useEffect(() => {
    if (step === 0) return;
    scrollBody.current?.scrollTo(0, 0);
    heading.current?.focus();
  }, [step]);

  useEffect(() => {
    if (step !== 1) return;
    const start = performance.now();
    game.current = { shownAt: 0, nextAt: start + 800, active: false, samples: [], missed: 0 };
    const timer = window.setInterval(() => {
      const now = performance.now();
      setSeconds(Math.max(0, duration - (now - start) / 1000));
      const g = game.current;
      if (now - start >= duration * 1000) {
        if (g.active) g.missed++;
        setSamples([...g.samples]);
        setMissed(g.missed);
        setSignal(null);
        setStep(2);
        return;
      }
      if (g.active && now - g.shownAt > 1400) {
        g.missed++;
        g.active = false;
        g.nextAt = now + 650 + Math.random() * 850;
        setMissed(g.missed);
        setSignal(null);
        setFeedback('Signal missed. Take a breath.');
      } else if (!g.active && now >= g.nextAt) {
        g.shownAt = now;
        g.active = true;
        setSignal({ x: 15 + Math.random() * 70, y: 21 + Math.random() * 56 });
        setFeedback('Signal detected — tap or press space');
      }
    }, 40);
    return () => clearInterval(timer);
  }, [step, duration]);

  function respond() {
    const g = game.current;
    if (!g.active) return;
    const reaction = Math.round(performance.now() - g.shownAt);
    g.samples.push(reaction);
    g.active = false;
    g.nextAt = performance.now() + 650 + Math.random() * 850;
    setSamples([...g.samples]);
    setSignal(null);
    setFeedback(`${reaction} ms · Signal received`);
  }

  useEffect(() => {
    if (step !== 1) return;
    const key = (e: KeyboardEvent) => { if (e.code === 'Space') { e.preventDefault(); respond(); } };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [step]);

  const score = summarizeReaction(samples, missed);
  function save() {
    onSave({
      id: crypto.randomUUID(), date: new Date().toISOString(), sol, simulated: quick,
      ...score, sleep, mood, energy, symptoms, notes,
      ...(heartRate ? { heartRate: Number(heartRate) } : {}),
    });
    setStep(3);
  }

  return <div className="modal-overlay"><section className="modal flight-modal" role="dialog" aria-modal="true" aria-labelledby="flight-title" aria-describedby="flight-purpose">
    <header className="flight-header">
    <button className="modal-close icon-button" aria-label="Close flight check" onClick={onClose}><X size={20}/></button>
    <div className="eyebrow">CREW HEALTH CHECK · SOL {String(sol).padStart(3, '0')}</div>
    <h2 id="flight-title" ref={heading} tabIndex={-1}>{step === 0 ? 'Daily crew health check' : step === 1 ? 'Attention task' : step === 2 ? 'How’s the crew feeling?' : 'You’re checked in.'}</h2>
    <p id="flight-purpose" className="flight-purpose">For crew self-assessment and flight surgeon review. Stored on this device.</p>
    <div className="stepper" aria-label="Check-in progress">{['Attention', 'Crew health', 'Review'].map((s, i) => <span key={s} aria-current={Math.min(2, Math.max(0, step - 1)) === i ? 'step' : undefined} className={step > i + 1 ? 'done' : Math.max(0, step - 1) === i ? 'current' : ''}><i>{step > i + 1 && !(i === 0 && !samples.length && !missed) ? <Check size={12}/> : i + 1}</i>{i === 0 && step >= 2 && !samples.length && !missed ? 'Attention skipped' : s}</span>)}</div>
    </header>
    <div className="flight-body" ref={scrollBody} onFocusCapture={e => { if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) e.target.scrollIntoView({ block: 'nearest' }); }} tabIndex={0} role="region" aria-label="Health check content">
    {step === 0 && <div className="flight-intro"><div className="intro-orbit"><Rocket size={42}/><span className="orbit-dot"/></div><p>Compare observations with your own baseline.<br/>Record changes for flight surgeon review.</p><div className="intro-grid"><div><Crosshair size={19}/><strong>60 seconds</strong><span>Respond to docking signals</span></div><div><Heart size={19}/><strong>A little reflection</strong><span>Sleep, mood, energy & symptoms</span></div></div><label className="checkbox-row"><input type="checkbox" checked={quick} onChange={e => { setQuick(e.target.checked); setSeconds(e.target.checked ? 15 : 60); }}/><span>Use a 15-second demo <small>Results will be labelled simulated.</small></span></label><button className="button primary full-width" onClick={() => setStep(1)}>Begin {quick ? 'demo' : 'flight check'} <ArrowRight size={17}/></button><p className="fine-print">Experimental attention task; no medical diagnosis.</p><button className="text-link skip-attention" onClick={() => setStep(2)}>Continue without attention task <ArrowRight size={16}/></button></div>}
    {step === 1 && <><div className="game-stats"><span><Clock3 size={15}/> {Math.ceil(seconds)}s remaining</span><span>{samples.length} received <span className="muted">/ {missed} missed</span></span></div><div className="docking-game"><div className="star-field"/><div className="docking-rings"><i/><i/><i/><Crosshair size={34}/></div><svg className="docking-ship" viewBox="0 0 100 100"><path d="M50 15 65 45 65 70 80 82 60 76 50 84 40 76 20 82 35 70 35 45Z" fill="#d8e9c9" stroke="#a6c197" strokeWidth="1.5"/><path d="M44 41h12v17H44z" fill="#48624f"/><path d="m44 83 6 12 6-12" fill="#c8daae"/></svg>{signal && <button className="docking-signal" style={{ left: `${signal.x}%`, top: `${signal.y}%` }} onClick={respond} aria-label="Respond to docking signal"><Crosshair size={35}/></button>}<div className="game-feedback" aria-live="polite">{feedback}</div></div><div className="progress-track"><div style={{ width: `${(1 - seconds / duration) * 100}%` }}/></div><p className="fine-print">Tap each signal as it appears, or press <kbd>space</kbd>. Stay relaxed; this is a check-in, not a competition.</p><button className="text-link skip-attention" onClick={() => { setSamples([]); setMissed(0); setSignal(null); setStep(2); }}>Skip attention and continue <ArrowRight size={16}/></button></>}
    {step === 2 && <form id="crew-check-form" onSubmit={e => { e.preventDefault(); save(); }}><div className="game-result"><CircleCheck size={21}/><span>{samples.length || missed ? 'Docking check complete' : 'Attention task not recorded'}<strong>{score.reactionMs ? `${score.reactionMs} ms median response` : 'No signals received'} · {missed} missed</strong></span>{quick && <span className="tiny-badge">SIMULATED</span>}</div><div className="wellbeing-form"><div className="ratings-grid">{([{ label: 'Sleep quality', icon: Moon, value: sleep, set: setSleep }, { label: 'Mood', icon: Heart, value: mood, set: setMood }, { label: 'Energy', icon: Zap, value: energy, set: setEnergy }]).map(({ label, icon: Icon, value, set }) => <fieldset className="rating-field" key={label}><legend><Icon size={16}/>{label}<span>{choices[value - 1]}</span></legend><div className="rating-options">{choices.map((choice, i) => <button key={choice} type="button" className={value === i + 1 ? 'selected' : ''} onClick={() => set(i + 1)} aria-label={`${label}: ${label === 'Mood' ? '' : `${i + 1} `}${choice}`} aria-pressed={value === i + 1}><span aria-hidden="true">{label === 'Mood' ? <span className="mood-face">{moodFaces[i]}</span> : i + 1}</span>{' '}<small>{choice}</small></button>)}</div></fieldset>)}</div><fieldset className="symptom-field"><legend>Symptoms reported</legend><div className="symptom-options">{['Fatigue', 'Headache', 'Shoulder discomfort', 'Low back discomfort', 'Stress', 'None'].map(s => <button key={s} type="button" aria-pressed={symptoms.includes(s)} className={symptoms.includes(s) ? 'selected' : ''} onClick={() => setSymptoms(s === 'None' ? ['None'] : symptoms.includes(s) ? symptoms.filter(v => v !== s) : [...symptoms.filter(v => v !== 'None'), s])}>{s}</button>)}</div></fieldset><div className="form-row"><label htmlFor="heart-rate">Heart rate <span className="muted">(optional)</span><div className="input-unit"><input id="heart-rate" aria-label="Heart rate" aria-describedby="heart-rate-unit" inputMode="numeric" type="number" min="25" max="220" value={heartRate} placeholder="e.g. 64" onChange={e => setHeartRate(e.target.value)}/><span id="heart-rate-unit">bpm</span></div></label><label className="flex-1">Crew notes <span className="muted">(optional)</span><textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Anything worth remembering?" maxLength={500}/></label></div></div></form>}
    {step === 3 && <div className="check-success"><div className="success-icon"><Sparkles size={35}/></div><h3>Crew health entry recorded.</h3><p>Your check-in is saved on this device. {quick ? 'This demo result stays separate from your personal records.' : 'Review observations and follow-up actions in your mission overview.'}</p><div className="summary-values"><span><Moon size={17}/> Sleep <strong>{sleep}/5</strong></span><span><Heart size={17}/> Mood <strong>{mood}/5</strong></span><span><Zap size={17}/> Energy <strong>{energy}/5</strong></span></div><button className="button primary full-width" onClick={onClose}>Back to my mission <ArrowLeft size={16}/></button></div>}
    </div>
    {step === 2 && <footer className="flight-footer"><p className="fine-print">Follow mission-approved procedures for health decisions and escalation.</p><button type="submit" form="crew-check-form" className="button primary full-width">Save my check-in <ArrowRight size={17}/></button></footer>}
  </section></div>;
}

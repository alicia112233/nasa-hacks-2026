import { useEffect, useRef, useState } from 'react';
import { Crosshair } from 'lucide-react';
import Dialog from './Dialog';
import { summarizeReaction } from './rules.mjs';

export interface AttentionResult { reactionMs: number | null; missed: number; signals: number }
interface Props { onClose: () => void; onSave: (result: AttentionResult) => void; seconds?: number }

/** 60-second docking-signal task: tap or press Space when the target appears. */
export default function AttentionTask({ onClose, onSave, seconds = 60 }: Props) {
  const [running, setRunning] = useState(false);
  const [left, setLeft] = useState(seconds);
  const [signal, setSignal] = useState<{ x: number; y: number } | null>(null);
  const [counts, setCounts] = useState({ hit: 0, missed: 0 });
  const game = useRef({ shownAt: 0, nextAt: 0, active: false, samples: [] as number[], missed: 0 });
  const done = useRef(false);
  const save = useRef(onSave);
  save.current = onSave;

  useEffect(() => {
    if (!running) return;
    const start = performance.now();
    game.current = { shownAt: 0, nextAt: start + 900, active: false, samples: [], missed: 0 };
    const timer = window.setInterval(() => {
      const now = performance.now();
      const g = game.current;
      setLeft(Math.max(0, seconds - (now - start) / 1000));
      if (now - start >= seconds * 1000) {
        window.clearInterval(timer);
        if (g.active) g.missed++;
        if (!done.current) { done.current = true; save.current(summarizeReaction(g.samples, g.missed)); }
        return;
      }
      if (g.active && now - g.shownAt > 1400) {
        g.active = false; g.missed++; g.nextAt = now + 650 + Math.random() * 850;
        setSignal(null); setCounts({ hit: g.samples.length, missed: g.missed });
      } else if (!g.active && now >= g.nextAt) {
        g.active = true; g.shownAt = now;
        setSignal({ x: 12 + Math.random() * 76, y: 14 + Math.random() * 70 });
      }
    }, 40);
    return () => window.clearInterval(timer);
  }, [running, seconds]);

  function respond() {
    const g = game.current;
    if (!g.active) return;
    g.samples.push(Math.round(performance.now() - g.shownAt));
    g.active = false; g.nextAt = performance.now() + 700 + Math.random() * 1000;
    setSignal(null); setCounts({ hit: g.samples.length, missed: g.missed });
  }

  useEffect(() => {
    if (!running) return;
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Space') { e.preventDefault(); respond(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [running]);

  return <Dialog title="Attention · 60 s" onClose={onClose} label="Stop and discard">
    {!running ? <div className="task-intro">
      <ol className="steps compact"><li><span>Tap the target, or press Space, as soon as it appears.</span></li><li><span>Stopping early saves nothing.</span></li></ol>
      <button className="btn primary" data-autofocus onClick={() => setRunning(true)}>Start</button>
    </div> : <>
      <div className="task-meta" aria-live="off"><span>{Math.ceil(left)} S</span><span>{counts.hit} hit · {counts.missed} missed</span></div>
      <div className="dock" role="application" aria-label="Docking task area">
        {signal && <button className="dock-target" style={{ left: `${signal.x}%`, top: `${signal.y}%` }} onClick={respond} aria-label="Target"><Crosshair size={34}/></button>}
      </div>
      <div className="task-bar"><i style={{ width: `${(1 - left / seconds) * 100}%` }}/></div>
    </>}
  </Dialog>;
}

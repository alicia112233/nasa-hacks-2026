import { useCallback, useEffect, useRef, useState } from 'react';

const PREFERENCE = 'ghostpilot-scan-voice-v1';
const immediate = new Set(['prepare', 'scanning', 'more-frames', 'complete', 'three', 'two', 'one']);

/** Bundled speech only: no remote voice service, microphone or crew data. */
export default function useScanAudio(cue: string, repeat: boolean) {
  const player = useRef<HTMLAudioElement | null>(null);
  const playRun = useRef(0);
  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem(PREFERENCE) === 'muted'; } catch { return false; }
  });
  const enabled = useRef(!muted);
  enabled.current = !muted;
  const [problem, setProblem] = useState<'blocked' | 'unavailable' | null>(null);

  const stop = useCallback(() => { playRun.current++; player.current?.pause(); }, []);
  const play = useCallback((id: string, force = false) => {
    const audio = player.current;
    if (!audio || !enabled.current) return;
    const source = `/audio/scan/${id}.wav`;
    if (!force && audio.getAttribute('src') === source && !audio.paused) return;
    audio.pause();
    audio.src = source;
    const run = ++playRun.current;
    void audio.play().then(() => {
      if (run === playRun.current) setProblem(null);
    }).catch((error: unknown) => {
      if (run !== playRun.current || (error instanceof DOMException && error.name === 'AbortError')) return;
      setProblem(error instanceof DOMException && error.name === 'NotAllowedError' ? 'blocked' : 'unavailable');
    });
  }, []);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.volume = 1;
    player.current = audio;
    return () => { stop(); audio.removeAttribute('src'); audio.load(); player.current = null; };
  }, [stop]);

  useEffect(() => {
    if (muted) { stop(); return; }
    // Ignore momentary pose jitter instead of speaking over each camera frame.
    const delay = immediate.has(cue) ? 0 : 650;
    const timer = setTimeout(() => play(cue), delay);
    const interval = repeat ? setInterval(() => play(cue), 10000) : undefined;
    return () => { clearTimeout(timer); clearInterval(interval); };
  }, [cue, repeat, muted, play, stop]);

  const toggle = () => {
    const next = !muted;
    enabled.current = !next;
    setMuted(next);
    try { localStorage.setItem(PREFERENCE, next ? 'muted' : 'on'); } catch { /* Session controls still work. */ }
    if (next) stop(); else play(cue, true);
  };
  return { muted, toggle, repeat: () => play(cue, true), problem };
}

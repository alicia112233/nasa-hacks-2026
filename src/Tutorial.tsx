import { useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Play, X } from 'lucide-react';
import type { Page } from './types';

export const TUTORIAL_STORAGE_KEY = 'ghostpilot-tutorial-v1';
export function hasSeenTutorial() {
  try { return localStorage.getItem(TUTORIAL_STORAGE_KEY) === 'seen'; } catch { return false; }
}
export function rememberTutorial() {
  try { localStorage.setItem(TUTORIAL_STORAGE_KEY, 'seen'); } catch { /* Session controls still work. */ }
}

/** The challenge loop the tour walks through, in order. */
export const TOUR_PHASES = ['Spot', 'Check', 'Compare', 'Act'] as const;
/** A step with a goal advances when its control is used; a `look` step points at something to read and advances with Next. */
export type TourStep = { target: string | null; phase: number | null; page: Page; title: string; body: string; goal?: string; look?: boolean };
export type TourContext = { letter: string; label: string; state: string; check: string; checkState: 'flag' | 'reported' | 'none'; metric: string };

/**
 * One reading followed from spotting a change to acting on it, built from what is on screen for this crew member:
 * the region that stands out, a check inside it, and that check's trend.
 */
export function buildTour(c: TourContext): TourStep[] {
  const spot = c.state === 'flag' ? `Red means something in ${c.label} needs attention: a reading off your ghost, or a symptom you reported. Hatching means not measured yet.`
    : 'Nothing needs attention yet. Red will mark a reading off your ghost or a symptom you report; hatching means not measured yet.';
  const why = c.checkState !== 'none' ? `${c.check} is one reason ${c.label} is red. ` : '';
  return [
    { target: null, phase: null, page: 'body', title: 'Your first check, start to finish', body: 'GhostPilot compares you with your ghost: your own readings from earlier in the mission. Follow one reading from spotting a change to telling the medical team. About a minute; nothing is saved.' },
    { target: 'spot', phase: 0, page: 'body', title: c.state === 'clear' ? 'Pick a region' : 'Spot what changed', body: spot, goal: `Tap ${c.label}.` },
    { target: 'check', phase: 1, page: 'body', title: 'Learn the check', body: `${why}Every check opens with how to take it and why it matters.`, goal: `Tap ${c.check}.` },
    { target: 'trends', phase: 2, page: 'body', title: 'Is it getting worse?', body: 'One reading can be noise. Trends plots every reading against your ghost.', goal: 'Tap Trends.' },
    { target: 'trend-chart', phase: 2, page: 'trends', look: true, title: 'Read the trend', body: `This is ${c.metric} over the mission. The dashed line is your ghost. Several readings in a row away from it make a trend; one odd point does not.` },
    { target: 'report', phase: 3, page: 'trends', title: 'Act on it', body: 'Every check lands in today’s report. Hand it off to the medical team once, at the end of the day.', goal: 'Tap Report.' },
  ];
}

interface Props {
  step: number;
  steps: TourStep[];
  onPrepare: (step: number) => void;
  onAdvance: () => void;
  onBack: () => void;
  onClose: () => void;
}
type Rect = { left: number; top: number; width: number; height: number; viewportWidth: number; viewportHeight: number };
const controls = 'button, a[href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])';

/** A tour of the real controls. Only the current goal and the guide remain interactive. */
export default function Tutorial(props: Props) {
  const { step, steps } = props;
  const callbacks = useRef(props);
  callbacks.current = props;
  const panel = useRef<HTMLElement>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [panelSize, setPanelSize] = useState({ width: 380, height: 310 });
  const [complete, setComplete] = useState(false);
  const current = steps[step];
  const last = steps.length - 1;
  const look = !!current.look;

  useLayoutEffect(() => { callbacks.current.onPrepare(step); }, [step]);
  useLayoutEffect(() => {
    const element = panel.current;
    if (!element) return;
    const resize = new ResizeObserver(() => setPanelSize({ width: element.offsetWidth, height: element.offsetHeight }));
    resize.observe(element);
    return () => resize.disconnect();
  }, []);

  useLayoutEffect(() => {
    let target: HTMLElement | null = null;
    let previousDescription: string | null = null;
    let advanceTimer: ReturnType<typeof setTimeout> | undefined;
    let acted = false;
    let needsFocus = complete || !current.target;
    const changed = new Map<HTMLElement, boolean>();
    const selector = current.target ? `[data-tour="${current.target}"]` : null;
    const visible = (element: HTMLElement) => element.getClientRects().length > 0 && !element.closest('[hidden]');
    const measure = () => {
      if (!target || complete) { setRect(null); return; }
      const box = target.getBoundingClientRect();
      const next = { left: Math.max(4, box.left - 5), top: Math.max(4, box.top - 5), width: Math.min(box.width + 10, innerWidth - 8), height: Math.min(box.height + 10, innerHeight - 8), viewportWidth: innerWidth, viewportHeight: innerHeight };
      setRect(old => old && Object.keys(next).every(key => old[key as keyof Rect] === next[key as keyof Rect]) ? old : next);
    };
    const focusGoal = () => {
      const destination = complete ? panel.current?.querySelector<HTMLElement>('[data-tour-finish]') : look ? panel.current?.querySelector<HTMLElement>('[data-tour-next]') : target ?? panel.current?.querySelector<HTMLElement>('[data-tour-start]');
      (destination ?? panel.current?.querySelector<HTMLElement>('button'))?.focus({ preventScroll: !complete && !!target });
    };
    const find = () => {
      const found = complete || !selector ? null : document.querySelector<HTMLElement>(selector);
      if (found && visible(found) && target !== found) {
        target = found;
        needsFocus = true;
        previousDescription = target.getAttribute('aria-describedby');
        if (!look) target.setAttribute('aria-describedby', [previousDescription, 'tour-instruction'].filter(Boolean).join(' '));
        target.scrollIntoView({ block: innerWidth <= 640 ? 'start' : 'center', inline: 'nearest', behavior: 'instant' });
      }
      for (const element of document.querySelectorAll<HTMLElement>(controls)) {
        if (panel.current?.contains(element) || (!complete && target && (element === target || target.contains(element) || element.contains(target)))) {
          if (changed.has(element)) { element.inert = changed.get(element)!; changed.delete(element); }
          continue;
        }
        if (!changed.has(element)) { changed.set(element, element.inert); element.inert = true; }
      }
      if (target && changed.has(target)) { target.inert = changed.get(target)!; changed.delete(target); }
      measure();
      if (needsFocus && !acted) { needsFocus = false; focusGoal(); }
    };
    const onClick = (event: MouseEvent) => {
      const source = event.target;
      if (!(source instanceof Node)) return;
      if (panel.current?.contains(source)) return;
      if (!complete && !look && target?.contains(source)) {
        if (!acted) {
          acted = true;
          advanceTimer = setTimeout(() => {
            if (step === last) setComplete(true);
            else callbacks.current.onAdvance();
          }, 0);
        }
        return;
      }
      event.preventDefault(); event.stopImmediatePropagation();
    };
    const onFocus = (event: FocusEvent) => {
      const source = event.target;
      if (source instanceof Node && !panel.current?.contains(source) && (complete || look || !target?.contains(source))) focusGoal();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopImmediatePropagation(); callbacks.current.onClose(); return;
      }
      if (event.key === 'Tab') {
        event.preventDefault(); event.stopImmediatePropagation();
        const items = [!complete && !look ? target : null, ...Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled)') ?? [])].filter((item): item is HTMLElement => !!item && visible(item) && !item.inert);
        if (!items.length) return;
        const at = items.indexOf(document.activeElement as HTMLElement);
        items[(at + (event.shiftKey ? -1 : 1) + items.length) % items.length].focus();
      }
    };
    const observer = new MutationObserver(find);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('click', onClick, true);
    document.addEventListener('focusin', onFocus, true);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    find();
    return () => {
      observer.disconnect(); clearTimeout(advanceTimer);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('focusin', onFocus, true);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
      for (const [element, wasInert] of changed) element.inert = wasInert;
      if (target) {
        if (previousDescription == null) target.removeAttribute('aria-describedby');
        else target.setAttribute('aria-describedby', previousDescription);
      }
    };
  }, [step, complete, current.target, last, look]);

  let left = 12, top = 12;
  const width = panelSize.width, height = panelSize.height;
  const sideRoom = rect && (rect.left >= width + 26 || rect.viewportWidth - rect.left - rect.width >= width + 26);
  const maxHeight = rect && !sideRoom ? Math.max(52, Math.min(470, Math.max(rect.top - 26, rect.viewportHeight - rect.top - rect.height - 26))) : undefined;
  if (rect) {
    const gap = 14, vw = rect.viewportWidth, vh = rect.viewportHeight;
    left = Math.max(12, Math.min(vw - width - 12, rect.left + rect.width / 2 - width / 2));
    if (rect.top + rect.height + gap + height <= vh - 12) top = rect.top + rect.height + gap;
    else if (rect.top - gap - height >= 12) top = rect.top - gap - height;
    else if (rect.left + rect.width + gap + width <= vw - 12) { left = rect.left + rect.width + gap; top = Math.max(12, Math.min(vh - height - 12, rect.top)); }
    else if (rect.left - gap - width >= 12) { left = rect.left - gap - width; top = Math.max(12, Math.min(vh - height - 12, rect.top)); }
    else { left = Math.max(12, vw - width - 12); top = rect.top < vh / 2 ? vh - height - 12 : 12; }
  } else {
    left = Math.max(12, (innerWidth - width) / 2); top = Math.max(12, (innerHeight - height) / 2);
  }
  const intro = !current.target && !complete;
  const phase = complete ? TOUR_PHASES.length : current.phase ?? -1;
  return <>
    {rect ? <div className="tour-masks" aria-hidden="true">
      <div className="tour-mask" style={{ inset: '0 0 auto', height: rect.top }}/>
      <div className="tour-mask" style={{ top: rect.top, left: 0, width: rect.left, height: rect.height }}/>
      <div className="tour-mask" style={{ top: rect.top, left: rect.left + rect.width, right: 0, height: rect.height }}/>
      <div className="tour-mask" style={{ top: rect.top + rect.height, left: 0, right: 0, bottom: 0 }}/>
      <div className="tour-spotlight" style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}/>
    </div> : <div className="tour-mask tour-cover" aria-hidden="true"/>}
    <section ref={panel} className={`tour-coach ${intro || complete ? 'centered' : ''}`} role="dialog" aria-modal="false" aria-labelledby="tour-title" style={{ left, top, maxHeight }}>
      <header className="tour-head"><h2 id="tour-title">Tutorial</h2><button className="icon-btn" aria-label="Close tutorial" onClick={props.onClose}><X size={18}/></button></header>
      <div className="tour-content">
        <ol className="tour-phases" aria-label="Tutorial progress">
          {TOUR_PHASES.map((name, index) => <li key={name} aria-current={index === phase ? 'step' : undefined} className={index < phase ? 'complete' : ''}><i aria-hidden="true"/>{name}</li>)}
        </ol>
        <span className="sr">{complete ? 'Tutorial complete' : intro ? 'Introduction' : `Step ${step} of ${last}`}</span>
        <h3>{complete ? 'That’s the loop' : current.title}</h3>
        <p>{complete ? 'Spot, check, compare, act. Each day, start on Today: fill both rings, then hand off the report.' : current.body}</p>
        {complete && <p className="tour-aside">Switch crew member or edit your profile from your name, top right.</p>}
        {current.goal && !complete && <p className="tour-goal" id="tour-instruction"><span className="tour-goal-box" aria-hidden="true"/>{current.goal}</p>}
        <div className="tour-actions">
          {intro ? <button className="btn primary" data-tour-start onClick={props.onAdvance}><Play size={16} aria-hidden="true"/>Start</button>
            : complete ? <button className="btn primary" data-tour-finish onClick={props.onClose}><Check size={16} aria-hidden="true"/>Finish</button>
            : <button className="btn" onClick={() => { setComplete(false); props.onBack(); }}><ArrowLeft size={16} aria-hidden="true"/>Back</button>}
          {look && !complete && <button className="btn primary" data-tour-next onClick={props.onAdvance}>Next<ArrowRight size={16} aria-hidden="true"/></button>}
          {!complete && <button className="link" onClick={props.onClose}>Skip tutorial</button>}
        </div>
      </div>
    </section>
  </>;
}

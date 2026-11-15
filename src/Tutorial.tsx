import { useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Siren, X } from 'lucide-react';
import type { Page } from './types';

export const TUTORIAL_STORAGE_KEY = 'ghostpilot-tutorial-v1';
export function hasSeenTutorial() {
  try { return localStorage.getItem(TUTORIAL_STORAGE_KEY) === 'seen'; } catch { return false; }
}
export function rememberTutorial() {
  try { localStorage.setItem(TUTORIAL_STORAGE_KEY, 'seen'); } catch { /* Session controls still work. */ }
}

export const tourSteps: { target: string; title: string; instruction: string; note: string; page: Page }[] = [
  { target: 'crew', title: 'Open your crew menu', instruction: 'Click the highlighted crew name or initials in the top bar.', note: 'This identifies whose body, checks and handoffs you are viewing.', page: 'body' },
  { target: 'profile', title: 'Find your profile', instruction: 'Click Edit profile in the crew menu.', note: 'You can update your details or choose the optional Scan me here. This tour will not edit them.', page: 'body' },
  { target: 'profile-done', title: 'Return to the body', instruction: 'Look over your profile, then click Done.', note: 'Your profile stays as it is. Demo data is synthetic; personal records are separate.', page: 'body' },
  { target: 'chest', title: 'Choose a body region', instruction: 'Click C Chest in the lettered body-region list.', note: 'Each region opens its own checks. Hatching means it has not been measured.', page: 'body' },
  { target: 'heart-check', title: 'Open a check', instruction: 'Click the Heart rate row to open its instructions.', note: 'Read How and Why before measuring. We will only open the check, without entering or saving a result.', page: 'body' },
  { target: 'trends', title: 'Open your trends', instruction: 'Click Trends in the top navigation.', note: 'The check you opened explains how to measure. Trends helps you understand your readings against your ghost.', page: 'body' },
  { target: 'heart-trend', title: 'Choose a measurement', instruction: 'Click Heart rate in the Trends table.', note: 'Your ghost is a fixed reference from earlier readings. Missing or mismatched readings stay visible; prototype signals are not a diagnosis.', page: 'trends' },
  { target: 'handoff', title: 'Find the next action', instruction: 'Click Handoff in the top navigation.', note: 'Use result guidance to retake, plan a follow-up or prepare a handoff for the medical team.', page: 'trends' },
  { target: 'observation', title: 'Start with an observation', instruction: 'Click the Observation for medical team field.', note: 'A handoff also needs the procedure, next check and time, and remaining gaps. Files save locally; the app does not transmit them.', page: 'handoff' },
];

interface Props {
  step: number;
  onPrepare: (step: number) => void;
  onAdvance: () => void;
  onBack: () => void;
  onClose: () => void;
  onEmergency: () => void;
}
type Rect = { left: number; top: number; width: number; height: number; viewportWidth: number; viewportHeight: number };
const controls = 'button, a[href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])';

/** A tour of the real controls. Only the current goal and the guide remain interactive. */
export default function Tutorial(props: Props) {
  const { step } = props;
  const callbacks = useRef(props);
  callbacks.current = props;
  const panel = useRef<HTMLElement>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [panelSize, setPanelSize] = useState({ width: 380, height: 310 });
  const [complete, setComplete] = useState(false);
  const current = tourSteps[step];

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
    let needsFocus = complete;
    const changed = new Map<HTMLElement, boolean>();
    const selector = `[data-tour="${current.target}"]`;
    const visible = (element: HTMLElement) => element.getClientRects().length > 0 && !element.closest('[hidden]');
    const measure = () => {
      if (!target || complete) { setRect(null); return; }
      const box = target.getBoundingClientRect();
      const next = { left: Math.max(4, box.left - 5), top: Math.max(4, box.top - 5), width: Math.min(box.width + 10, innerWidth - 8), height: Math.min(box.height + 10, innerHeight - 8), viewportWidth: innerWidth, viewportHeight: innerHeight };
      setRect(old => old && Object.keys(next).every(key => old[key as keyof Rect] === next[key as keyof Rect]) ? old : next);
    };
    const focusGoal = () => {
      const destination = complete ? panel.current?.querySelector<HTMLElement>('[data-tour-finish]') : target;
      (destination ?? panel.current?.querySelector<HTMLElement>('button'))?.focus({ preventScroll: !complete });
    };
    const find = () => {
      const found = complete ? null : document.querySelector<HTMLElement>(selector);
      if (found && visible(found) && target !== found) {
        target = found;
        needsFocus = true;
        previousDescription = target.getAttribute('aria-describedby');
        target.setAttribute('aria-describedby', [previousDescription, 'tour-instruction'].filter(Boolean).join(' '));
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
      if (!complete && target?.contains(source)) {
        if (!acted) {
          acted = true;
          advanceTimer = setTimeout(() => {
            if (step === tourSteps.length - 1) setComplete(true);
            else callbacks.current.onAdvance();
          }, 0);
        }
        return;
      }
      event.preventDefault(); event.stopImmediatePropagation();
    };
    const onFocus = (event: FocusEvent) => {
      const source = event.target;
      if (source instanceof Node && !panel.current?.contains(source) && (complete || !target?.contains(source))) focusGoal();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopImmediatePropagation(); callbacks.current.onClose(); return;
      }
      if (event.key === 'Tab') {
        event.preventDefault(); event.stopImmediatePropagation();
        const items = [!complete ? target : null, ...Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled)') ?? [])].filter((item): item is HTMLElement => !!item && visible(item) && !item.inert);
        if (!items.length) return;
        const at = items.indexOf(document.activeElement as HTMLElement);
        items[(at + (event.shiftKey ? -1 : 1) + items.length) % items.length].focus();
      } else if (document.activeElement === target && target instanceof HTMLTextAreaElement) {
        event.preventDefault(); event.stopImmediatePropagation();
        if (event.key === 'Enter' || event.key === ' ') target.click();
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
  }, [step, complete, current.target]);

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
  } else if (complete) {
    left = Math.max(12, (innerWidth - width) / 2); top = Math.max(12, (innerHeight - height) / 2);
  }
  return <>
    {rect ? <div className="tour-masks" aria-hidden="true">
      <div className="tour-mask" style={{ inset: '0 0 auto', height: rect.top }}/>
      <div className="tour-mask" style={{ top: rect.top, left: 0, width: rect.left, height: rect.height }}/>
      <div className="tour-mask" style={{ top: rect.top, left: rect.left + rect.width, right: 0, height: rect.height }}/>
      <div className="tour-mask" style={{ top: rect.top + rect.height, left: 0, right: 0, bottom: 0 }}/>
      <div className="tour-spotlight" style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}/>
    </div> : <div className="tour-mask tour-cover" aria-hidden="true"/>}
    <section ref={panel} className="tour-coach" role="dialog" aria-modal="false" aria-labelledby="tour-title" style={{ left, top, maxHeight }}>
      <header className="tour-head"><h2 id="tour-title">Interactive tutorial</h2><button className="icon-btn" aria-label="Close tutorial" onClick={props.onClose}><X size={18}/></button></header>
      <div className="tour-content">
        <div className="tutorial-progress"><span>Step {step + 1} of {tourSteps.length}</span><ol aria-label="Tutorial progress">{tourSteps.map((item, index) => <li key={item.target} aria-current={index === step ? 'step' : undefined} className={index < step || complete ? 'complete' : ''}><span aria-hidden="true">{index + 1}</span><span className="sr">{item.title}</span></li>)}</ol></div>
        <h3>{complete ? 'You’re ready' : current.title}</h3>
        <p id="tour-instruction">{complete ? 'You found the key controls. No health readings or handoffs were saved by this tour.' : current.instruction}</p>
        <p className="tutorial-note">{complete ? 'Replay anytime with Tutorial in the top bar. Your previous page will be restored.' : current.note}</p>
        {!complete && <p className="tour-goal"><span className="tour-goal-box" aria-hidden="true"/>Click the highlighted control to continue.</p>}
        <div className="tour-actions">
          <button className="btn" disabled={step === 0} onClick={() => { setComplete(false); props.onBack(); }}><ArrowLeft size={16} aria-hidden="true"/>Back</button>
          {complete ? <button className="btn primary" data-tour-finish onClick={props.onClose}><Check size={16} aria-hidden="true"/>Finish</button> : <button className="link" onClick={props.onClose}>Skip tutorial</button>}
        </div>
        <button className="btn tour-emergency" onClick={props.onEmergency}><Siren size={16} aria-hidden="true"/>Emergency</button>
      </div>
    </section>
  </>;
}

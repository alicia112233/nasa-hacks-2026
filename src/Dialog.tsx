import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface Props { title: string; onClose: () => void; children: ReactNode; wide?: boolean; fullScreen?: boolean; modal?: boolean; label?: string }

/** Modal dialog with focus containment, Escape, and focus restoration. */
export default function Dialog({ title, onClose, children, wide, fullScreen, modal = true, label }: Props) {
  const ref = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    const focusTimer = modal ? setTimeout(() => (ref.current?.querySelector<HTMLElement>('[data-autofocus]') ?? ref.current?.querySelector<HTMLElement>('button, input, select, textarea'))?.focus(), 20) : undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close.current(); }
      if (e.key !== 'Tab' || !ref.current || !modal) return;
      const items = Array.from(ref.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select, textarea, a[href], video[controls], [tabindex="0"]')).filter(el => el.getClientRects().length);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (!ref.current.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => { clearTimeout(focusTimer); window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; previous?.focus?.(); };
  }, [modal]);
  return <div className={`overlay ${fullScreen ? 'fullscreen-overlay' : ''}`} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <section ref={ref} className={`dialog ${wide ? 'wide' : ''} ${fullScreen ? 'fullscreen-dialog' : ''}`} role="dialog" aria-modal={modal || undefined} aria-labelledby="dialog-title">
      <header className="dialog-head"><h2 id="dialog-title">{title}</h2><button className="icon-btn" aria-label={label ?? 'Close'} onClick={onClose}><X size={20}/></button></header>
      <div className="dialog-body">{children}</div>
    </section>
  </div>;
}

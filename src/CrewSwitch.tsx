import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Pencil, UserPlus } from 'lucide-react';
import { formatDate } from './data';
import type { Profile } from './types';

interface Props {
  crew: Profile[];
  active: Profile;
  onSwitch: (id: string) => void;
  onEdit: () => void;
  onAdd: () => void;
  guidedOpen?: boolean;
}

/**
 * Who the app is showing, on the right of the top bar on every page: initials and name. It opens the crew list (switch
 * member), Edit profile and Add crew member. A disclosure, not a menu: Tab moves through it, Escape or leaving closes it.
 * Initials stand in for a face: GhostPilot keeps no photos.
 */
export default function CrewSwitch({ crew, active, onSwitch, onEdit, onAdd, guidedOpen }: Props) {
  const [localOpen, setOpen] = useState(false);
  const open = guidedOpen ?? localOpen;
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLElement>('.crew-menu [aria-current="true"]')?.focus();
    const onDown = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    const onLeave = (e: FocusEvent) => { if (e.relatedTarget && !root.current?.contains(e.relatedTarget as Node)) setOpen(false); };
    const node = root.current;
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    node?.addEventListener('focusout', onLeave);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); node?.removeEventListener('focusout', onLeave); };
  }, [open]);

  const pick = (action: () => void) => { setOpen(false); action(); trigger.current?.focus(); };

  return <div className="crew-switch" ref={root}>
    <button ref={trigger} data-tour="crew" className="crew-switch-btn" aria-expanded={open} aria-controls="crew-menu" onClick={() => { if (guidedOpen == null) setOpen(o => !o); }}>
      <b aria-hidden="true">{active.initials || '—'}</b>
      <span className="crew-switch-name">{active.name}</span>
      <span className="sr">, crew member: switch or edit</span>
      <ChevronDown size={16} aria-hidden="true"/>
    </button>
    {open && <div id="crew-menu" className="crew-menu">
      <ul aria-label="Crew">
        {crew.map(c => <li key={c.id}>
          <button aria-current={c.id === active.id ? 'true' : undefined} onClick={() => pick(() => onSwitch(c.id!))}>
            <b aria-hidden="true">{c.initials || '—'}</b>
            <span><strong>{c.name}</strong><small>{c.scan ? `Scanned ${formatDate(c.scan.date)}` : 'Not scanned'}</small></span>
            {c.id === active.id && <Check size={18} aria-hidden="true"/>}
          </button>
        </li>)}
      </ul>
      <button data-tour="profile" className="crew-menu-action" onClick={() => pick(onEdit)}><Pencil size={16} aria-hidden="true"/> Edit profile</button>
      <button className="crew-menu-action" onClick={() => pick(onAdd)}><UserPlus size={16} aria-hidden="true"/> Add crew member</button>
    </div>}
  </div>;
}

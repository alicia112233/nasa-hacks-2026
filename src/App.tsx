import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { CircleCheck, WifiOff, X } from 'lucide-react';
import BodyView, { type RegionState } from './BodyView';
import { physique, zeroGForSol } from './physique.mjs';
import ProcedureCard from './ProcedureCard';
import AttentionTask, { type AttentionResult } from './AttentionTask';
import Dialog from './Dialog';
import TrendsView from './TrendsView';
import HandoffView from './HandoffView';
import MissionView from './MissionView';
import { clearPersonalRecords, createDemo, formatDate, loadMission, loadRecordings, saveMission, saveRecording } from './data';
import { analyze } from './rules.mjs';
import { dayKey, regions, regionStatuses } from './body.mjs';
import type { CheckIn, FollowUp, MissionPacket, MissionState, Page, Profile, Recording, RegionId } from './types';

const Capture = lazy(() => import('./Capture'));
const MovementViewer = lazy(() => import('./MovementViewer'));

const pages: { id: Page; label: string }[] = [
  { id: 'body', label: 'Body' },
  { id: 'trends', label: 'Trends' },
  { id: 'handoff', label: 'Handoff' },
  { id: 'mission', label: 'Mission' },
];
const pageFromHash = () => pages.find(p => p.id === location.hash.slice(1))?.id ?? 'body';
type Modal = null | 'attention' | 'capture' | 'movement';

export default function App() {
  const [mission, setMission] = useState<MissionState>(createDemo);
  const [loaded, setLoaded] = useState(false);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [page, setPage] = useState<Page>(pageFromHash);
  const [region, setRegion] = useState<RegionId | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [delay, setDelay] = useState(14);
  const [toast, setToast] = useState('');
  const [preflight, setPreflight] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const simulated = mission.demo;
  const analysis = useMemo(() => analyze(mission.checkIns, simulated), [mission.checkIns, simulated]);
  const statuses = useMemo(() => regionStatuses(mission.checkIns, simulated), [mission.checkIns, simulated]);
  const sol = Math.max(mission.profile.startDate ? Math.floor((Date.now() - new Date(mission.profile.startDate).getTime()) / 86400000) + 1 : 1, ...mission.checkIns.map(c => c.sol));
  const firstFlag = (regions.find(r => statuses[r.id].state === 'flag') ?? regions.find(r => statuses[r.id].state === 'reported') ?? regions[0]).id as RegionId;
  const selected = region ?? firstFlag;
  const selectedRegion = regions.find(r => r.id === selected)!;
  const latestRecording = simulated ? undefined : recordings.at(-1);
  const shape = useMemo(() => physique(mission.profile, preflight ? 0 : zeroGForSol(sol)), [mission.profile, preflight, sol]);

  function notify(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 4000);
  }

  useEffect(() => {
    let on = true;
    Promise.all([loadMission(), loadRecordings()]).then(([saved, videos]) => {
      if (!on) return;
      if (saved) setMission(saved);
      setRecordings(videos);
      setLoaded(true);
    }).catch(() => { if (on) { setLoaded(true); notify('Device storage unavailable. Changes may not survive a reload.'); } });
    const up = () => setOnline(navigator.onLine);
    const onHash = () => setPage(pageFromHash());
    window.addEventListener('online', up); window.addEventListener('offline', up); window.addEventListener('hashchange', onHash);
    return () => { on = false; window.removeEventListener('online', up); window.removeEventListener('offline', up); window.removeEventListener('hashchange', onHash); };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    saveMission(mission).catch(() => notify('Could not save. Check device storage.'));
  }, [mission, loaded]);

  function go(next: Page) { setPage(next); history.replaceState(null, '', `#${next}`); window.scrollTo({ top: 0 }); }
  function openRegion(id: RegionId) { setRegion(id); go('body'); }

  /** Write one result into today's entry for the data source on screen (demo or personal). */
  function record(values: Partial<CheckIn>, source = simulated) {
    setMission(old => {
      const now = new Date().toISOString();
      const index = old.checkIns.findIndex(c => c.simulated === source && dayKey(c.date) === dayKey(now));
      if (index >= 0) return { ...old, checkIns: old.checkIns.map((c, i) => i === index ? { ...c, ...values } : c) };
      const entry: CheckIn = { id: crypto.randomUUID(), date: now, sol, simulated: source, reactionMs: null, missed: 0, signals: 0, symptoms: [], notes: '', ...values };
      return { ...old, checkIns: [...old.checkIns, entry] };
    });
  }

  function saveAttention(result: AttentionResult) {
    setModal(null);
    if (!result.signals) { notify('No signals answered. Nothing saved.'); return; }
    record(result);
    notify(`Attention saved · ${result.reactionMs ?? '—'} ms median.`);
  }

  async function saveCapture(rec: Recording) {
    await saveRecording(rec);
    setRecordings(old => [...old, rec]);
    record({ leftRange: rec.leftRange ?? undefined, rightRange: rec.rightRange ?? undefined }, false);
    notify(simulated ? 'Movement saved to your records (not the demo).' : 'Movement and video saved on this device.');
  }

  async function savePacket(packet: MissionPacket) {
    const next = { ...mission, packets: [...(mission.packets ?? []), packet] };
    await saveMission(next);
    setMission(next);
    notify('Handoff saved on board. Not transmitted.');
  }

  async function clearPersonal() {
    const next: MissionState = {
      ...mission,
      profile: createDemo().profile,
      checkIns: mission.checkIns.filter(c => c.simulated),
      actions: [],
      packets: [],
    };
    await clearPersonalRecords(next);
    setRecordings([]);
    setMission(next);
    notify('Personal records, videos and profile cleared.');
  }

  if (!loaded) return <div className="boot" role="status">GHOSTPILOT</div>;

  return <div className="shell">
    <a className="skip" href="#main">Skip to content</a>
    <header className="bar" inert={!!modal}>
      <span className="brand">GHOSTPILOT</span>
      <nav aria-label="Main">{pages.map(p => <a key={p.id} href={`#${p.id}`} aria-current={page === p.id ? 'page' : undefined} onClick={e => { e.preventDefault(); go(p.id); }}>{p.label}</a>)}</nav>
      <span className="bar-meta">
        {simulated && <button className="demo-tag" onClick={() => go('mission')}>Demo data</button>}
        <span>SOL {String(sol).padStart(3, '0')}</span>
        <span className="hide-sm">{delay} MIN ONE WAY</span>
        {!online && <span className="offline"><WifiOff size={14}/> Offline</span>}
      </span>
    </header>

    <main id="main" tabIndex={-1} inert={!!modal}>
      <h1 className="sr">{page === 'body' ? 'Body check' : pages.find(p => p.id === page)!.label}</h1>
      {page === 'body' && <div className="body-page">
        <section className="index" aria-labelledby="index-title">
          <h2 id="index-title" className="sr">Crew body index</h2>
          <BodyView selected={selected} states={statuses as Record<string, { state: RegionState }>} onSelect={setRegion} shape={shape}>
            <div className="seg stage-seg" role="group" aria-label="Body shown">
              <button aria-pressed={preflight} onClick={() => setPreflight(true)}>Preflight <span>{shape.preflightCm} cm</span></button>
              <button aria-pressed={!preflight} onClick={() => setPreflight(false)}>Sol {sol} <span>{physique(mission.profile, zeroGForSol(sol)).statureCm} cm</span></button>
            </div>
          </BodyView>
          <ul className="region-list" aria-label="Body regions">
            {regions.map(r => <li key={r.id}><button aria-pressed={selected === r.id} className={statuses[r.id].state} onClick={() => setRegion(r.id as RegionId)}>
              <b>{r.letter}</b>{r.label}{(statuses[r.id].state === 'flag' || statuses[r.id].state === 'reported') && <span className="sr"> · {statuses[r.id].state === 'flag' ? 'trend' : 'reported'}</span>}
            </button></li>)}
          </ul>
          <p className="key" aria-hidden="true"><span><i className="k-flag"/>Trend</span><span><i className="k-rep"/>Reported</span><span><i className="k-done"/>Done today</span><span><i className="k-hatch"/>Not measured</span></p>
        </section>
        <ProcedureCard key={selected} region={selectedRegion as never} status={statuses[selected] as never} analysis={analysis as never} simulated={simulated} actions={mission.actions.filter(a => a.simulated === simulated)}
          onSave={(field, value) => { record({ [field]: value }); notify('Saved.'); }}
          onAttention={() => setModal('attention')} onCapture={() => setModal('capture')} onMovement={() => setModal('movement')}
          onFollowUp={(a: FollowUp) => { setMission(old => ({ ...old, actions: [...old.actions, a] })); notify(`Follow-up set for ${formatDate(a.scheduledAt)}.`); }}/>
      </div>}
      {page === 'trends' && <TrendsView checkIns={mission.checkIns} simulated={simulated}/>}
      {page === 'handoff' && <HandoffView mission={mission} recordings={recordings} sol={sol} delay={delay} setDelay={setDelay} onSavePacket={savePacket}
        onDownloaded={id => setMission(old => ({ ...old, packets: (old.packets ?? []).map(p => p.id === id ? { ...p, status: 'downloaded', downloadedAt: new Date().toISOString() } : p) }))}
        onComplete={a => setMission(old => ({ ...old, actions: old.actions.map(x => x.id === a.id ? { ...x, status: 'complete' } : x) }))}/>}
      {page === 'mission' && <MissionView mission={mission} onOpenRegion={openRegion}
        onProfile={(patch: Partial<Profile>) => { setMission(old => ({ ...old, profile: { ...old.profile, ...patch, initials: (patch.name ?? old.profile.name).split(/\s+/).map(s => s[0]).join('').slice(0, 2).toUpperCase() } })); notify('Saved.'); }}
        onSource={demo => { setMission(old => ({ ...old, demo })); setRegion(null); notify(demo ? 'Showing demo data.' : 'Showing your records.'); }}
        onReloadDemo={() => { const demo = createDemo(); setMission(old => ({ ...old, demo: true, checkIns: [...old.checkIns.filter(c => !c.simulated), ...demo.checkIns] })); notify('Demo history reloaded. Your records are untouched.'); }}
        onClear={clearPersonal}/>}
      <footer className="foot">Prototype · not a diagnosis · records stay on this device</footer>
    </main>

    {modal === 'attention' && <AttentionTask onClose={() => setModal(null)} onSave={saveAttention}/>}
    {modal === 'capture' && <Suspense fallback={null}><Capture onClose={() => setModal(null)} onSave={saveCapture} sol={sol}/></Suspense>}
    {modal === 'movement' && <Dialog title="Movement" wide onClose={() => setModal(null)}>
      <Suspense fallback={<p role="status">Loading…</p>}>
        <MovementViewer active onRecord={() => setModal('capture')} onEvidence={() => setModal(null)} simulated={!latestRecording && simulated} sol={latestRecording?.sol ?? sol}
          frames={latestRecording?.frames} leftRange={latestRecording?.leftRange ?? analysis.current.leftRange ?? 134} baselineRange={analysis.baseline.leftRange ?? 152} hasBaseline={analysis.baseline.leftRange != null}/>
      </Suspense>
    </Dialog>}
    {toast && <div className="toast" role="status"><CircleCheck size={18}/><span>{toast}</span><button aria-label="Dismiss" onClick={() => setToast('')}><X size={16}/></button></div>}
  </div>;
}

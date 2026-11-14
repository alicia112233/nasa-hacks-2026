import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { CircleCheck, ScanLine, WifiOff, X } from 'lucide-react';
import BodyView, { type RegionState } from './BodyView';
import { physique, zeroGForSol } from './physique.mjs';
import { thighCm } from './scan.mjs';
import type { ScanMode } from './BodyScan';
import ProcedureCard from './ProcedureCard';
import CrewCard from './CrewCard';
import CrewSwitch from './CrewSwitch';
import { addCrew, normalise, recordingsFor, removeCrew, scoped, switchCrew, withProfile } from './crew';
import AttentionTask, { type AttentionResult } from './AttentionTask';
import Dialog from './Dialog';
import TrendsView from './TrendsView';
import HandoffView from './HandoffView';
import MissionView from './MissionView';
import { clearPersonalRecords, createDemo, formatDate, loadMission, loadRecordings, saveMission, saveRecording } from './data';
import { analyze } from './rules.mjs';
import { dayKey, regions, regionStatuses } from './body.mjs';
import type { BodyScan as Scan, CheckIn, FollowUp, MissionPacket, MissionState, Page, Profile, Recording, RegionId } from './types';

const Capture = lazy(() => import('./Capture'));
const MovementViewer = lazy(() => import('./MovementViewer'));
const BodyScan = lazy(() => import('./BodyScan'));

const pages: { id: Page; label: string }[] = [
  { id: 'body', label: 'Body' },
  { id: 'trends', label: 'Trends' },
  { id: 'handoff', label: 'Handoff' },
  { id: 'mission', label: 'Mission' },
];
const pageFromHash = () => pages.find(p => p.id === location.hash.slice(1))?.id ?? 'body';
type Modal = null | 'attention' | 'capture' | 'movement' | 'scan-setup' | 'scan-legs';

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
  /** The crew card replaces the region card when the name plate on the body is open. */
  const [crewOpen, setCrewOpen] = useState(false);
  /** A just-added member opens with their name field ready to type. */
  const [naming, setNaming] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const simulated = mission.demo;
  /** The selected crew member's records only; every page reads this. */
  const view = useMemo(() => scoped(mission), [mission]);
  const analysis = useMemo(() => analyze(view.checkIns, simulated), [view.checkIns, simulated]);
  // Camera checks always save to personal records, so the leg scan compares with the personal ghost.
  const personalGhostCm = useMemo(() => analyze(view.checkIns, false).baseline.thighCm, [view.checkIns]);
  const statuses = useMemo(() => regionStatuses(view.checkIns, simulated), [view.checkIns, simulated]);
  const sol = Math.max(mission.profile.startDate ? Math.floor((Date.now() - new Date(mission.profile.startDate).getTime()) / 86400000) + 1 : 1, ...view.checkIns.map(c => c.sol));
  const firstFlag = (regions.find(r => statuses[r.id].state === 'flag') ?? regions.find(r => statuses[r.id].state === 'reported') ?? regions[0]).id as RegionId;
  const selected = region ?? firstFlag;
  const selectedRegion = regions.find(r => r.id === selected)!;
  const crewRecordings = useMemo(() => recordingsFor(mission, recordings), [mission, recordings]);
  const latestRecording = simulated ? undefined : crewRecordings.at(-1);
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
      if (saved) setMission(normalise(saved));
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
  /** On stacked (narrow) layouts the card sits below the body, so bring it into view after a pick. */
  function revealCard() {
    if (!matchMedia('(max-width: 900px)').matches) return;
    requestAnimationFrame(() => {
      const card = document.querySelector('.body-page > .card');
      if (card && card.getBoundingClientRect().top > innerHeight * 0.6) card.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    });
  }
  function pickRegion(id: RegionId) { setRegion(id); setCrewOpen(false); revealCard(); }
  function openRegion(id: RegionId) { pickRegion(id); go('body'); }

  /** Write one result into today's entry for the data source on screen (demo or personal). */
  function record(values: Partial<CheckIn>, source = simulated) {
    setMission(old => {
      const now = new Date().toISOString();
      const index = old.checkIns.findIndex(c => c.simulated === source && c.crewId === old.crewId && dayKey(c.date) === dayKey(now));
      if (index >= 0) return { ...old, checkIns: old.checkIns.map((c, i) => i === index ? { ...c, ...values } : c) };
      const entry: CheckIn = { id: crypto.randomUUID(), crewId: old.crewId, date: now, sol, simulated: source, reactionMs: null, missed: 0, signals: 0, symptoms: [], notes: '', ...values };
      return { ...old, checkIns: [...old.checkIns, entry] };
    });
  }

  function saveAttention(result: AttentionResult) {
    setModal(null);
    if (!result.signals) { notify('No signals answered. Nothing saved.'); return; }
    record(result);
    notify(`Attention saved · ${result.reactionMs ?? '—'} ms median.`);
  }

  async function saveCapture(capture: Recording) {
    const rec = { ...capture, crewId: mission.crewId };
    await saveRecording(rec);
    setRecordings(old => [...old, rec]);
    record({ leftRange: rec.leftRange ?? undefined, rightRange: rec.rightRange ?? undefined }, false);
    notify(simulated ? 'Movement saved to your records (not the demo).' : 'Movement and video saved on this device.');
  }

  /** One scan, two uses: the thigh breadth joins today's record (the Legs check), and a setup scan also shapes the body. */
  function saveScan(mode: ScanMode, scan: Scan, choice: { sex?: Profile['sex']; build?: Profile['build'] }) {
    setModal(null);
    const cm = thighCm(scan, mission.profile.heightCm);
    if (cm != null) record({ thighCm: cm }, false);
    // A setup scan is the source of truth for the body: its weight estimate replaces a typed mass.
    if (mode === 'setup') setMission(old => withProfile(old, { scan, massKg: undefined, sex: choice.sex ?? old.profile.sex, build: choice.build ?? old.profile.build }));
    notify(mode === 'setup' ? 'Body scan saved. The body now has your shape.' : simulated ? 'Leg outline saved to your records (not the demo).' : `Leg outline saved · ${cm} cm.`);
  }

  function saveProfile(patch: Partial<Profile>) {
    setMission(old => withProfile(old, patch));
    // Height turns today's setup scan into the first leg measurement.
    const scan = mission.profile.scan;
    if (patch.heightCm && scan && dayKey(scan.date) === dayKey(new Date().toISOString())) {
      const cm = thighCm(scan, patch.heightCm);
      if (cm != null) record({ thighCm: cm }, false);
    }
    notify('Saved.');
  }

  function pickCrew(id: string) {
    const next = switchCrew(mission, id);
    setMission(next);
    setRegion(null);
    notify(`Showing ${next.profile.name}.`);
  }

  function addMember() {
    const next = addCrew(mission);
    setMission(next);
    setNaming(next.crewId ?? null);
    setRegion(null);
    setCrewOpen(true);
    go('body');
    notify('Crew member added. Name them, then Scan me.');
  }

  function removeMember() {
    const name = mission.profile.name;
    setMission(old => removeCrew(old, old.crewId!));
    setCrewOpen(false);
    setRegion(null);
    notify(`${name} and their records were removed from this device.`);
  }

  async function savePacket(packet: MissionPacket) {
    const next = { ...mission, packets: [...(mission.packets ?? []), { ...packet, crewId: mission.crewId }] };
    await saveMission(next);
    setMission(next);
    notify('Handoff saved on board. Not transmitted.');
  }

  async function clearPersonal() {
    const next: MissionState = {
      ...mission,
      profile: createDemo().profile,
      crew: createDemo().crew,
      crewId: createDemo().crewId,
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
        {!online && <span className="offline"><WifiOff size={14}/> Offline</span>}
        <CrewSwitch crew={mission.crew ?? [mission.profile]} active={mission.profile} onSwitch={pickCrew} onAdd={addMember} onEdit={() => { go('body'); setCrewOpen(true); revealCard(); }}/>
      </span>
    </header>

    <main id="main" tabIndex={-1} inert={!!modal}>
      <h1 className="sr">{page === 'body' ? 'Body check' : pages.find(p => p.id === page)!.label}</h1>
      {page === 'body' && <div className="body-page">
        <section className="index" aria-labelledby="index-title">
          <h2 id="index-title" className="sr">Crew body index</h2>
          {/* Its own row above the stage, so it never covers a region tag. */}
          <div className="crew-bar">
            {/* The one scan button: one tap from the body to the camera. */}
            <button className="stage-scan" onClick={() => { setCrewOpen(true); setModal('scan-setup'); }}><ScanLine size={16}/> {mission.profile.scan ? 'Rescan' : 'Scan me'}</button>
          </div>
          <BodyView selected={crewOpen ? null : selected} states={statuses as Record<string, { state: RegionState }>} onSelect={pickRegion} shape={shape}>
            <div className="seg stage-seg" role="group" aria-label="Body shown">
              <button aria-pressed={preflight} onClick={() => setPreflight(true)}>Preflight <span>{shape.preflightCm} cm</span></button>
              <button aria-pressed={!preflight} onClick={() => setPreflight(false)}>Sol {sol} <span>{physique(mission.profile, zeroGForSol(sol)).statureCm} cm</span></button>
            </div>
          </BodyView>
          <ul className="region-list" aria-label="Body regions">
            {regions.map(r => <li key={r.id}><button aria-pressed={!crewOpen && selected === r.id} className={statuses[r.id].state} onClick={() => pickRegion(r.id as RegionId)}>
              <b>{r.letter}</b>{r.label}{(statuses[r.id].state === 'flag' || statuses[r.id].state === 'reported') && <span className="sr"> · {statuses[r.id].state === 'flag' ? 'trend' : 'reported'}</span>}
            </button></li>)}
          </ul>
          <p className="key" aria-hidden="true"><span><i className="k-flag"/>Trend</span><span><i className="k-rep"/>Reported</span><span><i className="k-done"/>Done today</span><span><i className="k-hatch"/>Not measured</span></p>
        </section>
        {crewOpen ? <CrewCard key={mission.crewId} profile={mission.profile} editName={naming === mission.crewId} onNamed={() => setNaming(null)} canRemove={(mission.crew?.length ?? 1) > 1} onRemove={removeMember} onProfile={saveProfile} onLegs={() => pickRegion('legs')}/>
        : <ProcedureCard key={selected} region={selectedRegion as never} status={statuses[selected] as never} analysis={analysis as never} simulated={simulated} actions={view.actions.filter(a => a.simulated === simulated)}
          onSave={(field, value) => { record({ [field]: value }); notify('Saved.'); }}
          onAttention={() => setModal('attention')} onCamera={id => setModal(id === 'legs' ? 'scan-legs' : 'capture')} onMovement={() => setModal('movement')}
          onFollowUp={(a: FollowUp) => { setMission(old => ({ ...old, actions: [...old.actions, { ...a, crewId: old.crewId }] })); notify(`Follow-up set for ${formatDate(a.scheduledAt)}.`); }}/>}
      </div>}
      {page === 'trends' && <TrendsView checkIns={view.checkIns} simulated={simulated}/>}
      {page === 'handoff' && <HandoffView mission={view} recordings={crewRecordings} sol={sol} delay={delay} setDelay={setDelay} onSavePacket={savePacket}
        onDownloaded={id => setMission(old => ({ ...old, packets: (old.packets ?? []).map(p => p.id === id ? { ...p, status: 'downloaded', downloadedAt: new Date().toISOString() } : p) }))}
        onComplete={a => setMission(old => ({ ...old, actions: old.actions.map(x => x.id === a.id ? { ...x, status: 'complete' } : x) }))}/>}
      {page === 'mission' && <MissionView mission={view} onOpenRegion={openRegion}
        onSource={demo => { setMission(old => ({ ...old, demo })); setRegion(null); notify(demo ? 'Showing demo data.' : 'Showing your records.'); }}
        onReloadDemo={() => { const demo = createDemo(); setMission(old => ({ ...old, demo: true, crew: [...(old.crew ?? []), ...demo.crew!.filter(d => !old.crew?.some(c => c.id === d.id))], checkIns: [...old.checkIns.filter(c => !c.simulated), ...demo.checkIns] })); notify('Demo history reloaded. Your records are untouched.'); }}
        onClear={clearPersonal}/>}
      <footer className="foot">Prototype · not a diagnosis · records stay on this device</footer>
    </main>

    {modal === 'attention' && <AttentionTask onClose={() => setModal(null)} onSave={saveAttention}/>}
    {modal === 'capture' && <Suspense fallback={null}><Capture onClose={() => setModal(null)} onSave={saveCapture} sol={sol}/></Suspense>}
    {(modal === 'scan-setup' || modal === 'scan-legs') && <Suspense fallback={null}>
      <BodyScan mode={modal === 'scan-setup' ? 'setup' : 'legs'} profile={mission.profile} ghostCm={personalGhostCm} onClose={() => setModal(null)}
        onSave={(scan, choice) => saveScan(modal === 'scan-setup' ? 'setup' : 'legs', scan, choice)}/>
    </Suspense>}
    {modal === 'movement' && <Dialog title="Movement" wide onClose={() => setModal(null)}>
      <Suspense fallback={<p role="status">Loading…</p>}>
        <MovementViewer active onRecord={() => setModal('capture')} onEvidence={() => setModal(null)} simulated={!latestRecording && simulated} sol={latestRecording?.sol ?? sol}
          frames={latestRecording?.frames} leftRange={latestRecording?.leftRange ?? analysis.current.leftRange ?? 134} baselineRange={analysis.baseline.leftRange ?? 152} hasBaseline={analysis.baseline.leftRange != null}/>
      </Suspense>
    </Dialog>}
    {toast && <div className="toast" role="status"><CircleCheck size={18}/><span>{toast}</span><button aria-label="Dismiss" onClick={() => setToast('')}><X size={16}/></button></div>}
  </div>;
}

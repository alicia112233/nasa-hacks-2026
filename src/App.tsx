import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, CircleCheck, ScanLine, WifiOff, X } from 'lucide-react';
import Tutorial, { buildTour, hasSeenTutorial, rememberTutorial } from './Tutorial';
import TodayPanel, { type DaySummary, type Recommendation } from './TodayPanel';
import { daySummary, nextRegion } from './today.mjs';
import ReferencePanel from './ReferencePanel';
import CabinReview from './CabinReview';
import { defaultContext } from './references.mjs';
import { crewHeadaches } from './daily.mjs';
import BodyView, { type RegionState } from './BodyView';
import { physique, zeroGForSol } from './physique.mjs';
import { thighCm } from './scan.mjs';
import ProcedureCard from './ProcedureCard';
import CrewCard from './CrewCard';
import CrewSwitch from './CrewSwitch';
import { addCrew, normalise, recordingsFor, removeCrew, scoped, switchCrew, withProfile } from './crew';
import { addScan, deleteScan as withoutScan, scanHistory, scanId } from './scan-history.mjs';
import { clearScanClips, deleteScanClips, saveScanClip } from './scan-clips';
import AttentionTask, { type AttentionResult } from './AttentionTask';
import Dialog from './Dialog';
import TrendsView, { trendMetrics } from './TrendsView';
import ReportView from './ReportView';
import MissionView from './MissionView';
import { clearPersonalRecords, createDemo, formatDate, loadMission, loadRecordings, saveMission, saveRecording } from './data';
import { analyze } from './rules.mjs';
import { dayKey, regions, regionStatuses } from './body.mjs';
import type { BodyScan as Scan, CareUpdate, CheckIn, MeasurementContext, MissionPacket, MissionState, Page, Profile, Recording, RegionId } from './types';

const Capture = lazy(() => import('./Capture'));
const MovementViewer = lazy(() => import('./MovementViewer'));
const BodyScan = lazy(() => import('./BodyScan'));

const pages: { id: Page; label: string }[] = [
  { id: 'body', label: 'Body' },
  { id: 'trends', label: 'Trends' },
  { id: 'report', label: 'Report' },
  { id: 'mission', label: 'Mission' },
];
/** #handoff is the Report page's old address. */
const pageFromHash = () => location.hash === '#handoff' ? 'report' : pages.find(p => p.id === location.hash.slice(1))?.id ?? 'body';
type Modal = null | 'profile' | 'attention' | 'capture' | 'movement' | 'scan';

export default function App() {
  const [mission, setMission] = useState<MissionState>(createDemo);
  const [loaded, setLoaded] = useState(false);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [page, setPage] = useState<Page>(pageFromHash);
  const [region, setRegion] = useState<RegionId | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [tutorialStep, setTutorialStep] = useState<number | null>(() => hasSeenTutorial() ? null : 0);
  const tutorialOrigin = useRef({ page, region, requestedCheck: null as { id: string; nonce: number } | null });
  const tutorialButton = useRef<HTMLButtonElement>(null);
  const scanOpener = useRef<HTMLElement | null>(null);
  const [requestedCheck, setRequestedCheck] = useState<{ id: string; nonce: number } | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [delay, setDelay] = useState(14);
  const [toast, setToast] = useState('');
  const [preflight, setPreflight] = useState(false);
  /** A just-added member opens with their name field ready to type. */
  const [naming, setNaming] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const simulated = mission.demo;
  /** The selected crew member's records only; every page reads this. */
  const view = useMemo(() => scoped(mission), [mission]);
  const analysis = useMemo(() => analyze(view.checkIns, simulated, view.references), [view.checkIns, simulated, view.references]);
  // Camera checks always save to personal records, so the leg scan compares with the personal ghost.
  const personalGhostCm = useMemo(() => { const a = analyze(view.checkIns, false, view.references); return a.comparisons.thighCm.comparable ? a.baseline.thighCm : null; }, [view.checkIns, view.references]);
  const statuses = useMemo(() => regionStatuses(view.checkIns, simulated, undefined, view.references), [view.checkIns, simulated, view.references]);
  const sharedHeadaches = crewHeadaches(mission.checkIns, simulated);
  const sol = Math.max(mission.profile.startDate ? Math.floor((Date.now() - new Date(mission.profile.startDate).getTime()) / 86400000) + 1 : 1, ...view.checkIns.map(c => c.sol));
  const firstFlag = (regions.find(r => statuses[r.id].state === 'flag') ?? regions[0]).id as RegionId;
  // No region picked means the Today view: the day's rings and the next step, not a region card.
  const selectedRegion = region ? regions.find(r => r.id === region)! : null;
  const summary = useMemo(() => daySummary(statuses, analysis.baseline), [statuses, analysis]);
  const crewRecordings = useMemo(() => recordingsFor(mission, recordings).sort((a, b) => a.date.localeCompare(b.date)), [mission, recordings]);
  const latestRecording = simulated ? undefined : crewRecordings.at(-1);
  const shape = useMemo(() => physique(mission.profile, preflight ? 0 : zeroGForSol(sol)), [mission.profile, preflight, sol]);
  /** The tour follows what stands out for this crew member: the first flagged region, one check in it and that check's trend. */
  const tour = useMemo(() => {
    type TourItem = { check: { id: string; title: string; kind: string; field?: string }; flagged: boolean; reported: boolean };
    const target = regions.find(r => r.id === firstFlag)!;
    const items = (statuses[firstFlag] as unknown as { items: TourItem[] }).items;
    const item = items.find(i => i.flagged && i.check.kind !== 'task') ?? items.find(i => i.reported)
      ?? items.find(i => ['scale', 'symptom', 'number'].includes(i.check.kind)) ?? items.find(i => i.check.kind !== 'task') ?? items[0];
    const metric = trendMetrics.find(m => m.key === item.check.field) ?? trendMetrics[0];
    const state = statuses[firstFlag].state;
    return { region: firstFlag, check: item.check.id, metric: metric.key, steps: buildTour({ letter: target.letter, label: target.label,
      state: state === 'flag' || state === 'reported' ? state : 'clear', check: item.check.title, checkState: item.flagged ? 'flag' : item.reported ? 'reported' : 'none', metric: metric.label }) };
  }, [firstFlag, statuses]);

  function notify(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 4000);
  }

  useEffect(() => {
    let on = true;
    Promise.all([loadMission(), loadRecordings()]).then(([saved, videos]) => {
      if (!on) return;
      if (saved) {
        const restored = normalise(saved);
        setMission(restored);
      }
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
  function closeTutorial() {
    rememberTutorial();
    setTutorialStep(null);
    setModal(null);
    go(tutorialOrigin.current.page);
    setRegion(tutorialOrigin.current.region);
    setRequestedCheck(tutorialOrigin.current.requestedCheck);
    requestAnimationFrame(() => tutorialButton.current?.focus());
  }
  function startTutorial() {
    tutorialOrigin.current = { page, region, requestedCheck };
    setTutorialStep(0);
  }
  function prepareTutorial(step: number) {
    go(tour.steps[step].page);
    setModal(null);
    // Back re-creates each goal's starting point: the region shown, and its check closed until the tour asks for it.
    if (step === 1) { setRegion(null); setRequestedCheck(null); }
    if (step === 2) { setRegion(tour.region); setRequestedCheck(null); }
    if (step === 3) { setRegion(tour.region); setRequestedCheck({ id: tour.check, nonce: Date.now() }); }
  }
  function openScan() {
    const active = document.activeElement;
    // A profile's Scan me button disappears when that dialog is replaced.
    scanOpener.current = active instanceof HTMLElement && !active.closest('.dialog') ? active : document.querySelector<HTMLElement>('.crew-switch-btn');
    setModal('scan');
  }
  function closeScan() {
    setModal(null);
    requestAnimationFrame(() => scanOpener.current?.focus());
  }
  /** On stacked (narrow) layouts the card sits below the body, so bring it into view after a pick. */
  function revealCard() {
    if (!matchMedia('(max-width: 900px)').matches) return;
    requestAnimationFrame(() => {
      const card = document.querySelector('.body-page .card');
      if (card && card.getBoundingClientRect().top > innerHeight * 0.6) card.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    });
  }
  function pickRegion(id: RegionId) { setRegion(id); revealCard(); }
  function openRegion(id: RegionId) { pickRegion(id); go('body'); }

  function startRecommended(r: Recommendation & { region: RegionId }) {
    const source = ['shoulder', 'legs'].includes(r.checkId) ? false : simulated;
    const now = new Date().toISOString();
    setMission(old => ({ ...old, checkRuns: [...(old.checkRuns ?? []).map(run => !run.completedAt && !run.abandonedAt && run.crewId === old.crewId ? { ...run, abandonedAt: now } : run), { id: crypto.randomUUID(), crewId: old.crewId, simulated: source, checkId: r.checkId, field: r.field, reason: r.reason, startedAt: now }] }));
    openRegion(r.region); setRequestedCheck({ id: r.checkId, nonce: Date.now() });
    // Start means start: the attention task and both camera checks open straight away.
    if (r.checkId === 'attention') setModal('attention');
    else if (r.checkId === 'legs') openScan();
    else if (r.checkId === 'shoulder') setModal('capture');
  }

  /** Write one result into today's entry for the data source on screen (demo or personal). */
  function record(values: Partial<CheckIn>, source = simulated, quality: Record<string, Partial<MeasurementContext>> = {}) {
    setMission(old => {
      const now = new Date().toISOString();
      const measurements = Object.fromEntries(Object.keys(values).filter(k => k !== 'measurements').map(k => [k, { ...(old.profile.recordingContext ?? defaultContext), measuredAt: now, quality: 'good', ...quality[k] }])) as Record<string, MeasurementContext>;
      const checkRuns = (old.checkRuns ?? []).map(run => run.crewId === old.crewId && run.simulated === source && !run.completedAt && !run.abandonedAt && typeof values[run.field as keyof CheckIn] === 'number' && measurements[run.field]?.quality === 'good' ? { ...run, completedAt: now } : run);
      const index = old.checkIns.findIndex(c => c.simulated === source && c.crewId === old.crewId && dayKey(c.date) === dayKey(now));
      if (index >= 0) return { ...old, checkRuns, checkIns: old.checkIns.map((c, i) => i === index ? { ...c, ...values, measurements: { ...c.measurements, ...measurements } } : c) };
      const entry: CheckIn = { id: crypto.randomUUID(), crewId: old.crewId, date: now, sol, simulated: source, reactionMs: null, missed: 0, signals: 0, symptoms: [], notes: '', ...values, measurements };
      return { ...old, checkRuns, checkIns: [...old.checkIns, entry] };
    });
  }

  function saveAttention(result: AttentionResult) {
    setModal(null);
    if (!result.signals) { notify('No signals answered. Nothing saved.'); return; }
    record(result);
    notify(`Attention saved · ${result.reactionMs ?? '—'} ms median.`);
  }

  async function saveCapture(capture: Recording) {
    const rec: Recording = { ...capture, crewId: mission.crewId, conditions: { ...(mission.profile.recordingContext ?? defaultContext), measuredAt: capture.date, quality: capture.leftRange == null ? 'poor' : 'good', confidentFrames: capture.confidentFrames?.left, recordingId: capture.id } };
    await saveRecording(rec);
    setRecordings(old => [...old, rec]);
    record({ leftRange: rec.leftRange ?? undefined, rightRange: rec.rightRange ?? undefined }, false, { leftRange: { quality: rec.leftRange == null ? 'poor' : 'good', confidentFrames: rec.confidentFrames?.left, recordingId: rec.id }, rightRange: { quality: rec.rightRange == null ? 'poor' : 'good', confidentFrames: rec.confidentFrames?.right, recordingId: rec.id } });
    notify('Movement and video saved.');
  }

  /** One scan, two uses: it shapes the body, and its thigh breadth joins today's record (the Legs check). Every scan joins the history. */
  function saveScan(scan: Scan, choice: { sex?: Profile['sex']; build?: Profile['build'] }, clip: { blob: Blob; seconds: number; aspect: number } | null) {
    closeScan();
    const cm = thighCm(scan, mission.profile.heightCm);
    // The reading carries the scan's capture time, which links it to the scan in the history.
    if (cm != null) record({ thighCm: cm }, false, { thighCm: { measuredAt: scan.date, quality: scan.frames >= 8 && (scan.spread?.thighs ?? 1) <= .08 ? 'good' : 'poor', confidentFrames: scan.frames, spread: scan.spread?.thighs } });
    const saved: Scan = { ...scan, id: crypto.randomUUID(), mode: 'setup' };
    // The recorded seconds stay with the scan, so the history can replay them.
    if (clip) saveScanClip({ id: saved.id!, crewId: mission.crewId, ...clip }).catch(() => notify('Scan saved, but its clip could not be stored.'));
    // A typed mass is kept: a scale reading beats the outline's heavier/lighter guess.
    setMission(old => withProfile(old, { ...addScan(old.profile, saved), sex: choice.sex ?? old.profile.sex, build: choice.build ?? old.profile.build }));
    notify(cm != null ? `Body scan saved · thigh ${cm} cm.` : 'Body scan saved.');
  }

  function saveProfile(patch: Partial<Profile>) {
    setMission(old => withProfile(old, patch));
    // Height turns today's setup scan into the first leg measurement.
    const scan = mission.profile.scan;
    if (patch.heightCm && scan && dayKey(scan.date) === dayKey(new Date().toISOString())) {
      const cm = thighCm(scan, patch.heightCm);
      if (cm != null) record({ thighCm: cm }, false, { thighCm: { measuredAt: scan.date } });
    }
    notify('Saved.');
  }

  function deleteScan(id: string) {
    setMission(old => { const next = withoutScan(old.profile, old.checkIns, old.crewId, id); return { ...withProfile(old, next.profile), checkIns: next.checkIns }; });
    void deleteScanClips([id]).catch(() => {});
    notify('Scan deleted.');
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
    setModal('profile');
    notify('Crew member added. Name them, then Scan me.');
  }

  function removeMember() {
    const name = mission.profile.name;
    void deleteScanClips(scanHistory(mission.profile).map(scanId)).catch(() => {});
    setMission(old => removeCrew(old, old.crewId!));
    setModal(null);
    setRegion(null);
    notify(`${name} and their records were removed from this device.`);
  }

  async function savePacket(packet: MissionPacket) {
    const next = { ...mission, packets: [...(mission.packets ?? []), { ...packet, crewId: mission.crewId }] };
    await saveMission(next);
    setMission(next);
    notify('Report handed off. Saved on this device.');
  }

  async function saveCareUpdate(event: CareUpdate) {
    const packet = mission.packets?.find(p => p.id === event.packetId && p.crewId === event.crewId && p.source === event.source);
    if (!packet || event.crewId !== mission.crewId || event.source !== (simulated ? 'simulated' : 'recorded')) throw new Error('This reassessment belongs to a different crew member or data source.');
    const next = { ...mission, careUpdates: [...(mission.careUpdates ?? []), event] };
    await saveMission(next); setMission(next); notify('Reassessment added.');
  }

  async function clearPersonal() {
    const next: MissionState = {
      ...mission,
      profile: createDemo().profile,
      crew: createDemo().crew,
      crewId: createDemo().crewId,
      checkIns: mission.checkIns.filter(c => c.simulated),
      actions: [],
      packets: [], careUpdates: [],
      references: mission.references?.filter(r => r.simulated), cabinReadings: mission.cabinReadings?.filter(r => r.source === 'simulated'), checkRuns: [],
    };
    await clearPersonalRecords(next);
    await clearScanClips().catch(() => {});
    setRecordings([]);
    setMission(next);
    notify('Personal records, videos and profile cleared.');
  }

  if (!loaded) return <div className="boot" role="status">GHOSTPILOT</div>;

  return <div className="shell">
    <a className="skip" href="#main">Skip to content</a>
    <header className="bar" inert={!!modal}>
      <span className="brand">GHOSTPILOT</span>
      <nav aria-label="Main">{pages.map(p => <a key={p.id} data-tour={p.id} href={`#${p.id}`} aria-current={page === p.id ? 'page' : undefined} onClick={e => { e.preventDefault(); go(p.id); }}>{p.label}</a>)}</nav>
      <span className="bar-meta">
        <button ref={tutorialButton} className="tutorial-entry" onClick={startTutorial}><BookOpen size={17} aria-hidden="true"/>Tutorial</button>
        <span>SOL {String(sol).padStart(3, '0')}</span>
        {!online && <span className="offline"><WifiOff size={14}/> Offline</span>}
        <CrewSwitch crew={mission.crew ?? [mission.profile]} active={mission.profile} onSwitch={pickCrew} onAdd={addMember} onEdit={() => setModal('profile')}/>
      </span>
    </header>

    <main id="main" tabIndex={-1} inert={!!modal}>
      <h1 className="sr">{page === 'body' ? 'Body check' : pages.find(p => p.id === page)!.label}</h1>
      {page === 'body' && <div className={`body-page ${selectedRegion ? '' : 'today-first'}`}>
        <section className="index" aria-labelledby="index-title">
          <h2 id="index-title" className="sr">Crew body index</h2>
          {/* Its own row above the stage, so it never covers a region tag. */}
          <div className="crew-bar">
            {/* The one scan button: one tap from the body to the camera. */}
            <button className="stage-scan" onClick={() => openScan()}><ScanLine size={16}/> {mission.profile.scan ? 'Rescan' : 'Scan me'}</button>
            {/* Says whose shape the figure has: fitted to this crew member's scan, or still the standard model. */}
            <span className="figure-source">{mission.profile.scan ? `Figure fitted to scan · ${formatDate(mission.profile.scan.date)}` : 'Standard figure · not scanned'}</span>
          </div>
          <BodyView selected={region} states={statuses as Record<string, { state: RegionState }>} onSelect={pickRegion} shape={shape}>
            <div className="seg stage-seg" role="group" aria-label="Body shown">
              <button aria-pressed={preflight} onClick={() => setPreflight(true)}>Preflight <span>{shape.preflightCm} cm</span></button>
              <button aria-pressed={!preflight} onClick={() => setPreflight(false)}>Sol {sol} <span>{physique(mission.profile, zeroGForSol(sol)).statureCm} cm</span></button>
            </div>
          </BodyView>
          <ul className="region-list" aria-label="Body regions">
            {regions.map(r => <li key={r.id}><button data-tour={r.id === tour.region ? 'spot' : undefined} aria-pressed={region === r.id} className={statuses[r.id].state} onClick={() => pickRegion(r.id as RegionId)}>
              <b>{r.letter}</b>{r.label}{statuses[r.id].state === 'flag' && <span className="sr"> · alert</span>}
            </button></li>)}
          </ul>
          <p className="key" aria-hidden="true"><span><i className="k-flag"/>Alert</span><span><i className="k-done"/>Done today</span><span><i className="k-hatch"/>Not measured</span></p>
        </section>
        <div className="procedure-stack">
        {!selectedRegion ? <TodayPanel mission={view} summary={summary as unknown as DaySummary} sol={sol} headaches={sharedHeadaches.length} onStart={startRecommended} onCabin={() => openRegion('cabin')} onReport={() => go('report')}/> : <>
        <button className="back-today" onClick={() => setRegion(null)}><ArrowLeft size={16} aria-hidden="true"/> Today</button>
        <ProcedureCard key={`${mission.crewId}-${selectedRegion.id}-${tutorialStep === 2 ? 'tour-check' : ''}`} region={selectedRegion as never} status={statuses[selectedRegion.id] as never} analysis={analysis as never} requestedCheck={tutorialStep === 2 ? null : requestedCheck} tourCheck={tutorialStep == null ? undefined : tour.check}
          cabinContent={selectedRegion.id === 'cabin' ? <CabinReview mission={mission} onSave={reading => { setMission(old => ({ ...old, cabinReadings: [...(old.cabinReadings ?? []), reading] })); notify('Cabin observation saved.'); }}/> : undefined}
          onSave={(field, value) => { record({ [field]: value }); notify('Saved.'); }}
          onAttention={() => setModal('attention')} onCamera={id => id === 'legs' ? openScan() : setModal('capture')} onMovement={() => setModal('movement')}
          onHandoff={() => go('report')} nextRegion={nextRegion(statuses, selectedRegion.id) as never} onRegion={id => pickRegion(id)}/>
        </>}
        </div>
      </div>}
      {(page === 'trends' || (tutorialStep != null && tutorialOrigin.current.page === 'trends')) && <div hidden={page !== 'trends'} className="trends-page">
        <ReferencePanel key={mission.crewId} mission={view} onContext={recordingContext => setMission(old => withProfile(old, { recordingContext }))} onReference={ref => { setMission(old => ({ ...old, references: [...(old.references ?? []), ref] })); notify('Ghost set for this phase. Earlier ghosts are kept.'); }}/>
        <TrendsView checkIns={view.checkIns} simulated={simulated} references={view.references} tourMetric={tutorialStep == null ? undefined : tour.metric}/></div>}
      {(page === 'report' || (tutorialStep != null && tutorialOrigin.current.page === 'report')) && <div hidden={page !== 'report'}><ReportView key={`${mission.crewId}-${simulated}`} mission={view} summary={summary as never} recordings={crewRecordings} sol={sol} delay={delay} setDelay={setDelay} onSavePacket={savePacket} onSaveCareUpdate={saveCareUpdate}
        onDownloaded={id => setMission(old => ({ ...old, packets: (old.packets ?? []).map(p => p.id === id ? { ...p, status: 'downloaded', downloadedAt: new Date().toISOString() } : p) }))}/></div>}
      {page === 'mission' && <MissionView mission={view} onOpenRegion={openRegion}
        onSource={demo => { setMission(old => ({ ...old, demo })); setRegion(null); notify(demo ? 'Showing built-in records.' : 'Showing your records.'); }}
        onReloadDemo={() => { const demo = createDemo(); setMission(old => ({ ...old, demo: true, crew: [...(old.crew ?? []), ...demo.crew!.filter(d => !old.crew?.some(c => c.id === d.id))], checkIns: [...old.checkIns.filter(c => !c.simulated), ...demo.checkIns], references: [...(old.references ?? []).filter(r => !r.simulated), ...demo.references!], cabinReadings: [...(old.cabinReadings ?? []).filter(r => r.source !== 'simulated'), ...demo.cabinReadings!] })); notify('Built-in history reloaded. Your records are untouched.'); }}
        onClear={clearPersonal}/>}
    </main>

    {tutorialStep != null && <Tutorial step={tutorialStep} steps={tour.steps} onPrepare={prepareTutorial} onAdvance={() => setTutorialStep(step => step == null ? null : Math.min(step + 1, tour.steps.length - 1))} onBack={() => setTutorialStep(step => step == null ? null : Math.max(step - 1, 0))} onClose={closeTutorial}/>}
    {modal === 'profile' && <Dialog title="Edit profile" onClose={() => setModal(null)}>
      <CrewCard key={mission.crewId} profile={mission.profile} checkIns={mission.checkIns} onDeleteScan={deleteScan} editName={naming === mission.crewId} onNamed={() => setNaming(null)} canRemove={(mission.crew?.length ?? 1) > 1} onRemove={removeMember} onProfile={saveProfile}
        onClose={() => setModal(null)} onScan={() => openScan()} onLegs={() => { setModal(null); openRegion('legs'); }}/>
    </Dialog>}
    {modal === 'attention' && <AttentionTask onClose={() => setModal(null)} onSave={saveAttention}/>}
    {modal === 'capture' && <Suspense fallback={null}><Capture onClose={() => setModal(null)} onSave={saveCapture} sol={sol}/></Suspense>}
    {modal === 'scan' && <Suspense fallback={null}>
      <BodyScan profile={mission.profile} ghostCm={personalGhostCm} onClose={closeScan} onSave={saveScan}/>
    </Suspense>}
    {modal === 'movement' && <Dialog title="Movement" wide onClose={() => setModal(null)}>
      {!analysis.comparisons.leftRange.comparable && <p className="comparison-note">Comparison unavailable. {analysis.comparisons.leftRange.reason}</p>}
      <Suspense fallback={<p role="status">Loading…</p>}>
        <MovementViewer active recordings={crewRecordings} references={view.references} onRecord={() => setModal('capture')} onEvidence={() => setModal(null)} simulated={!latestRecording && simulated} sol={latestRecording?.sol ?? sol}
          frames={latestRecording?.frames} leftRange={latestRecording?.leftRange ?? analysis.current.leftRange ?? 0} baselineRange={analysis.baseline.leftRange ?? 0} hasBaseline={analysis.comparisons.leftRange.comparable}/>
      </Suspense>
    </Dialog>}
    {toast && <div className="toast" role="status"><CircleCheck size={18}/><span>{toast}</span><button aria-label="Dismiss" onClick={() => setToast('')}><X size={16}/></button></div>}
  </div>;
}

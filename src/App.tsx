import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ArrowRight, ArrowUpRight, Bell, BookOpen, CalendarDays, Camera, Check, CheckCheck, ChevronDown, ChevronRight, CircleCheck, ClipboardList, Clock3, Download, Eye, FileText, FlaskConical, Ghost, HelpCircle, LayoutDashboard, Leaf, Menu, Moon, Move3d, Orbit, Radio, Rocket, Settings2, ShieldCheck, Sparkles, Target, TrendingUp, Video, Wifi, WifiOff, X } from 'lucide-react';
import MovementViewer from './MovementViewer';
import TrendChart from './TrendChart';
import FlightCheck from './FlightCheck';
import CrewSummary from './CrewSummary';
import Evidence from './Evidence';
import MissionLens from './MissionLens';
import { createDemo, downloadFile, formatDate, loadMission, loadRecordings, saveMission, saveRecording } from './data';
import { analyze } from './rules.mjs';
import { researchReferencesMarkdown, researchSources, researchUse } from './research.mjs';
import type { CheckIn, FlagKind, FollowUp, MissionPacket, MissionState, Page, Recording } from './types';

const Capture = lazy(() => import('./Capture'));

const navigation = [
  { id: 'overview' as Page, label: 'Mission overview', icon: LayoutDashboard },
  { id: 'lens' as Page, label: 'Mission lens', icon: Sparkles },
  { id: 'movement' as Page, label: 'Movement diary', icon: Move3d },
  { id: 'flight' as Page, label: 'Flight check', icon: Target },
  { id: 'insights' as Page, label: 'Personal trends', icon: Activity },
  { id: 'actions' as Page, label: 'Action log', icon: ClipboardList },
];

type Modal = null | 'flight' | 'capture' | 'report' | 'settings' | 'about' | 'source' | FlagKind;

function SourceVideo({ recording }: { recording?: Recording }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!recording) return;
    const value = URL.createObjectURL(recording.blob);
    setUrl(value);
    return () => URL.revokeObjectURL(value);
  }, [recording]);
  return recording ? <><video className="source-video" controls src={url}/><p className="fine-print">Original source · {formatDate(recording.date, { hour: '2-digit', minute: '2-digit' })} SGT · stored on this device</p><a className="button secondary" href={url} download={`ghostpilot-original-${recording.id}.${recording.blob.type.includes('mp4') ? 'mp4' : 'webm'}`}><Download size={15}/> Download original</a></> : <div className="empty-state"><Video size={34}/><strong>This session is an illustration.</strong><p>The simulated shoulder session has no source video. Its pose comparison uses an articulated astronaut. The separately labelled Trained 4DGS view plays a public humanoid research model; it does not supply crew measurements. Record your own movement to retain an original video.</p></div>;
}

export default function App() {
  const [mission, setMission] = useState<MissionState>(createDemo);
  const [loaded, setLoaded] = useState(false);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [selectedRecording, setSelectedRecording] = useState<string | null>(null);
  const [selectedDemo, setSelectedDemo] = useState<string | null>(null);
  const [page, setPage] = useState<Page>(() => navigation.find(n => n.id === location.hash.slice(1))?.id ?? 'overview');
  const [modal, setModal] = useState<Modal>(null);
  const [lensEvidence, setLensEvidence] = useState<CheckIn[] | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [toast, setToast] = useState('');
  const [storage, setStorage] = useState<'saving' | 'saved' | 'error'>('saving');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [narrowScreen, setNarrowScreen] = useState(() => window.matchMedia('(max-width: 700px)').matches);
  const [actionFilter, setActionFilter] = useState<'all' | 'scheduled' | 'complete'>('all');
  const [profileName, setProfileName] = useState('');
  const [missionName, setMissionName] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const analysis = useMemo(() => analyze(mission.checkIns, mission.demo), [mission.checkIns, mission.demo]);
  const sol = Math.max(42, mission.profile.startDate ? Math.floor((Date.now() - new Date(mission.profile.startDate).getTime()) / 86400000) + 1 : 42, ...mission.checkIns.map(c => c.sol));
  const flags = Number(analysis.movementFlag) + Number(analysis.attentionFlag);
  const scheduled = mission.actions.filter(a => a.status === 'scheduled' && a.simulated === mission.demo);
  const currentRecording = recordings.find(r => r.id === selectedRecording);
  const personalAnalysis = useMemo(() => analyze(mission.checkIns, false), [mission.checkIns]);
  const demoSession = mission.checkIns.find(c => c.id === selectedDemo) || analysis.records.at(-1);
  const hasMovement = !!currentRecording || mission.demo;
  const viewerSimulated = !currentRecording && mission.demo;
  const viewerBaseline = currentRecording ? personalAnalysis.baseline.leftRange : analysis.baseline.leftRange;
  const hasBaseline = currentRecording ? personalAnalysis.enough && viewerBaseline != null : viewerSimulated && viewerBaseline != null;
  const today = formatDate(new Date().toISOString());
  const todayCheck = mission.checkIns.find(c => !c.simulated && formatDate(c.date) === today);

  function notify(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 4500);
  }

  useEffect(() => {
    let active = true;
    void Promise.all([loadMission(), loadRecordings()]).then(([saved, videos]) => {
      if (!active) return;
      if (saved) setMission(saved);
      setRecordings(videos);
      setLoaded(true);
    }).catch(() => { if (active) { setStorage('error'); setLoaded(true); notify('Device storage is unavailable. Changes may not survive a reload.'); } });
    const updateOnline = () => setOnline(navigator.onLine);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    return () => { active = false; window.removeEventListener('online', updateOnline); window.removeEventListener('offline', updateOnline); };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    setStorage('saving');
    let active = true;
    void saveMission(mission).then(() => { if (active) setStorage('saved'); }).catch(() => { if (active) { setStorage('error'); notify('Changes could not be saved. Please check your device storage.'); } });
    return () => { active = false; };
  }, [mission, loaded]);

  useEffect(() => {
    if (!modal) setLensEvidence(null);
    if (!modal && !mobileMenu) return;
    const previous = document.activeElement as HTMLElement;
    document.body.style.overflow = 'hidden';
    const focusTimer = setTimeout(() => document.querySelector<HTMLElement>(modal ? '[role="dialog"] button' : '.sidebar.open button')?.focus(), 30);
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setModal(null); setMobileMenu(false); }
      if (e.key === 'Tab') {
        const dialog = document.querySelector(modal ? '[role="dialog"]' : '.sidebar.open');
        const focusable = Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], video[controls], [tabindex="0"]') ?? []).filter(el => el.getClientRects().length > 0);
        if (!focusable?.length) return;
        const first = focusable[0]; const last = focusable[focusable.length - 1];
        if (!dialog?.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
        else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => { clearTimeout(focusTimer); document.body.style.overflow = ''; window.removeEventListener('keydown', handleKey); previous?.focus(); };
  }, [modal, mobileMenu]);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 700px)');
    const update = () => { setNarrowScreen(query.matches); if (!query.matches) setMobileMenu(false); };
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const onHash = () => {
      const next = navigation.find(n => n.id === location.hash.slice(1))?.id;
      if (next) setPage(next);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  function goTo(next: Page) { setPage(next); window.location.hash = next; setMobileMenu(false); window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); }
  function openSettings() { setProfileName(mission.profile.name); setMissionName(mission.profile.mission); setModal('settings'); }

  function addCheckIn(check: CheckIn) {
    const latestRecording = recordings.filter(r => formatDate(r.date) === today).at(-1);
    if (!check.simulated && latestRecording) { check.leftRange = latestRecording.leftRange ?? undefined; check.rightRange = latestRecording.rightRange ?? undefined; }
    setMission(old => ({ ...old, checkIns: [...old.checkIns, check] }));
    notify(check.simulated ? 'Simulated check-in saved to your demo history.' : 'Flight check saved. One more day of knowing yourself.');
  }

  async function addRecording(recording: Recording) {
    await saveRecording(recording);
    setRecordings(old => [...old, recording]);
    setSelectedRecording(recording.id);
    setPage('movement');
    setMission(old => ({ ...old, checkIns: old.checkIns.map(c => !c.simulated && formatDate(c.date) === today ? { ...c, leftRange: recording.leftRange ?? undefined, rightRange: recording.rightRange ?? undefined } : c) }));
    notify('Movement and original video saved on this device.');
  }

  function addAction(action: FollowUp) {
    if (lensEvidence?.length) action.notes = [action.notes, `Evidence reviewed through Sol ${lensEvidence.at(-1)!.sol} (${formatDate(lensEvidence.at(-1)!.date)}).`].filter(Boolean).join('\n');
    setMission(old => ({ ...old, actions: [...old.actions, action] }));
    setModal(null);
    notify(`Action logged. Reassess on ${formatDate(action.scheduledAt)}.`);
  }

  async function addPacket(packet: MissionPacket) {
    await saveMission({ ...mission, packets: [...(mission.packets ?? []), packet] });
    setMission(old => ({ ...old, packets: [...(old.packets ?? []), packet] }));
    notify('Onboard handoff saved. Nothing has been transmitted.');
  }

  async function markPacketDownloaded(id: string) {
    await saveMission({ ...mission, packets: (mission.packets ?? []).map(packet => packet.id === id ? { ...packet, status: 'downloaded', downloadedAt: new Date().toISOString() } : packet) });
    setMission(old => ({ ...old, packets: (old.packets ?? []).map(packet => packet.id === id ? { ...packet, status: 'downloaded', downloadedAt: new Date().toISOString() } : packet) }));
  }

  function loadDemo() {
    const demo = createDemo();
    setMission(old => ({ ...old, demo: true, checkIns: [...old.checkIns.filter(c => !c.simulated), ...demo.checkIns] }));
    setSelectedRecording(null); setSelectedDemo(null);
    notify('Simulated mission history loaded. Your personal records are preserved.');
  }

  function report() {
    return `# GhostPilot · Mission health snapshot\n\nGenerated: ${new Date().toISOString()}\nCrew: ${mission.profile.name}\nMission: ${mission.profile.mission} · Sol ${sol}\nData source: ${mission.demo ? 'SIMULATED DEMONSTRATION — synthetic data, not an astronaut record' : 'PERSONAL RECORDS — recorded on this device'}\n\n## Observations\nBaseline: ${analysis.baselineRecords.length} earlier check-ins. Recent window: ${analysis.recent.length} check-ins. Medians are compared only within the same data source.\n- Attention: ${analysis.current.reactionMs ?? 'unavailable'} ms; baseline ${analysis.baseline.reactionMs ?? 'unavailable'} ms; change ${analysis.attentionDelta ?? 'unavailable'}%.\n- Estimated left shoulder range: ${analysis.current.leftRange ?? 'unavailable'} degrees; baseline ${analysis.baseline.leftRange ?? 'unavailable'} degrees; change ${analysis.movementDelta ?? 'unavailable'}%.\n- Sleep: ${analysis.current.sleep ?? 'unavailable'}/5. Energy: ${analysis.current.energy ?? 'unavailable'}/5.\n- Reported symptoms: ${[...new Set(analysis.recent.flatMap((c: CheckIn) => c.symptoms))].join(', ') || 'None recorded'}.\n\n## Recorded check-ins in this view\n${analysis.records.map((c: CheckIn) => `- ${c.date}: Sol ${c.sol}; attention ${c.reactionMs ?? 'unavailable'} ms; received ${c.signals - c.missed}/${c.signals}; sleep ${c.sleep}/5; mood ${c.mood}/5; energy ${c.energy}/5; heart rate ${c.heartRate ?? 'not entered'} bpm; symptoms ${c.symptoms.join(', ') || 'none'}; notes: ${c.notes || 'none'}`).join('\n')}\n\n## Action and reassessment log\n${mission.actions.filter(a => a.simulated === mission.demo).map(a => `- ${a.title} [${a.status}]\n  Created: ${a.createdAt}. Reassess: ${a.scheduledAt}.\n  Checklist reviewed: ${a.checklist.join('; ') || 'None recorded'}.\n  Notes: ${a.notes || 'None'}`).join('\n') || 'No actions recorded for this data source.'}\n\n## Movement sources\n${recordings.map(r => `- Recorded ${r.date}; ${r.frames.length} pose frames; original ${r.blob.type} video retained on the source device. Video is not embedded in this report.`).join('\n') || 'Synthetic mobility session; no crew source video. The separate public 4DGS example supplies no measurements.'}\n\n## Uncertainty and limitations\nThis prototype supports noticing changes, not diagnosis. Attention may vary with device latency, interruptions, and practice. Pose estimates may vary with camera position, restraints, effort, and gravity. The pose-comparison avatar is a simplified illustration. The separate trained 4DGS research example is unrelated to crew records; neither is a clinical anatomical model. These signals cannot measure bone loss, radiation injury, or immune status.\n\nFollow-up cards are predefined prototype reflection aids, not approved medical protocols. Medical decisions and escalation require mission-approved guidance. The personal baseline is typical performance, not a target or high score.\n\nThis report was generated locally for review. It has not been sent to ground staff.\n\n${researchReferencesMarkdown()}`;
  }

  if (!loaded) return <div className="mission-launch" role="status"><Ghost size={44} strokeWidth={1.2}/><h1>Reconnecting with your usual self.</h1><p>Opening your onboard records…</p></div>;

  const movementContent = <MovementViewer active={!modal} onRecord={() => setModal('capture')} onEvidence={() => setModal('movement')} simulated={viewerSimulated} sol={currentRecording?.sol ?? demoSession?.sol ?? sol} frames={currentRecording?.frames} leftRange={currentRecording?.leftRange ?? demoSession?.leftRange ?? 134} baselineRange={viewerBaseline ?? 152} hasBaseline={hasBaseline}/>;

  const copilotContent = <section className="panel copilot-panel"><div className="panel-heading"><div><div className="eyebrow"><Sparkles size={13}/> A SECOND PAIR OF EYES</div><h2>Your copilot noticed.</h2></div><span className="count-pill">{flags}</span></div><p className="panel-description">Small changes worth a closer look.<br/>Always compared with your usual self.</p>{analysis.movementFlag && <button className="signal-card" onClick={() => setModal('movement')}><div className="signal-top"><span className="signal-icon"><Move3d size={18}/></span><span className="pill amber">Movement</span><ArrowUpRight size={17}/></div><h3>A little less reach on the left.</h3><p>Left arm range is <strong>{Math.abs(analysis.movementDelta!)}% below</strong> your baseline across 3 sessions.</p><span className="text-link">Explore the evidence <ArrowRight size={13}/></span></button>}{analysis.attentionFlag && <button className="signal-card attention-signal" onClick={() => setModal('attention')}><div className="signal-top"><span className="signal-icon"><Eye size={18}/></span><span className="pill lavender">Attention</span><ArrowUpRight size={17}/></div><h3>A slower signal response.</h3><p>Response time is <strong>{analysis.attentionDelta}% higher.</strong> You also reported lighter sleep.</p><span className="text-link">Connect the dots <ArrowRight size={13}/></span></button>}{!flags && <div className="quiet-copilot"><Ghost size={38}/><h3>{analysis.enough ? 'Looking like your usual self.' : 'Getting to know your usual self.'}</h3><p>{analysis.enough ? 'No movement or attention trend crossed the prototype threshold.' : 'Your ghost needs at least 6 comparable check-ins to start spotting trends.'}</p><button className="text-link" onClick={() => setModal('flight')}>Make a check-in <ArrowRight size={14}/></button></div>}<div className="copilot-note"><ShieldCheck size={16}/><span>Observations, with context.<small>Every signal has evidence and a next step.</small></span></div></section>;

  const followupContent = <section className="panel followup-panel"><div className="panel-heading"><div><div className="eyebrow">NOTICE → ACT → REASSESS</div><h2>Your next small steps.</h2></div><button className="icon-button" aria-label="Open action log" onClick={() => goTo('actions')}><ArrowUpRight size={18}/></button></div>{[{ kind: 'movement' as FlagKind, icon: Move3d, title: 'Check that shoulder again', description: 'Repeat under the same conditions.', tag: 'MOVEMENT' }, { kind: 'attention' as FlagKind, icon: Moon, title: 'Make space for a reset', description: 'Reflect on sleep, rest, and workload.', tag: 'RECOVERY' }, { kind: 'wellbeing' as FlagKind, icon: CalendarDays, title: 'Leave a note for tomorrow', description: 'Log an action. Set a time to check back.', tag: 'FOLLOW-UP' }].map(({ kind, icon: Icon, title, description, tag }) => <button className="followup-row" key={kind} onClick={() => setModal(kind)}><span className={`followup-icon ${kind}`}><Icon size={18}/></span><span><small>{tag}</small><strong>{title}</strong><p>{description}</p></span><ChevronRight size={16}/></button>)}<div className="followup-footer"><span className="status-dot"/> {scheduled.length ? `${scheduled.length} follow-up${scheduled.length > 1 ? 's' : ''} scheduled` : 'Small steps. A longer view.'}</div></section>;

  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to main content</a>
    {mobileMenu && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setMobileMenu(false)}/>}
    <aside className={`sidebar ${mobileMenu ? 'open' : ''}`} inert={!!modal || (narrowScreen && !mobileMenu)} role={mobileMenu ? 'dialog' : undefined} aria-modal={mobileMenu ? true : undefined} aria-label="Mission navigation">{mobileMenu && <button className="icon-button navigation-close" aria-label="Close navigation menu" onClick={() => setMobileMenu(false)}><X size={20}/></button>}<button className="brand" onClick={() => goTo('overview')} aria-label="GhostPilot home"><span className="brand-mark"><Ghost size={25} strokeWidth={1.7}/></span><strong>ghostpilot<span>®</span></strong></button><div className="sidebar-eyebrow">CREW HEALTH / MISSION SUPPORT</div><button className="mission-switch" onClick={openSettings}><span className="mission-icon"><Orbit size={21}/></span><span><strong>{mission.profile.mission}</strong><small>EXPEDITION 07</small></span><ChevronDown size={15}/></button><div className="nav-label">YOUR SPACE</div><nav aria-label="Mission pages">{navigation.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${page === id ? 'active' : ''}`} aria-current={page === id ? 'page' : undefined} onClick={() => goTo(id)}><Icon size={18} strokeWidth={1.7}/><span>{label}</span>{id === 'actions' && scheduled.length > 0 && <i>{scheduled.length}</i>}{id === 'movement' && <span className="nav-dot"/>}</button>)}</nav><div className="sidebar-orbit"><div className="orbit-art"><Orbit size={50} strokeWidth={.65}/><span/></div><p>A little more perspective.<br/>A little more you.</p><span>YOUR PAST SELF IS ON BOARD.</span></div><div className="sidebar-bottom"><div className="connection-card"><div><span className="status-dot"/><strong>Onboard & independent</strong><Wifi size={13}/></div><p>Built for the space between signals.</p><span><Radio size={12}/> GROUND LINK <b>NOT CONNECTED</b></span></div><button className="sidebar-link" onClick={() => setModal('about')}><HelpCircle size={17}/> Meet your ghost <ArrowUpRight size={13}/></button><button className="profile-button" onClick={openSettings}><span className="avatar">{mission.profile.initials}</span><span><strong>{mission.profile.name}</strong><small>Mission specialist</small></span><Settings2 size={16}/></button></div></aside>
    <div className="main-shell" inert={!!modal || mobileMenu}><header className="topbar"><div className="breadcrumb"><button className="mobile-menu icon-button" aria-label="Open navigation" aria-expanded={mobileMenu} onClick={() => setMobileMenu(true)}><Menu size={20}/></button><span className="breadcrumb-mission">{mission.profile.mission}</span><ChevronRight size={13}/><span>{navigation.find(n => n.id === page)?.label}</span></div><div className="topbar-meta"><span className="mission-sol"><span className="status-dot"/> MISSION DAY <strong>{String(sol).padStart(3, '0')}</strong></span><span className={`save-status ${storage === 'error' ? 'error' : ''}`}>{online ? <CheckCheck size={14}/> : <WifiOff size={14}/>}<span>{storage === 'error' ? 'Storage unavailable' : storage === 'saving' ? 'Saving…' : online ? 'Saved on device' : 'Offline · saved on device'}</span></span><button className="notification-button icon-button" aria-label="View scheduled follow-ups" onClick={() => goTo('actions')}><Bell size={18}/>{scheduled.length > 0 && <i/>}</button></div></header>
    <main id="main-content" tabIndex={-1}>
      <div className="page-heading"><div><div className="eyebrow greeting"><span className="greeting-line"/>{page === 'lens' ? 'FIVE HAZARDS. ONE PERSONAL PERSPECTIVE.' : page === 'overview' ? 'NASA CREW HEALTH / PROTOTYPE' : page === 'movement' ? 'YOUR MOVEMENT BLACK BOX' : page === 'insights' ? 'A LITTLE DISTANCE. A CLEARER VIEW.' : page === 'actions' ? 'SMALL ACTIONS. MEANINGFUL FOLLOW-UPS.' : '90 SECONDS FOR YOURSELF'}</div><h1>{page === 'lens' ? 'See the bigger mission.' : page === 'overview' ? 'Crew health overview.' : page === 'movement' ? 'Every movement tells a story.' : page === 'insights' ? 'Get to know your usual self.' : page === 'actions' ? 'Close the loop.' : 'Ready when you are, pilot.'}</h1><p>{page === 'lens' ? 'Rewind your observations. Connect the context. Keep the next step on board.' : page === 'overview' ? 'Review observations, investigate changes, and prepare a ground handoff.' : page === 'movement' ? 'Replay a moment. Rotate your perspective. See what’s changed.' : page === 'insights' ? 'Your baseline is a familiar rhythm, never a high score to beat.' : page === 'actions' ? 'Notice, investigate, act, and come back to see what changed.' : 'Dock your spacecraft, check in with yourself, and carry on with a clearer picture.'}</p></div><button className="button primary start-check" onClick={() => setModal(page === 'movement' ? 'capture' : 'flight')}>{page === 'movement' ? <Camera size={17}/> : <CrosshairIcon/>}{page === 'movement' ? 'Record movement' : todayCheck ? 'Check in again' : 'Start flight check'}<ArrowRight size={16}/></button></div>
      {mission.demo && <div className="demo-banner"><span><FlaskConical size={15}/><strong>Demo mission</strong><span className="banner-divider"/> You’re exploring a simulated 14-day history. Your real check-ins are kept separate.</span><button onClick={() => { setMission(old => ({ ...old, demo: false })); setSelectedRecording(recordings.at(-1)?.id ?? null); notify('Showing your personal records. Reload the demo from Mission settings.'); }}>Switch to my data <ArrowRight size={14}/></button></div>}
      {page === 'overview' && <><CrewSummary latest={analysis.records.at(-1)} simulated={mission.demo} baselineCount={analysis.baselineRecords.length} attentionDelta={analysis.attentionDelta} movementDelta={analysis.movementDelta} attentionFlag={analysis.attentionFlag} movementFlag={analysis.movementFlag} followUps={scheduled.length} onReview={kind => setModal(kind)} onActions={() => goTo('actions')}/><button className="lens-discovery" onClick={() => goTo('lens')}><span><Sparkles size={20}/></span><div><small>NEW PERSPECTIVE / MISSION LENS</small><strong>Five hazards. One you. See how the signals connect.</strong></div><span>Explore your mission <ArrowUpRight size={16}/></span></button><div className="primary-grid">{hasMovement ? movementContent : <EmptyMovement onRecord={() => setModal('capture')}/ >}{copilotContent}</div><div className="secondary-grid"><TrendChart checkIns={mission.checkIns} simulated={mission.demo}/>{followupContent}</div><div className="ground-report"><div className="report-icon"><FileText size={21}/></div><div><h3>Prepare a flight surgeon handoff.</h3><p>Bundle your observations, context, and actions into a compact mission report.</p></div><button className="button secondary" onClick={() => setModal('report')}>Prepare ground report <ArrowUpRight size={15}/></button></div></>}
      {page === 'lens' && <MissionLens key={mission.demo ? 'demo' : 'personal'} mission={mission} online={online} onInvestigate={(kind, records) => { setLensEvidence(records); setModal(kind); }} onSavePacket={addPacket} onDownloaded={markPacketDownloaded} onCheckIn={() => setModal('flight')}/>}
      {page === 'movement' && <><div className="primary-grid movement-page-grid">{hasMovement ? movementContent : <EmptyMovement onRecord={() => setModal('capture')}/>}<section className="panel session-panel"><div className="panel-heading"><div><div className="eyebrow">A MOMENT, KEPT</div><h2>Session details.</h2></div><BookOpen size={18}/></div><div className="session-art"><Move3d size={46} strokeWidth={1}/><span>SHOULDER MOBILITY</span></div><dl className="details-list"><div><dt>Session source</dt><dd>{currentRecording ? 'Local camera + MediaPipe' : mission.demo ? 'Simulated articulated model' : 'No session yet'}</dd></div><div><dt>Left shoulder estimate</dt><dd>{currentRecording ? currentRecording.leftRange != null ? `${currentRecording.leftRange}°` : 'No confident estimate' : mission.demo ? `${demoSession?.leftRange}°` : '—'}</dd></div><div><dt>Right shoulder estimate</dt><dd>{currentRecording ? currentRecording.rightRange != null ? `${currentRecording.rightRange}°` : 'No confident estimate' : mission.demo ? `${demoSession?.rightRange}°` : '—'}</dd></div><div><dt>Original video</dt><dd>{currentRecording ? 'Retained on device' : 'No video · simulated'}</dd></div><div><dt>Comparison conditions</dt><dd>Same camera & gravity</dd></div></dl><button className="button secondary full-width" onClick={() => setModal('source')}><Video size={15}/> Review original source</button><p className="fine-print">Pose-based angles are experimental. A rendered avatar does not establish anatomical accuracy.</p></section></div><section className="panel history-panel"><div className="panel-heading"><div><div className="eyebrow">YOUR REPLAY LIBRARY</div><h2>Moments along the mission.</h2></div><span className="pill sage">{recordings.length} personal recordings</span></div><div className="session-list">{recordings.slice().reverse().map(r => <button className={`session-tile ${selectedRecording === r.id ? 'selected' : ''}`} key={r.id} onClick={() => { setSelectedRecording(r.id); setSelectedDemo(null); }}><div className="session-thumbnail"><Video size={30}/><span>LOCAL RECORDING</span></div><strong>Sol {r.sol} · Shoulder mobility</strong><span>{formatDate(r.date)} · {r.frames.length} pose frames</span></button>)}{mission.demo && mission.checkIns.filter(c => c.simulated).slice(-3).reverse().map(c => <button className={`session-tile ${!selectedRecording && (selectedDemo === c.id || (!selectedDemo && c.id === demoSession?.id)) ? 'selected' : ''}`} key={c.id} onClick={() => { setSelectedRecording(null); setSelectedDemo(c.id); }}><div className="session-thumbnail simulated"><Move3d size={34}/><span>SIMULATED SESSION</span></div><strong>Sol {c.sol} · Shoulder mobility</strong><span>{formatDate(c.date)} · 12 seconds · Illustrative</span></button>)}<button className="session-tile new-session" onClick={() => setModal('capture')}><Camera size={27}/><strong>A new perspective</strong><span>Record a movement</span></button></div></section></>}
      {page === 'insights' && <><div className="insights-grid"><TrendChart checkIns={mission.checkIns} simulated={mission.demo} expanded/>{copilotContent}</div><section className="panel history-panel"><div className="panel-heading"><div><div className="eyebrow">THE OBSERVATIONS BEHIND THE CURVE</div><h2>Your check-in history.</h2></div><span className="pill neutral">{analysis.records.length} {mission.demo ? 'simulated' : 'personal'} entries</span></div><div className="table-scroll" tabIndex={0} role="region" aria-label="Check-in history table"><table><thead><tr><th>Mission day</th><th>Date</th><th>Response</th><th>Sleep</th><th>Mood</th><th>Energy</th><th>Symptoms</th></tr></thead><tbody>{analysis.records.slice().reverse().map((c: CheckIn) => <tr key={c.id}><td>Sol {c.sol}</td><td>{formatDate(c.date)}</td><td>{c.reactionMs ?? '—'} ms</td><td>{c.sleep}/5</td><td>{c.mood}/5</td><td>{c.energy}/5</td><td>{c.symptoms.join(', ') || 'None reported'}</td></tr>)}</tbody></table>{!analysis.records.length && <div className="empty-state">Your first check-in will appear here.</div>}</div></section></>}
      {page === 'flight' && <><div className="flight-page-card"><div className="flight-illustration"><div className="flight-orbit one"/><div className="flight-orbit two"/><Rocket size={100} strokeWidth={1}/><i/><span className="flight-coordinate">ARES I · APPROACH SEQUENCE</span></div><div className="flight-page-copy"><span className="pill sage"><Clock3 size={12}/> ABOUT 90 SECONDS</span><h2>A familiar ritual.<br/>A fresh perspective.</h2><p>A short attention task, a moment of reflection, and an optional vital reading. Compare with your past self, at your own pace.</p><ul><li><Target size={18}/><span><strong>Dock the spacecraft</strong>Respond to randomly appearing signals.</span></li><li><Leaf size={18}/><span><strong>Check the crew</strong>Tell your ghost how you slept and how you feel.</span></li><li><TrendingUp size={18}/><span><strong>See the longer view</strong>Small changes become part of your story.</span></li></ul><button className="button primary" onClick={() => setModal('flight')}>Let’s check in <ArrowRight size={17}/></button></div></div><div className="secondary-grid"><TrendChart checkIns={mission.checkIns} simulated={mission.demo}/>{followupContent}</div></>}
      {page === 'actions' && <><div className="action-summary"><div><ClipboardList size={24}/><span><strong>{scheduled.length}</strong> scheduled follow-ups</span></div><div><CircleCheck size={24}/><span><strong>{mission.actions.filter(a => a.status === 'complete').length}</strong> actions completed</span></div><button className="button secondary" onClick={() => setModal('report')}><Download size={15}/> Prepare report</button></div><section className="panel action-log-panel"><div className="panel-heading"><h2>Your action log.</h2><div className="chart-tabs">{(['all', 'scheduled', 'complete'] as const).map(f => <button key={f} className={actionFilter === f ? 'active' : ''} onClick={() => setActionFilter(f)}>{f === 'all' ? 'All actions' : f === 'complete' ? 'Completed' : 'Scheduled'}</button>)}</div></div>{mission.actions.filter(a => actionFilter === 'all' || a.status === actionFilter).length ? <div className="action-list">{mission.actions.filter(a => actionFilter === 'all' || a.status === actionFilter).slice().reverse().map(a => <article className="action-log-item" key={a.id}><span className={`followup-icon ${a.kind}`}>{a.status === 'complete' ? <Check size={20}/> : <Clock3 size={20}/>}</span><div className="action-info"><div><span className={`pill ${a.status === 'complete' ? 'sage' : 'amber'}`}>{a.status === 'complete' ? 'Completed' : new Date(a.scheduledAt) <= new Date() ? 'Ready to reassess' : 'Scheduled'}</span>{a.simulated && <span className="simulation-tag">SIMULATED CONTEXT</span>}</div><h3>{a.title}</h3><p>{a.notes || 'No additional notes recorded.'}</p><small>Reassess {formatDate(a.scheduledAt, { hour: '2-digit', minute: '2-digit' })} SGT · {a.checklist.length} checklist items reviewed</small></div><div className="action-buttons"><button className="button secondary small" onClick={() => setMission(old => ({ ...old, actions: old.actions.map(item => item.id === a.id ? { ...item, status: item.status === 'complete' ? 'scheduled' : 'complete' } : item) }))}>{a.status === 'complete' ? 'Reopen' : 'Mark complete'}{a.status !== 'complete' && <Check size={14}/>}</button><button className="text-link" onClick={() => setModal(a.kind === 'movement' ? 'capture' : 'flight')}>Reassess now <ArrowRight size={13}/></button></div></article>)}</div> : <div className="empty-state roomy"><ClipboardList size={42} strokeWidth={1}/><h3>A small step starts here.</h3><p>Investigate a signal, choose a follow-up action, and set a time to check back. Your log stays with you, even between ground links.</p><button className="button secondary" onClick={() => setModal('wellbeing')}>Log your first action <ArrowRight size={15}/></button></div>}</section><div className="action-protocol-note"><ShieldCheck size={18}/><p>These reflection cards use predefined prototype guidance. Follow your mission’s approved protocols for health decisions and escalation.</p></div></>}
      <footer className="app-footer"><span><Ghost size={14}/> A little more you, every day.</span><span>Designed for perspective. Not diagnosis.<i/> {mission.demo ? 'SIMULATED MISSION' : 'PERSONAL MISSION'} <span className="status-dot"/></span></footer>
    </main></div>
    {modal === 'flight' && <FlightCheck onClose={() => setModal(null)} onSave={addCheckIn} sol={sol}/>}
    {modal === 'capture' && <Suspense fallback={<div className="modal-overlay"><div className="modal"><p>Preparing your movement diary…</p></div></div>}><Capture onClose={() => setModal(null)} onSave={addRecording} sol={sol}/></Suspense>}
    {(modal === 'movement' || modal === 'attention' || modal === 'wellbeing') && <Evidence kind={modal} checkIns={lensEvidence ?? mission.checkIns} asOf={lensEvidence?.at(-1)?.date} simulated={lensEvidence ? mission.demo : modal === 'movement' && currentRecording ? false : mission.demo} onClose={() => setModal(null)} onSave={addAction}/>}
    {(modal === 'report' || modal === 'settings' || modal === 'about' || modal === 'source') && <div className="modal-overlay"><section className={`modal ${modal === 'report' ? 'report-modal' : ''}`} role="dialog" aria-modal="true" aria-labelledby="general-modal-title"><button className="modal-close icon-button" aria-label="Close dialog" onClick={() => setModal(null)}><X size={20}/></button>
      {modal === 'report' && <><div className="eyebrow">FOR FLIGHT SURGEON REVIEW</div><h2 id="general-modal-title">A compact ground report.</h2><p className="modal-description">Your observations, uncertainty, and follow-up actions, ready for review. Nothing is transmitted automatically.</p><div className="report-preview" tabIndex={0} role="region" aria-label="Ground report preview"><pre>{report()}</pre></div><div className="modal-actions"><button className="button secondary" onClick={() => { downloadFile(`ghostpilot-sol-${sol}.json`, JSON.stringify({ generatedAt: new Date().toISOString(), source: mission.demo ? 'SIMULATED' : 'PERSONAL', profile: mission.profile, checkIns: analysis.records, actions: mission.actions.filter(a => a.simulated === mission.demo), research: researchUse, sources: researchSources, note: 'Experimental prototype; not diagnostic. Original videos remain on the source device.' }, null, 2), 'application/json'); notify('Structured report downloaded.'); }}><Download size={16}/> JSON data</button><button className="button primary" onClick={() => { downloadFile(`ghostpilot-sol-${sol}-report.md`, report()); notify('Ground report downloaded. Ready for your review.'); }}><Download size={16}/> Download report</button></div></>}
      {modal === 'settings' && <><div className="eyebrow">YOUR SPACE, YOUR SETTINGS</div><h2 id="general-modal-title">Make yourself at home.</h2><form onSubmit={e => { e.preventDefault(); const name = profileName.trim(); setMission(old => ({ ...old, profile: { ...old.profile, name, initials: name.split(/\s+/).slice(0, 2).map(s => s[0]).join('').toUpperCase(), mission: missionName.trim() } })); setModal(null); notify('Mission settings saved.'); }}><label className="form-label">Crew name<input required maxLength={40} value={profileName} onChange={e => setProfileName(e.target.value)}/></label><label className="form-label">Mission name<input required maxLength={30} value={missionName} onChange={e => setMissionName(e.target.value)}/></label><button className="button primary full-width" type="submit">Save mission settings <Check size={16}/></button></form><div className="settings-section"><h3><FlaskConical size={17}/> Simulated mission</h3><p>Explore a 14-day synthetic history with movement and attention changes. Personal records remain separate.</p><button className="button secondary full-width" onClick={loadDemo}>Load simulated history <ArrowRight size={15}/></button>{mission.demo && <button className="text-link settings-switch" onClick={() => { setMission(old => ({ ...old, demo: false })); setSelectedRecording(recordings.at(-1)?.id ?? null); setModal(null); notify('Showing your personal mission data.'); }}>Return to personal data <ArrowRight size={14}/></button>}</div><div className="privacy-note"><ShieldCheck size={16}/><span>All check-ins, actions, and videos stay in this browser’s local storage. Keep this device’s browser data to retain your mission history.</span></div></>}
      {modal === 'about' && <><div className="about-ghost"><Ghost size={46} strokeWidth={1.3}/><Sparkles size={20}/></div><div className="eyebrow">AN EXTRA CREWMATE, BUILT FROM YOU</div><h2 id="general-modal-title">Your usual self is on board.</h2><p className="modal-description">On a mission far from Earth, your past self becomes an extra crewmate watching for changes you might miss.</p><div className="about-points"><div><Ghost size={20}/><span><strong>A baseline, not a high score.</strong>Your ghost uses the median of up to 11 earlier check-ins, compared with the latest 3. At least 6 comparable entries are needed.</span></div><div><Eye size={20}/><span><strong>Small signals, in context.</strong>Prototype flags appear when median response time rises 15% or left shoulder range falls 8%. They are prompts for reflection, not validated medical thresholds.</span></div><div><ShieldCheck size={20}/><span><strong>Private, even far from home.</strong>IndexedDB keeps your records on this device. After the first complete load, GhostPilot works offline, with no paid API or hardware required.</span></div><div><Move3d size={20}/><span><strong>Honest about the reconstruction.</strong>The Trained 4DGS view uses a public trained humanoid checkpoint. The pose comparison uses an articulated astronaut. Live sessions retain the original video and MediaPipe pose estimates; creating their own 4DGS reconstruction needs separate training.</span></div></div><a className="text-link" target="_blank" rel="noreferrer" href="https://github.com/hustvl/4DGaussians">Explore the official 4DGS research <ArrowUpRight size={14}/></a><p className="fine-print">GhostPilot cannot diagnose illness, bone loss, radiation injury, or immune changes. Medical escalation requires mission-approved protocols.</p></>}
      {modal === 'source' && <><div className="eyebrow">REPLAY THE EVIDENCE</div><h2 id="general-modal-title">The original perspective.</h2><SourceVideo recording={currentRecording}/></>}
    </section></div>}
    {toast && <div className="toast" role="status"><CircleCheck size={18}/><span>{toast}</span><button aria-label="Dismiss notification" onClick={() => setToast('')}><X size={15}/></button></div>}
  </div>;
}

function CrosshairIcon() { return <Target size={17}/>; }
function EmptyMovement({ onRecord }: { onRecord: () => void }) { return <section className="panel empty-movement"><div className="empty-state roomy"><Move3d size={65} strokeWidth={.8}/><div className="eyebrow">YOUR MOVEMENT DIARY</div><h2>Your next chapter starts with a movement.</h2><p>Record a short arm raise. Your original video and experimental pose replay stay on this device.</p><button className="button primary" onClick={onRecord}><Camera size={17}/> Record first movement</button></div></section>; }
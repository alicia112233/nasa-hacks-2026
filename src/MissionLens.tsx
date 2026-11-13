import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ArrowUpRight, Check, ChevronLeft, ChevronRight, CircleDashed, Download, FileCheck2, Focus, Ghost, Info, LockKeyhole, Moon, Move3d, Pause, Play, Radio, Radiation, Satellite, ScanLine, ShieldQuestion, Wind } from 'lucide-react';
import { createMissionPacket, lensHazards, lensSnapshot, researchSources } from './mission-lens.mjs';
import { downloadFile, formatDate } from './data';
import type { CheckIn, FlagKind, HazardId, MissionPacket, MissionState } from './types';
import './mission-lens.css';
import ResearchContext, { HazardResearch } from './ResearchContext';

type Metric = { key: string; label: string; unit: string; flag: boolean; value: number | null; baseline: number | null; baselineCount: number; recentCount: number; change: number | null; comparable: boolean };
interface Props {
  mission: MissionState;
  online: boolean;
  onInvestigate: (kind: FlagKind, records: CheckIn[]) => void;
  onSavePacket: (packet: MissionPacket) => Promise<void>;
  onDownloaded: (id: string) => Promise<void>;
  onCheckIn: () => void;
}
const icons = { moon: Moon, move: Move3d, wind: Wind, radio: Radio, radiation: Radiation };
const hazardNotes: Record<HazardId, { intro: string; unknown: string; next: string; kind?: FlagKind; action: string }> = {
  isolation: {
    intro: 'Sleep, energy, mood, and attention can be explored together. A shared pattern gives you something concrete to review.',
    unknown: 'These observations do not establish that isolation caused a change. Workload, interruptions, practice, and device latency can also affect attention.',
    next: 'Review your recent routine and the approved fatigue or wellbeing procedure. Record an action and a time to reassess.',
    kind: 'attention', action: 'Investigate attention & recovery',
  },
  gravity: {
    intro: 'Your movement diary adds functional context: how your estimated shoulder range changes under comparable recording conditions.',
    unknown: 'A camera-based shoulder estimate cannot measure bone density, muscle strength, or cardiovascular adaptation. Camera position and gravity must be comparable.',
    next: 'Review the source video and repeat the standardized movement in the same conditions. Note pain or stiffness for your approved review process.',
    kind: 'movement', action: 'Investigate movement',
  },
  environment: {
    intro: 'A closed habitat is part of the health picture. This prototype has no connection to cabin or environmental sensors.',
    unknown: 'There are no CO₂, temperature, pressure, microbial, or immune-function measurements here. A quiet dashboard cannot establish that the habitat or immune system is healthy.',
    next: 'Keep prescribed habitat and medical checks in your mission workflow. Add relevant equipment readings or context to your ground handoff.',
    action: 'Add habitat context below',
  },
  distance: {
    intro: 'When a conversation with Earth takes time, observations and decisions need to remain useful on board.',
    unknown: 'The delay below is a planning simulation. Browser connectivity does not confirm an available ground link, and GhostPilot has no transmission endpoint.',
    next: 'Try a communications blackout. Review evidence, choose an onboard action, then keep a dated handoff ready for later review.',
    action: 'Try the blackout drill below',
  },
  radiation: {
    intro: 'Radiation is an important mission hazard, but a reaction game and a movement diary are not exposure instruments.',
    unknown: 'No personal dosimeter or exposure telemetry is connected. Attention, fatigue, and pose changes cannot identify radiation injury or establish an exposure dose.',
    next: 'Use the mission’s prescribed dosimetry and exposure procedures. Record relevant context for an authorized medical review.',
    action: 'Add exposure context below',
  },
};

export default function MissionLens({ mission, online, onInvestigate, onSavePacket, onDownloaded, onCheckIn }: Props) {
  const [selectedHazard, setSelectedHazard] = useState<HazardId>('isolation');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [blackout, setBlackout] = useState(false);
  const [delay, setDelay] = useState(14);
  const [context, setContext] = useState('');
  const [packetNotice, setPacketNotice] = useState('');
  const [savingPacket, setSavingPacket] = useState(false);
  const records = useMemo(() => mission.checkIns.filter(c => c.simulated === mission.demo).sort((a, b) => a.date.localeCompare(b.date)), [mission.checkIns, mission.demo]);
  const index = Math.min(selectedIndex ?? records.length - 1, records.length - 1);
  const selected = records[index];
  const snapshot = useMemo(() => lensSnapshot(mission.checkIns, mission.demo, selected?.id), [mission.checkIns, mission.demo, selected?.id]);
  const hazard = lensHazards.find(h => h.id === selectedHazard)!;
  const note = hazardNotes[selectedHazard];
  const status = snapshot.statuses[selectedHazard];
  const sourceLabel = mission.demo ? 'Simulated mission' : 'Personal records';
  const packets = (mission.packets ?? []).filter(p => p.source === (mission.demo ? 'simulated' : 'recorded'));
  const visibleMetrics = (snapshot.metrics as Metric[]).filter(m => selectedHazard === 'gravity' ? m.key === 'leftRange' : selectedHazard === 'isolation' ? ['reactionMs', 'sleep', 'energy'].includes(m.key) : false);
  const statusLabel = status === 'review' ? 'Pattern to review' : status === 'context' ? 'Context available' : status === 'operational' ? 'Onboard planning' : 'Not measured';

  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => {
      const next = Math.min(index + 1, records.length - 1);
      setSelectedIndex(next);
      if (next >= records.length - 1) setPlaying(false);
    }, 1250);
    return () => clearTimeout(timer);
  }, [playing, index, records.length]);

  function seek(next: number) { setPlaying(false); setSelectedIndex(Math.max(0, Math.min(records.length - 1, next))); }
  async function savePacket() {
    setSavingPacket(true);
    setPacketNotice('');
    const packet = createMissionPacket({ snapshot, profile: mission.profile, actions: mission.actions, context: context.trim(), oneWayMinutes: delay, blackoutDrill: blackout, id: crypto.randomUUID(), createdAt: new Date().toISOString() }) as MissionPacket;
    try {
      await onSavePacket(packet);
      setPacketNotice(`Sol ${packet.sol} handoff saved on this device.`);
      setContext('');
    } catch {
      setPacketNotice('Handoff could not be saved. Your note is still here; check device storage and try again.');
    } finally { setSavingPacket(false); }
  }
  async function download(packet: MissionPacket) {
    // Export metadata is recorded in both the downloaded copy and local state.
    const exported = { ...packet, status: 'downloaded', downloadedAt: new Date().toISOString() };
    downloadFile(`ghostpilot-handoff-sol-${packet.sol}-${packet.id.slice(0, 8)}.json`, JSON.stringify(exported, null, 2), 'application/json');
    try {
      await onDownloaded(packet.id);
      setPacketNotice('Handoff downloaded. It has not been transmitted.');
    } catch { setPacketNotice('Handoff downloaded. Local export status could not be saved. Nothing has been transmitted.'); }
  }

  return <div className="mission-lens-page">
    <div className="lens-intro-strip"><span><Focus size={16}/> Your signals, in their mission context.</span><p>A monitoring map inspired by NASA’s five hazards. Connections show context, not causation.</p><a href={researchSources[0].url} target="_blank" rel="noreferrer">NASA background <ArrowUpRight size={13}/></a></div>
    <div className="lens-main-grid">
      <section className="panel constellation-panel" aria-label="Interactive mission hazard map">
        <div className="constellation-header"><span><span className="live-dot"/> MISSION LENS <b>05 HAZARDS / ONE YOU</b></span><span className="lens-source">{mission.demo ? 'SIMULATED HISTORY' : 'PERSONAL HISTORY'}</span></div>
        <div className="constellation-stage">
          <svg className="constellation-lines" viewBox="0 0 700 500" preserveAspectRatio="none" aria-hidden="true"><defs><radialGradient id="lens-halo"><stop offset="0" stopColor="#b0cb81" stopOpacity=".17"/><stop offset="1" stopColor="#b0cb81" stopOpacity="0"/></radialGradient></defs><ellipse cx="350" cy="250" rx="220" ry="220" fill="url(#lens-halo)"/><ellipse className="lens-orbit-path" cx="350" cy="250" rx="210" ry="180"/><ellipse className="lens-orbit-path inner" cx="350" cy="250" rx="148" ry="132"/>{lensHazards.map(h => <g key={h.id}><path className={`hazard-connection ${selectedHazard === h.id ? 'selected' : ''}`} d={`M350 250 Q${350 + (h.x - 50) * 3} ${250 + (h.y - 50) * 2} ${h.x * 7} ${h.y * 5}`} stroke={h.color}/><circle cx={h.x * 7} cy={h.y * 5} r="38" fill="none" stroke={h.color} opacity={selectedHazard === h.id ? .35 : .08}/></g>)}<path d="M342 35h16m-8-8v16M55 245h16m-8-8v16M629 245h16m-8-8v16M342 465h16m-8-8v16" stroke="#7a9a78" opacity=".3"/></svg>
          <div className="lens-center"><span className="lens-center-orbit"/><div className="lens-ghost"><Ghost size={48} strokeWidth={1}/><i/></div><small>YOUR PERSONAL ORBIT</small><strong>{selected ? `SOL ${String(selected.sol).padStart(3, '0')}` : 'FIRST CONTACT'}</strong><span>{snapshot.signals ? `${snapshot.signals} signals to explore` : selected ? 'Collecting the bigger picture' : 'Start with a check-in'}</span></div>
          {lensHazards.map(h => {
            const Icon = icons[h.icon as keyof typeof icons];
            const nodeStatus = snapshot.statuses[h.id as HazardId];
            return <button key={h.id} className={`hazard-node ${selectedHazard === h.id ? 'selected' : ''} ${nodeStatus === 'review' ? 'flagged' : ''}`} style={{ left: `${h.x}%`, top: `${h.y}%`, '--node-color': h.color } as React.CSSProperties} aria-pressed={selectedHazard === h.id} onClick={() => setSelectedHazard(h.id as HazardId)}><span className="sr-only">Explore </span><span className="hazard-node-circle"><Icon size={22} strokeWidth={1.3}/>{nodeStatus === 'review' && <i/>}</span><strong>{h.label}</strong>{' '}<small>{nodeStatus === 'review' ? 'REVIEW SIGNAL' : nodeStatus === 'context' ? 'CONTEXT AVAILABLE' : nodeStatus === 'operational' ? 'ONBOARD PLANNING' : 'NOT MEASURED'}</small></button>;
          })}
          <div className="map-coordinate">ARES / HUMAN SYSTEMS<br/>CONTEXT MAP · v1.0</div><div className="map-key"><span><i/> Pattern to review</span><span><i/> Context or gap</span></div>
        </div>
        <div className="lens-replay"><div className="lens-replay-heading"><span><ClockIcon/> REWIND YOUR MISSION</span><strong>{selected ? `${formatDate(selected.date)} · ${index + 1} of ${records.length} check-ins` : 'No observations yet'}</strong></div><div className="lens-replay-controls"><button className="lens-play" aria-label={playing ? 'Pause mission replay' : 'Play mission replay'} disabled={records.length < 2} onClick={() => { if (playing) setPlaying(false); else { if (index === records.length - 1) setSelectedIndex(0); setPlaying(true); } }}>{playing ? <Pause size={15}/> : <Play size={15}/>}</button><button className="icon-button" aria-label="Previous mission check-in" disabled={index <= 0} onClick={() => seek(index - 1)}><ChevronLeft size={15}/></button><input type="range" min="0" max={Math.max(0, records.length - 1)} value={Math.max(0, index)} aria-label="Mission replay timeline" disabled={!records.length} onChange={e => seek(Number(e.target.value))}/><button className="icon-button" aria-label="Next mission check-in" disabled={index >= records.length - 1} onClick={() => seek(index + 1)}><ChevronRight size={15}/></button><button className="latest-button" disabled={!records.length || index === records.length - 1} onClick={() => seek(records.length - 1)}>Latest <ArrowRight size={12}/></button></div><div className="replay-hint"><LockKeyhole size={11}/> Replay reads only the observations available at this moment. Saved records stay unchanged.</div></div>
      </section>
      <section className="panel lens-evidence-panel" aria-label="Selected hazard evidence"><div className="lens-evidence-header"><span className="eyebrow">HAZARD {hazard.number} / 05</span><span className={`pill ${status === 'review' ? 'amber' : 'neutral'}`}>{statusLabel}</span></div><h2>{hazard.label}.</h2><p className="lens-evidence-intro">{note.intro}</p>
        {visibleMetrics.length > 0 ? <><div className="lens-metric-head"><span>OBSERVATION</span><span>USUAL</span><span>LAST 3</span></div><div className="lens-metrics">{visibleMetrics.map(m => <div className={`lens-metric ${m.flag ? 'shifted' : ''}`} key={m.key}><span><strong>{m.label}</strong><small>{m.comparable ? m.flag ? `${m.change! > 0 ? '+' : ''}${m.change}% from baseline` : 'No prototype flag' : `Building evidence · ${m.recentCount}/3 recent samples`}</small></span><span>{m.baseline ?? '—'}<small>{m.unit}</small></span><span>{m.value ?? '—'}<small>{m.unit}</small></span></div>)}</div><div className="lens-data-note"><Info size={12}/><span>{snapshot.analysis.baselineRecords.length} earlier + {snapshot.analysis.recent.length} recent check-ins. {sourceLabel}. {selectedHazard === 'isolation' && snapshot.recentMood != null ? `Mood: ${snapshot.recentMood}/5.` : ''}</span></div></> : <div className="lens-gap"><CircleDashed size={28}/><strong>{selectedHazard === 'distance' ? 'Autonomy is part of the health loop.' : 'A visible gap is useful information.'}</strong><p>{selectedHazard === 'distance' ? 'Save your observations and decisions on board while waiting for a ground link.' : 'No connected measurement. This area is never shown as “all clear” from unrelated signals.'}</p></div>}
        <div className="lens-unknown"><ShieldQuestion size={17}/><div><h3>What we cannot tell</h3><p>{note.unknown}</p></div></div><div className="lens-next"><span className="eyebrow">A PRACTICAL NEXT STEP</span><p>{note.next}</p>{note.kind ? <button className="button primary full-width" onClick={() => onInvestigate(note.kind!, snapshot.records)}>{note.action}<ArrowRight size={15}/></button> : <a className="button secondary full-width" href="#mission-handoff" onClick={e => { e.preventDefault(); document.getElementById('mission-handoff')?.scrollIntoView({ behavior: 'smooth' }); }}>{note.action}<ArrowRight size={14}/></a>}</div>
        <HazardResearch hazard={selectedHazard}/>
      </section>
    </div>
    <section className={`panel autonomy-panel ${blackout ? 'blackout' : ''}`} id="mission-handoff"><div className="autonomy-top"><div><span className="eyebrow"><Satellite size={13}/> THE DISTANCE BETWEEN SIGNALS</span><h2>Your copilot stays on board.</h2><p>A ground conversation can take time. Keep evidence and decisions ready wherever the link stands.</p></div><button className={`blackout-toggle ${blackout ? 'active' : ''}`} aria-pressed={blackout} onClick={() => { setBlackout(!blackout); setPacketNotice(''); }}><Radio size={16}/>{blackout ? 'End blackout drill' : 'Try a comms blackout'}<span/></button></div>
      <div className="autonomy-grid"><div className="delay-visual"><div className="signal-route"><span><Ghost size={24}/><small>ON BOARD</small></span><div className={`signal-route-line ${blackout ? 'disconnected' : ''}`}><i/><i/><i/><b>{blackout ? 'BLACKOUT DRILL' : `${delay} MIN ONE WAY`}</b></div><span><OrbitEarth/><small>EARTH</small></span></div><label className="delay-label">Planning delay <strong>{delay} min <small>one way</small></strong><input type="range" aria-label="One-way planning delay" min="0" max="30" value={delay} onChange={e => setDelay(Number(e.target.value))}/></label><div className="delay-detail"><span>Earliest reply, before processing</span><strong>{delay * 2} minutes</strong></div><p className="connection-reality"><span className="status-dot"/>{online ? 'Browser online' : 'Browser offline'} · {blackout ? 'simulated blackout' : 'planning simulation'}<br/>No ground endpoint connected. No automatic transmission.</p></div>
      <div className="handoff-compose"><span className="handoff-kicker"><FileCheck2 size={15}/> A SNAPSHOT, READY FOR REVIEW</span><label htmlFor="handoff-context">What should ground know?</label><textarea id="handoff-context" rows={3} maxLength={2000} placeholder="Add workload, equipment readings, comparable conditions, or an action you took…" value={context} onChange={e => setContext(e.target.value)}/><div className="handoff-cutoff"><ScanLine size={13}/><span>{selected ? `Snapshot through Sol ${selected.sol} · ${formatDate(selected.date, { hour: '2-digit', minute: '2-digit' })} SGT` : 'Complete a check-in to create a snapshot.'}<small>Historical snapshots exclude later actions. Latest snapshots include actions logged before saving.</small></span></div><button className="button primary" disabled={!selected || savingPacket} onClick={savePacket}>{savingPacket ? 'Saving on board…' : 'Save onboard handoff'} <ArrowRight size={16}/></button>{!selected && <button className="text-link" onClick={onCheckIn}>Start your first check-in <ArrowRight size={13}/></button>}</div></div>
      {packetNotice && <div className="packet-notice" role="status"><Check size={14}/>{packetNotice}</div>}
      <div className="packet-shelf"><div className="packet-shelf-header"><h3>Onboard handoffs <span>{packets.length}</span></h3><span><LockKeyhole size={12}/> Stored on this device</span></div>{packets.length ? packets.slice().reverse().map(packet => <article className="packet-row" key={packet.id}><span className="packet-icon"><FileCheck2 size={20}/></span><div><strong>Sol {packet.sol} · {packet.source === 'simulated' ? 'Simulated' : 'Personal'} snapshot</strong><p>{packet.context || 'Observations and uncertainty, preserved for review.'}</p><small>{formatDate(packet.createdAt, { hour: '2-digit', minute: '2-digit' })} SGT · {packet.status === 'downloaded' ? 'Downloaded · not transmitted' : 'Queued on board · not transmitted'}{packet.communication.blackoutDrill ? ' · blackout drill' : ''}</small></div><button className="button secondary small" aria-label={`Download Sol ${packet.sol} handoff`} onClick={() => download(packet)}><Download size={14}/> Download</button></article>) : <div className="packet-empty">Your first handoff will appear here. It remains available after a reload, even offline.</div>}</div>
    </section>
    <ResearchContext/>
  </div>;
}

function ClockIcon() { return <Focus size={12}/>; }
function OrbitEarth() { return <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="14" r="10" fill="none" stroke="currentColor" strokeWidth="1"/><ellipse cx="14" cy="14" rx="4" ry="10" fill="none" stroke="currentColor" strokeWidth=".7"/><path d="M4 14h20M6 8q8 4 16 0M6 20q8-4 16 0" fill="none" stroke="currentColor" strokeWidth=".7"/></svg>; }

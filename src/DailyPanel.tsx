import { useState } from 'react';
import { recommendChecks } from './daily.mjs';
import type { MissionState, RegionId } from './types';

export type Recommendation = { checkId: string; field: string; region: string; title: string; seconds: number; reason: string; emergency: boolean };
export default function DailyPanel({ mission, onStart, onEmergency }: { mission: MissionState; onStart: (r: Recommendation & { region: RegionId }) => void; onEmergency: () => void }) {
  const [seconds, setSeconds] = useState(120);
  const [camera, setCamera] = useState(true);
  const choices: Recommendation[] = recommendChecks({ checkIns: mission.checkIns, simulated: mission.demo, references: mission.references, camera, seconds });
  const next = choices[0];
  const runs = (mission.checkRuns ?? []).filter(r => r.simulated === mission.demo);
  const completed = runs.filter(r => r.completedAt);
  return <section className="sheet daily-panel" aria-labelledby="daily-title">
    <div className="daily-heading"><h2 id="daily-title">Next useful check</h2><label className="daily-time">Time <select aria-label="Time available" value={seconds} onChange={e => setSeconds(Number(e.target.value))}><option value={60}>1 minute</option><option value={120}>2 minutes</option><option value={300}>5 minutes</option></select></label><label className="check"><input type="checkbox" checked={camera} onChange={e => setCamera(e.target.checked)}/> Camera available</label></div>
    {next ? <div className="daily-action"><div><b>{next.title}</b><p>{next.reason}</p><small>{next.seconds ? `${next.seconds} seconds · ` : ''}{mission.demo ? 'Demo data' : 'Your records'} · rule-based suggestion{['shoulder', 'legs'].includes(next.checkId) && ' · camera saves to personal records'}</small></div><button className="btn" onClick={() => next.emergency ? onEmergency() : onStart(next as Recommendation & { region: RegionId })}>{next.emergency ? 'Emergency' : 'Start check'}</button></div> : <p>No remaining checks match your time and equipment. Change the filters or use the body index.</p>}
    <details><summary>Why this order?</summary><p>Urgent reported symptoms, poor quality, unreliable camera comparisons, readings older than 3 days, missing readings, then today’s remaining checks. Shorter checks break ties. These are prototype rules.</p><p className="muted">{completed.length} of {runs.length} recommended checks completed on this device; {runs.filter(r => r.abandonedAt).length} left unfinished. Start and completion times are saved for usability evaluation; no faster-completion claim has been validated.</p></details>
  </section>;
}

import { useEffect, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowUpRight } from 'lucide-react';

export interface EdaExtract {
  mission: string; title: string;
  source: { url: string; portal: string; retrievedAt: string; sha256: string; radiationAnalysis: string; radiationReference: string };
  limitations: string; transformations: string;
  units: Record<string, string>;
  milestones?: Record<string, string>;
  telemetry: { time: string[]; co2_iss: (number | null)[]; co2_ground: (number | null)[]; temperature_iss: (number | null)[]; rh_iss: (number | null)[] };
  radiation: { time: string[]; gcr: number[]; saa: number[]; total: number[]; accumulated: number[] };
  summary: { samples: number; days: number; dose_accumulated: number; dose_total: { min: number; median: number; max: number }; co2_iss: { median: number; max: number }; temperature_iss: { median: number }; rh_iss: { median: number } };
}

let cache: Promise<EdaExtract> | null = null;
export const loadEda = () => (cache ??= fetch('/data/nasa-eda-rr-3.json').then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); }).catch(e => { cache = null; throw e; }));

export function useEda() {
  const [data, setData] = useState<EdaExtract | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { let on = true; loadEda().then(d => on && setData(d)).catch(() => on && setFailed(true)); return () => { on = false; }; }, []);
  return { data, failed };
}

const day = (t: string) => t.slice(5, 10);
// Below outdoor Earth air (~400 ppm) a sealed habitat reading is a sensor or install artefact: drawn as a gap, not a value.
const plausibleCo2 = (v: number | null) => v != null && v >= 400 ? v : null;
const axis = { fontSize: 12, fill: '#3b3a37', fontFamily: 'Barlow Condensed' };

/** Archived ISS readings from NASA's Environmental Data App, plotted without transformation beyond hourly medians. */
export default function NasaData({ series }: { series: 'dose' | 'air' }) {
  const { data, failed } = useEda();
  const [air, setAir] = useState<'co2' | 'temperature' | 'rh'>('co2');
  if (failed) return <p className="muted">NASA data could not be loaded.</p>;
  if (!data) return <p className="muted" role="status">Loading NASA data…</p>;
  const s = data.summary;
  // Habitat readings are plotted from the animals' transfer to the ISS; earlier hours are pre-installation.
  const transfer = (data.milestones?.['Animal transfer to ISS'] ?? data.telemetry.time[0]).slice(0, 13);
  const rows: Record<string, string | number | null>[] = series === 'dose'
    ? data.radiation.time.map((t, i) => ({ t: day(t), total: data.radiation.total[i], gcr: data.radiation.gcr[i], saa: data.radiation.saa[i] }))
    : data.telemetry.time.map((t, i) => ({ t, i })).filter(({ t, i }) => i % 6 === 0 && t >= transfer).map(({ t, i }) => ({ t: day(t), co2: plausibleCo2(data.telemetry.co2_iss[i]), temperature: data.telemetry.temperature_iss[i], rh: data.telemetry.rh_iss[i] }));
  return <figure className="nasa-data">
    <div className="figures">
      {series === 'dose' ? <>
        <div><b>{s.dose_total.median.toFixed(3)}</b><span>mGy / day median</span></div>
        <div><b>{s.dose_accumulated.toFixed(1)}</b><span>mGy over {s.days} days</span></div>
      </> : <>
        <div><b>{Math.round(s.co2_iss.median).toLocaleString()}</b><span>ppm CO₂ median</span></div>
        <div><b>{s.temperature_iss.median}</b><span>°C median</span></div>
        <div><b>{s.rh_iss.median}</b><span>% humidity</span></div>
      </>}
    </div>
    {series === 'air' && <div className="seg" role="group" aria-label="Habitat series">
      {(['co2', 'temperature', 'rh'] as const).map(k => <button key={k} aria-pressed={air === k} onClick={() => setAir(k)}>{k === 'co2' ? 'CO₂' : k === 'temperature' ? 'Temp' : 'Humidity'}</button>)}
    </div>}
    <div className="chart" role="img" aria-label={series === 'dose' ? `Daily absorbed dose on the ISS, ${data.radiation.time[0]} to ${data.radiation.time.at(-1)}` : `ISS habitat ${air} readings, hourly`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid stroke="#d9d3c3" vertical={false}/>
          <XAxis dataKey="t" tick={axis} interval="preserveStartEnd" minTickGap={28} stroke="#111"/>
          {series === 'dose' ? <YAxis tick={axis} stroke="#111" width={48} domain={[0, 0.3]} ticks={[0, 0.1, 0.2, 0.3]}/> : <YAxis tick={axis} stroke="#111" width={48} domain={['auto', 'auto']} allowDecimals={false}/>}
          <Tooltip contentStyle={{ background: '#f4f1e8', border: '1.5px solid #111', borderRadius: 0, fontFamily: 'Barlow' }}/>
          {series === 'dose'
            ? <><Line dataKey="total" name="Total mGy/day" stroke="#8e2a8b" strokeWidth={2} dot={false} isAnimationActive={false}/><Line dataKey="gcr" name="Galactic cosmic rays" stroke="#111" strokeWidth={1.2} strokeDasharray="4 3" dot={false} isAnimationActive={false}/><Line dataKey="saa" name="South Atlantic Anomaly" stroke="#7a7466" strokeWidth={1.2} dot={false} isAnimationActive={false}/></>
            : <Line dataKey={air} name={air === 'co2' ? 'CO₂ ppm' : air === 'temperature' ? '°C' : 'RH %'} stroke="#0f7c86" strokeWidth={1.6} dot={false} isAnimationActive={false}/>}
        </LineChart>
      </ResponsiveContainer>
    </div>
    <figcaption>
      {series === 'dose' ? 'Purple total · dashed galactic cosmic rays · grey South Atlantic Anomaly. ' : ''}NASA ISS record, {data.mission}, {series === 'dose' ? `${data.radiation.time[0]} – ${data.radiation.time.at(-1)}` : `from transfer to the ISS (${transfer.slice(0, 10)}) to ${data.telemetry.time.at(-1)!.slice(0, 10)}`}. {series === 'air' && air === 'co2' ? 'CO₂ under 400 ppm drawn as a gap. ' : ''}Archived context, not your exposure. <a href={data.source.portal} target="_blank" rel="noreferrer">NASA EDA <ArrowUpRight size={12}/></a>
    </figcaption>
  </figure>;
}

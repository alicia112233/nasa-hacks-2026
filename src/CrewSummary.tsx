import { Activity, ArrowRight, Heart, Moon, Move3d, Zap } from 'lucide-react';
import { formatDate } from './data';
import type { CheckIn, FlagKind } from './types';

interface Props {
  latest?: CheckIn;
  simulated: boolean;
  baselineCount: number;
  attentionDelta: number | null;
  movementDelta: number | null;
  attentionFlag: boolean;
  movementFlag: boolean;
  followUps: number;
  onReview: (kind: FlagKind) => void;
  onActions: () => void;
}

export default function CrewSummary({ latest, simulated, baselineCount, attentionDelta, movementDelta, attentionFlag, movementFlag, followUps, onReview, onActions }: Props) {
  const flags = Number(attentionFlag) + Number(movementFlag);
  const metrics = [
    { label: 'Heart rate', icon: Heart, value: latest?.heartRate, unit: 'bpm' },
    { label: 'Sleep quality', icon: Moon, value: latest?.sleep, unit: '/5' },
    { label: 'Mood', icon: Heart, value: latest?.mood, unit: '/5' },
    { label: 'Energy', icon: Zap, value: latest?.energy, unit: '/5' },
    { label: 'Attention', icon: Activity, value: latest?.reactionMs, unit: 'ms' },
    { label: 'Left shoulder', icon: Move3d, value: latest?.leftRange, unit: '° estimate' },
  ];

  return <section className="crew-summary" aria-labelledby="crew-summary-title">
    <div className="crew-summary-heading">
      <div><h2 id="crew-summary-title">Health at a glance</h2><p>{latest ? `Latest ${simulated ? 'simulated' : 'personal'} check-in · ${formatDate(latest.date, { hour: '2-digit', minute: '2-digit' })} SGT` : 'No personal check-in recorded yet.'}</p></div>
      <span className="summary-source">{simulated ? 'SIMULATED DATA' : 'PERSONAL DATA'}</span>
    </div>
    <dl className="crew-metrics">{metrics.map(({ label, icon: Icon, value, unit }) => <div key={label}><dt><Icon size={15} aria-hidden="true"/>{label}</dt><dd>{value != null ? <>{value}<small>{unit}</small></> : <span className="metric-missing">Not recorded</span>}</dd></div>)}</dl>
    <div className="crew-review">
      <strong>{flags ? `${flags} things to explore` : latest ? 'No prototype trend flags' : 'A quiet radar.'}</strong>
      <div className="crew-review-actions">
        {movementFlag && <button onClick={() => onReview('movement')}>Review shoulder · {movementDelta}% <ArrowRight size={14}/></button>}
        {attentionFlag && <button onClick={() => onReview('attention')}>Review attention · +{attentionDelta}% <ArrowRight size={14}/></button>}
        <button onClick={onActions}>{followUps} scheduled follow-ups <ArrowRight size={14}/></button>
      </div>
    </div>
    <p className="crew-summary-context"><span>{baselineCount} baseline check-ins · Trend flags compare medians, not a diagnosis.</span><span>Not measured: blood pressure, glucose, temperature, sleep duration.</span></p>
  </section>;
}

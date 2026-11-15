import { useMemo, useState } from 'react';
import { SIZES, chart, describe, eyeDone, visionValue } from './vision.mjs';

type Answer = 'clear' | 'blurry' | 'none';
const EYES = [{ id: 'left', label: 'Left eye', cover: 'Cover your right eye.' }, { id: 'right', label: 'Right eye', cover: 'Cover your left eye.' }] as const;
const OUTCOME = ['No change', 'Mild change', 'Strong change'];

/** Read each line at arm's length, one eye at a time, until a line can't be read. The worse eye gives the result. */
export default function VisionTest({ onSave }: { onSave: (value: number) => void }) {
  const lines = useMemo(() => [chart(), chart()], []);
  const [answers, setAnswers] = useState<Answer[][]>([[], []]);
  const [eye, setEye] = useState(0);
  const [paused, setPaused] = useState(false);
  const current = answers[eye];
  const finished = eyeDone(answers[0]) && eyeDone(answers[1]);
  const value = visionValue(answers[0], answers[1]);

  function answer(a: Answer) {
    const next = answers.map((list, i) => (i === eye ? [...list, a] : list));
    setAnswers(next);
    if (eye === 0 && eyeDone(next[0])) setPaused(true);
  }
  function restart() { setAnswers([[], []]); setEye(0); setPaused(false); }

  if (finished) return <div className="vision-test vision-result" role="status">
    <p className="vision-outcome"><b className={value ? 'off' : ''}>{OUTCOME[value]}</b></p>
    <dl>{EYES.map((e, i) => <div key={e.id}><dt>{e.label}</dt><dd>{describe(answers[i])}</dd></div>)}</dl>
    <div className="row-actions"><button className="btn primary" onClick={() => onSave(value)}>Save result</button><button className="link" onClick={restart}>Start again</button></div>
  </div>;

  if (paused) return <div className="vision-test" role="status">
    <p className="vision-step">Left eye: {describe(answers[0])}.</p>
    <p className="vision-cover">Now cover your left eye.</p>
    <button className="btn primary" onClick={() => { setPaused(false); setEye(1); }}>Start right eye</button>
  </div>;

  const level = current.length;
  return <div className="vision-test">
    <p className="vision-step"><b>{EYES[eye].label}</b> · {EYES[eye].cover} Line {level + 1} of {SIZES.length}</p>
    <ol className="vision-ticks" aria-hidden="true">{SIZES.map((_, i) => <li key={i} className={i < level ? (current[i] === 'clear' ? 'done' : 'off') : i === level ? 'next' : ''}/>)}</ol>
    <p className="vision-line" style={{ fontSize: SIZES[level] }} aria-label={`Line ${level + 1}: ${lines[eye][level].split('').join(' ')}`}>{lines[eye][level]}</p>
    <div className="choices" role="group" aria-label={`Can you read line ${level + 1}?`}>
      <button onClick={() => answer('clear')}>Clear</button>
      <button onClick={() => answer('blurry')}>Blurry</button>
      <button onClick={() => answer('none')}>Can’t see</button>
    </div>
  </div>;
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Camera } from 'lucide-react';
import type { PoseLandmarker } from '@mediapipe/tasks-vision';
import Dialog from './Dialog';
import { cameraMessage, loadPose, openCamera } from './pose';
import { MIN_FRAMES, SHAPE, frameIssue, measureFrame, summarise, thighCm } from './scan.mjs';
import { BUILDS, LIMITS, detectShape, physique } from './physique.mjs';
import type { BodyScan as Scan, Profile } from './types';

/**
 * setup (Mission → Crew): suggests body shape and build, fits shoulders, waist and hips, and starts the leg ghost.
 * legs (Body → H Legs): thigh breadth against the crew member's ghost.
 */
export type ScanMode = 'setup' | 'legs';
interface Props {
  mode: ScanMode;
  profile: Profile;
  ghostCm: number | null;
  onClose: () => void;
  onSave: (scan: Scan, choice: { sex?: Profile['sex']; build?: Profile['build'] }) => void;
}
type Measured = NonNullable<ReturnType<typeof measureFrame>>;

const SECONDS = 5;
/** Usable frames in a row (about a second at the detection rate) before the scan starts itself. */
const STEADY = 6;
const MAX_SECONDS = 15;
const LABEL: Record<string, string> = { shoulders: 'Shoulders', waist: 'Waist', hips: 'Hips', female: 'Female', male: 'Male', slight: 'Slight', average: 'Average', muscular: 'Muscular' };
/** Person mask tint, from --amber. */
const TINT = [224, 161, 0, 96];

export const percent = (x: number) => `${x > 0.005 ? '+' : x < -0.005 ? '−' : ''}${Math.abs(Math.round(x * 100))}%`;
const Bar = ({ value }: { value: number }) => <dd className="scan-bar" aria-hidden="true"><i style={{ left: `${50 + Math.max(-50, Math.min(50, value * 500))}%` }}/></dd>;

export default function BodyScan({ mode, profile, ghostCm, onClose, onSave }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const tracker = useRef<PoseLandmarker | null>(null);
  const frames = useRef<Measured[]>([]);
  const started = useRef(0);
  const mounted = useRef(true);
  /** Bumped on every camera start and on unmount, so a start that resolves late (or twice, in dev StrictMode) backs off. */
  const run = useRef(0);
  /** Consecutive usable frames while waiting; the scan starts itself after STEADY of them. */
  const steady = useRef(0);
  const [status, setStatus] = useState<'intro' | 'loading' | 'ready' | 'scanning' | 'done'>('intro');
  const [issue, setIssue] = useState<string | null>('Step back');
  const [remaining, setRemaining] = useState(SECONDS);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Scan | null>(null);
  const [sex, setSex] = useState<NonNullable<Profile['sex']>>('female');
  const [build, setBuild] = useState<NonNullable<Profile['build']>>('average');
  const hasHeight = typeof profile.heightCm === 'number' && profile.heightCm >= LIMITS.heightCm[0] && profile.heightCm <= LIMITS.heightCm[1];
  // The Legs check reports centimetres, so it needs height as its ruler; the setup scan doesn't.
  const needsHeight = mode === 'legs' && !hasHeight;
  // The setup scan reads weight itself, so a typed mass is left out of its guess (saving the scan clears it).
  const scanned = { ...profile, massKg: undefined };

  const stopCamera = () => { stream.current?.getTracks().forEach(t => t.stop()); stream.current = null; };
  // Opening the scan is the request for the camera, so it starts at once.
  useEffect(() => {
    mounted.current = true;
    if (!needsHeight) void enableCamera();
    return () => { mounted.current = false; run.current++; stopCamera(); tracker.current?.close(); tracker.current = null; };
  }, []);

  async function enableCamera() {
    const id = ++run.current;
    const stale = () => id !== run.current || !mounted.current;
    setStatus('loading');
    setError('');
    steady.current = 0;
    try {
      const media = await openCamera();
      if (stale()) { media.getTracks().forEach(t => t.stop()); return; }
      stream.current = media;
      if (video.current) { video.current.srcObject = media; await video.current.play(); }
      const landmarker = tracker.current ?? await loadPose({ segmentation: true });
      if (stale()) { if (landmarker !== tracker.current) landmarker.close(); return; }
      tracker.current = landmarker;
      setStatus('ready');
    } catch (err) {
      if (stale()) return;
      stopCamera();
      setError(cameraMessage(err, 'the body scan'));
      setStatus('intro');
    }
  }

  useEffect(() => {
    if (status !== 'ready' && status !== 'scanning') return;
    let frameId = 0;
    let lastVideoTime = -1;
    let timer: ReturnType<typeof setTimeout>;
    let image: ImageData | null = null;
    const detect = (now: number) => {
      timer = setTimeout(() => { frameId = requestAnimationFrame(detect); }, 150);
      const element = video.current;
      if (!element || element.readyState < 2 || !tracker.current || element.currentTime === lastVideoTime) return;
      lastVideoTime = element.currentTime;
      let m: Measured | null = null;
      try {
        const result = tracker.current.detectForVideo(element, now);
        const pose = result.landmarks[0], mask = result.segmentationMasks?.[0];
        const context = canvas.current?.getContext('2d');
        if (pose && mask) {
          const data = mask.getAsFloat32Array();
          m = measureFrame(data, mask.width, mask.height, pose);
          if (context) {
            if (!image || image.width !== mask.width || image.height !== mask.height) image = context.createImageData(mask.width, mask.height);
            const px = image.data;
            for (let i = 0; i < data.length; i++) {
              const o = i * 4;
              px[o] = TINT[0]; px[o + 1] = TINT[1]; px[o + 2] = TINT[2]; px[o + 3] = data[i] >= 0.5 ? TINT[3] : 0;
            }
            context.putImageData(image, 0, 0);
          }
        } else context?.clearRect(0, 0, 640, 480);
        if (context && m) {
          for (const [key, line] of Object.entries(m.lines)) {
            if (!line) continue;
            const thigh = key.startsWith('thigh');
            const [x1, y1, x2, y2] = line;
            context.strokeStyle = context.fillStyle = mode === 'legs' && thigh ? '#e0a100' : '#f4f1e8';
            context.lineWidth = mode === 'legs' ? (thigh ? 4 : 1.5) : 3;
            context.beginPath(); context.moveTo(x1, y1); context.lineTo(x2, y2); context.stroke();
            for (const [x, y] of [[x1, y1], [x2, y2]]) { context.beginPath(); context.arc(x, y, 4, 0, Math.PI * 2); context.fill(); }
          }
        }
        result.close();
      } catch (err) {
        setError(`Body tracking paused: ${err instanceof Error ? err.message : String(err)}`);
      }
      const why = frameIssue(m);
      setIssue(why);
      // No button to press and then walk back from: once the whole body has been in view for a moment, it scans.
      if (status === 'ready') {
        steady.current = !why && m ? steady.current + 1 : 0;
        if (steady.current >= STEADY) begin();
        return;
      }
      if (!why && m) frames.current.push(m);
      const elapsed = (now - started.current) / 1000;
      setRemaining(Math.max(0, SECONDS - elapsed));
      if ((elapsed >= SECONDS && frames.current.length >= MIN_FRAMES) || elapsed >= MAX_SECONDS) finish();
    };
    frameId = requestAnimationFrame(detect);
    return () => { cancelAnimationFrame(frameId); clearTimeout(timer); };
  }, [status, mode]);

  function begin() {
    frames.current = [];
    started.current = performance.now();
    setError('');
    setRemaining(SECONDS);
    setStatus('scanning');
  }

  function finish() {
    const summary = summarise(frames.current);
    if (!summary) {
      setError(`Only ${frames.current.length} clear frames. Step back until your feet show, arms a little out, and scan again.`);
      setStatus('ready');
      return;
    }
    stopCamera();
    const scan: Scan = { date: new Date().toISOString(), ...summary };
    if (mode === 'setup') {
      const guess = detectShape(scanned, scan);
      const detected = { sex: guess.sex as NonNullable<Profile['sex']>, build: guess.build as NonNullable<Profile['build']>, weight: guess.weight, sure: guess.sure };
      scan.detected = detected;
      setSex(detected.sex);
      setBuild(detected.build);
    }
    setResult(scan);
    setStatus('done');
  }

  const cm = result ? thighCm(result, profile.heightCm) : null;
  const fit = useMemo(() => (result && mode === 'setup' ? physique({ ...profile, massKg: undefined, sex, build, scan: result }).scan : null), [result, mode, profile, sex, build]);
  const live = status === 'ready' || status === 'scanning';
  const legChange = cm != null && ghostCm ? cm / ghostCm - 1 : null;

  return <Dialog title={mode === 'legs' ? `Leg outline · ${SECONDS} s` : `Body scan · ${SECONDS} s`} onClose={onClose} label="Close body scan">
    {status !== 'done' && <div className={`camera-preview ${live ? '' : 'empty'}`}>
      <video ref={video} muted playsInline/><canvas ref={canvas} width={640} height={480}/>
      {!live && <div className="camera-empty"><Camera size={40}/><strong>{status === 'loading' ? 'Starting camera…' : needsHeight ? 'Add your height first.' : 'Camera off.'}</strong>{needsHeight && <span>Crew card, step 2. It is the scan’s ruler.</span>}</div>}
      {live && <div className="tracking-status" aria-live="polite"><i className={`status-dot ${issue ? 'amber' : ''}`}/>{issue ?? (status === 'scanning' ? 'Hold still' : 'Body found')}{status === 'scanning' && <strong>{Math.ceil(remaining)} S</strong>}</div>}
    </div>}
    {error && <p className="error" role="alert"><AlertCircle size={16}/> {error}</p>}

    {status === 'done' && result && mode === 'setup' && result.detected && fit && <>
      <div className="scan-picks">
        <div className="scan-pick">
          <span id="pick-body">Body</span>
          <div className="seg" role="group" aria-labelledby="pick-body">{(['female', 'male'] as const).map(v => <button key={v} aria-pressed={sex === v} onClick={() => setSex(v)}>{LABEL[v]}</button>)}</div>
          <small>{result.detected.sure.sex ? 'From scan' : 'Not sure'}</small>
        </div>
        <div className="scan-pick">
          <span id="pick-build">Build</span>
          <div className="seg" role="group" aria-labelledby="pick-build">{(BUILDS as NonNullable<Profile['build']>[]).map(v => <button key={v} aria-pressed={build === v} onClick={() => setBuild(v)}>{LABEL[v]}</button>)}</div>
          <small>{result.detected.sure.build ? 'From scan' : 'Not sure'}</small>
        </div>
      </div>
      <dl className="scan-result" aria-label="Proportions compared with that body">
        {SHAPE.map(m => <div key={m}><dt>{LABEL[m]}</dt><Bar value={fit.relative[m]}/><dd className="scan-value">{percent(fit.relative[m])}</dd></div>)}
      </dl>
      <p className="muted">Compared with a typical {LABEL[build].toLowerCase()} {LABEL[sex].toLowerCase()} body of your weight.{cm != null && ` Thigh ${cm} cm starts your leg ghost.`} {result.frames} frames.</p>
    </>}

    {status === 'done' && result && mode === 'legs' && <>
      <dl className="scan-result" aria-label="Thigh breadth">
        <div><dt>Thigh</dt>{legChange != null ? <Bar value={legChange}/> : <dd className="scan-bar" aria-hidden="true"/>}<dd className="scan-value">{cm != null ? `${cm} cm` : '—'}</dd></div>
      </dl>
      <p className="muted">{legChange != null ? `${percent(legChange)} against your ghost of ${ghostCm!.toFixed(1)} cm.` : 'First outline. It starts your ghost.'} Zero-g fluid shift alone thins legs up to 6% in the first days (NASA HIDH). {result.frames} frames.</p>
    </>}

    {status !== 'done' && <ol className="steps compact"><li><span>Step back until your feet show</span></li><li><span>Arms straight, a little out</span></li><li><span>Hold still. It scans by itself.</span></li></ol>}
    {status === 'intro' && !needsHeight && <button className="btn primary" onClick={() => void enableCamera()}><Camera size={16}/> Try again</button>}
    {status === 'done' && result && <div className="scan-actions">
      <button className="btn primary" onClick={() => onSave(result, mode === 'setup' ? { sex, build } : {})}>{mode === 'setup' ? 'Use scan' : 'Save'}</button>
      <button className="btn ghost" onClick={() => { setResult(null); void enableCamera(); }}>Retake</button>
    </div>}
    <p className="muted">Runs on this device. Nothing is recorded; only body ratios are kept.</p>
  </Dialog>;
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Camera, Maximize, Minimize, Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import type { PoseLandmarker } from '@mediapipe/tasks-vision';
import Dialog from './Dialog';
import FigurePreview from './FigurePreview';
import useScanAudio from './useScanAudio';
import { scanGuidance } from './scan-guide.mjs';
import calibration from './body-calibration.mjs';
import { cameraMessage, loadPose, openCamera } from './pose';
import { MEASURES, MIN_FRAMES, compareScan, frameIssue, measureFrame, scanSpread, summarise, thighCm } from './scan.mjs';
import { BUILDS, LIMITS, detectShape, physique } from './physique.mjs';
import type { BodyScan as Scan, Profile } from './types';

/**
 * setup: fits the chosen avatar model, estimates build, fits shoulders, waist and hips, and starts the leg ghost.
 * legs (Body → H Legs): thigh breadth against the crew member's ghost.
 * Both record the seconds they measured, lines included, so the result can be checked against the footage.
 * The clip lives in memory and is dropped on retake or close.
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
/** The recorded seconds as an object URL, how long they ran, and the picture's width / height. */
interface Clip { url: string; seconds: number; aspect: number }

const SECONDS = 5;
/** Usable frames in a row (about a second at the detection rate) before the scan starts itself. */
const STEADY = 6;
const MAX_SECONDS = 15;
const LABEL: Record<string, string> = { shoulders: 'Shoulders', waist: 'Waist', hips: 'Hips', thighs: 'Thighs', arms: 'Upper arms', female: 'Female', male: 'Male', slight: 'Slight', average: 'Average', muscular: 'Muscular' };
/** Person mask tint, from --amber. */
const TINT = [224, 161, 0, 96];
/** Half-width of the result bars: a mark at the edge is this far from the baseline, or further. */
const SCALE = { setup: 0.2, legs: 0.1 };

export const percent = (x: number) => `${x > 0.005 ? '+' : x < -0.005 ? '−' : ''}${Math.abs(Math.round(x * 100))}%`;
const within = (spread: number) => `±${Math.max(1, Math.ceil(spread * 100 - 1e-9))}%`;
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[s.length >> 1] : 0.5; };

/** One measure on a shared scale: the ink block is the measurement, the open square the figure, the band the frame scatter. */
function Bar({ you, figure, spread = 0, scale }: { you: number; figure?: number; spread?: number; scale: number }) {
  const at = (v: number) => 50 + Math.max(-50, Math.min(50, (v / scale) * 50));
  return <dd className="scan-bar" aria-hidden="true">
    {spread > 0 && <span className="band" style={{ left: `${at(you - spread)}%`, width: `${at(you + spread) - at(you - spread)}%` }}/>}
    {figure != null && <span className="fig" style={{ left: `${at(figure)}%` }}/>}
    <i style={{ left: `${at(you)}%` }}/>
  </dd>;
}

/** The recorded seconds, looping, with pause and a scrubber. portrait: cropped to the person, beside the figure. */
function ClipReview({ clip, centre = 0.5, portrait, caption }: { clip: Clip | null | undefined; centre?: number; portrait?: boolean; caption: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [length, setLength] = useState(clip?.seconds ?? 0);

  useEffect(() => {
    const v = ref.current;
    if (!v || !clip) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let fixing = false;
    const start = () => { if (!still) void v.play().catch(() => {}); };
    // A recording made in the browser carries no duration, so it can't be scrubbed until the player has seen its end.
    const onMeta = () => { if (Number.isFinite(v.duration)) { setLength(v.duration); start(); } else { fixing = true; v.currentTime = 1e101; } };
    const onTime = () => {
      if (fixing) {
        if (!Number.isFinite(v.duration) || v.duration <= 0) return;
        fixing = false; setLength(v.duration); v.currentTime = 0; start(); return;
      }
      setTime(v.currentTime);
    };
    const onDuration = () => { if (Number.isFinite(v.duration) && v.duration > 0) { setLength(v.duration); if (fixing) onTime(); } };
    const onPlay = () => setPlaying(true), onPause = () => setPlaying(false);
    v.addEventListener('loadedmetadata', onMeta); v.addEventListener('timeupdate', onTime); v.addEventListener('durationchange', onDuration);
    v.addEventListener('play', onPlay); v.addEventListener('pause', onPause);
    if (v.readyState >= 1) onMeta();
    return () => { v.removeEventListener('loadedmetadata', onMeta); v.removeEventListener('timeupdate', onTime); v.removeEventListener('durationchange', onDuration); v.removeEventListener('play', onPlay); v.removeEventListener('pause', onPause); };
  }, [clip]);

  // Keep the person in the middle of a portrait crop of a landscape recording.
  const k = clip ? clip.aspect / (3 / 4) : 1;
  const position = portrait && k > 1 ? `${Math.max(0, Math.min(1, (0.5 - centre * k) / (1 - k))) * 100}% 50%` : undefined;
  const shown = Math.min(time, length);

  return <figure className={`scan-shot ${portrait ? '' : 'landscape'}`}>
    <div className="clip-frame">
      <div className="clip-picture">
        {clip ? <video ref={ref} src={clip.url} loop muted playsInline preload="auto" aria-label="Recorded scan clip" style={{ objectPosition: position }}/>
          : <div className="camera-empty"><Camera size={32}/><strong>{clip === undefined ? 'Preparing clip…' : 'No clip'}</strong>{clip === null && <span>This browser can’t record video. The measurements are unaffected.</span>}</div>}
      </div>
      {/* Under the picture, not over it: the feet and the thigh lines stay in view. */}
      {clip && <div className="clip-controls">
          <button className="icon-btn" aria-label={playing ? 'Pause clip' : 'Play clip'} onClick={() => { const v = ref.current; if (v) void (v.paused ? v.play() : v.pause()); }}>{playing ? <Pause size={18}/> : <Play size={18}/>}</button>
          <input type="range" aria-label="Clip position" min={0} max={length || 1} step={0.05} value={shown} aria-valuetext={`${shown.toFixed(1)} of ${length.toFixed(1)} seconds`}
            onChange={e => { const v = ref.current; if (v) { v.currentTime = Number(e.currentTarget.value); setTime(v.currentTime); } }}/>
          <span>{shown.toFixed(1)} s</span>
      </div>}
    </div>
    <figcaption>{caption}</figcaption>
  </figure>;
}

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
  /** Frames analysed during the scan (usable or not), where the person stood (a fraction of the frame width), and whether the recording is wanted. */
  const seen = useRef(0);
  const centre = useRef(0.5);
  const keepClip = useRef(false);
  const clipUrl = useRef('');
  const [status, setStatus] = useState<'intro' | 'loading' | 'ready' | 'scanning' | 'done'>('intro');
  const [issue, setIssue] = useState<string | null>('Step back');
  const [remaining, setRemaining] = useState(SECONDS);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Scan | null>(null);
  /** undefined: still being put together; null: this browser can't record. */
  const [clip, setClip] = useState<Clip | null | undefined>(undefined);
  const [sex, setSex] = useState<Profile['sex']>(profile.sex);
  const [build, setBuild] = useState<NonNullable<Profile['build']>>('average');
  const [buildChosen, setBuildChosen] = useState(false);
  // An unselected model is only a labelled preview; saving requires an explicit choice.
  const model = sex ?? 'female';
  const [fullscreen, setFullscreen] = useState(!!document.fullscreenElement);
  const [fullscreenError, setFullscreenError] = useState('');
  const ownsFullscreen = useRef(false);
  const hasHeight = typeof profile.heightCm === 'number' && profile.heightCm >= LIMITS.heightCm[0] && profile.heightCm <= LIMITS.heightCm[1];
  // The Legs check reports centimetres, so it needs height as its ruler; the setup scan doesn't.
  const needsHeight = mode === 'legs' && !hasHeight;
  const guide = scanGuidance({ status, issue, remaining, needsHeight, error: !!error });
  const voice = useScanAudio(guide.id, guide.repeat);
  function fitModel(scan: Scan, bodyModel: NonNullable<Profile['sex']>): NonNullable<Scan['detected']> {
    // Fit proportions within the chosen model. A silhouette must never replace that choice.
    const fit = detectShape({ ...profile, massKg: undefined, sex: bodyModel }, scan);
    return { sex: bodyModel, build: fit.build as NonNullable<Profile['build']>, weight: fit.weight, weights: fit.weights, sure: fit.sure };
  }

  function chooseModel(bodyModel: NonNullable<Profile['sex']>) {
    setSex(bodyModel);
    if (result) {
      const detected = fitModel(result, bodyModel);
      setResult({ ...result, detected });
      if (!buildChosen) setBuild(detected.build);
    }
  }

  useEffect(() => {
    const changed = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', changed);
    return () => {
      document.removeEventListener('fullscreenchange', changed);
      if (ownsFullscreen.current && document.fullscreenElement === document.documentElement) void document.exitFullscreen().catch(() => {});
    };
  }, []);

  async function toggleFullscreen() {
    setFullscreenError('');
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else {
        await document.documentElement.requestFullscreen();
        if (mounted.current) ownsFullscreen.current = true;
        else if (document.fullscreenElement) await document.exitFullscreen();
      }
    } catch { if (mounted.current) setFullscreenError('Full screen is unavailable here. The scan still fills this window.'); }
  }

  const stopCamera = () => { stream.current?.getTracks().forEach(t => t.stop()); stream.current = null; };
  const dropClip = () => { if (clipUrl.current) URL.revokeObjectURL(clipUrl.current); clipUrl.current = ''; setClip(undefined); };
  // Opening the scan is the request for the camera, so it starts at once.
  useEffect(() => {
    mounted.current = true;
    if (!needsHeight) void enableCamera();
    return () => { mounted.current = false; run.current++; stopCamera(); tracker.current?.close(); tracker.current = null; if (clipUrl.current) URL.revokeObjectURL(clipUrl.current); };
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
        const board = canvas.current;
        // The overlay takes the camera's own size, so the lines sit on the body whatever shape the camera delivers.
        if (board && mask && (board.width !== mask.width || board.height !== mask.height)) { board.width = mask.width; board.height = mask.height; }
        const context = board?.getContext('2d');
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
        } else if (board) context?.clearRect(0, 0, board.width, board.height);
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
      seen.current++;
      if (!why && m) frames.current.push(m);
      const elapsed = (now - started.current) / 1000;
      setRemaining(Math.max(0, SECONDS - elapsed));
      if ((elapsed >= SECONDS && frames.current.length >= MIN_FRAMES) || elapsed >= MAX_SECONDS) finish();
    };
    frameId = requestAnimationFrame(detect);
    return () => { cancelAnimationFrame(frameId); clearTimeout(timer); };
  }, [status, mode]);

  // The footage: the camera picture with the outline and measuring lines drawn on it, exactly as it was measured.
  useEffect(() => {
    if (status !== 'scanning') return;
    const element = video.current, board = canvas.current;
    const film = document.createElement('canvas');
    film.width = element?.videoWidth || 640; film.height = element?.videoHeight || 480;
    const context = film.getContext('2d');
    let recorder: MediaRecorder | null = null;
    const chunks: BlobPart[] = [];
    let frameId = 0;
    let capture: MediaStream | null = null;
    const t0 = performance.now();
    if (element && board && context && typeof MediaRecorder !== 'undefined' && typeof film.captureStream === 'function') {
      try {
        const mimeType = ['video/webm;codecs=vp9', 'video/webm', 'video/mp4'].find(type => MediaRecorder.isTypeSupported(type));
        capture = film.captureStream(30);
        const track = capture.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
        const draw = () => {
          frameId = requestAnimationFrame(draw);
          context.drawImage(element, 0, 0, film.width, film.height);
          context.drawImage(board, 0, 0, film.width, film.height);
          track.requestFrame?.();
        };
        recorder = new MediaRecorder(capture, mimeType ? { mimeType } : {});
        recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
        recorder.start();
        // Paint after recording starts, so even a still camera provides the first frame immediately.
        draw();
      } catch { recorder = null; capture?.getTracks().forEach(t => t.stop()); }
    }
    return () => {
      cancelAnimationFrame(frameId);
      const seconds = (performance.now() - t0) / 1000, keep = keepClip.current;
      if (!recorder || recorder.state === 'inactive') { capture?.getTracks().forEach(t => t.stop()); if (keep) setClip(null); return; }
      const type = recorder.mimeType;
      recorder.onstop = () => {
        capture?.getTracks().forEach(t => t.stop());
        if (!keep || !mounted.current || !chunks.length) { if (keep && mounted.current) setClip(null); return; }
        clipUrl.current = URL.createObjectURL(new Blob(chunks, { type }));
        setClip({ url: clipUrl.current, seconds, aspect: film.width / film.height });
      };
      recorder.stop();
    };
  }, [status]);

  function begin() {
    frames.current = [];
    seen.current = 0;
    keepClip.current = false;
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
    keepClip.current = true;
    const lines = frames.current.map(m => (m.lines.shoulders[0] + m.lines.shoulders[2]) / 2 / (canvas.current?.width || 640));
    centre.current = median(lines);
    stopCamera();
    const scan: Scan = { date: new Date().toISOString(), ...summary };
    if (mode === 'setup') {
      const detected = fitModel(scan, model);
      scan.detected = detected;
      if (!buildChosen) setBuild(detected.build);
    }
    setResult(scan);
    setStatus('done');
  }

  const cm = result ? thighCm(result, profile.heightCm) : null;
  // The figure this scan gives, and both of them against the standard figure.
  const fitted = useMemo(() => (result && mode === 'setup' ? physique({ ...profile, massKg: undefined, sex: model, build, scan: result }) : null), [result, mode, profile, model, build]);
  const compare = useMemo(() => (result && fitted ? compareScan(result, fitted.weights) : null), [result, fitted]);
  const live = status === 'ready' || status === 'scanning';
  const legChange = cm != null && ghostCm ? cm / ghostCm - 1 : null;
  const spread = scanSpread(result);
  const agree = result && spread != null ? `${result.frames} frames agree within ${within(spread)}.` : '';
  const clipCaption = result ? `Clip · ${clip ? `${Math.round(clip.seconds)} s · ` : ''}${result.frames} of ${Math.max(seen.current, result.frames)} frames used` : '';
  const buildSource = () => {
    const d = result?.detected;
    return buildChosen || !d || d.build !== build ? 'Set by you' : d.sure.build ? 'Estimated from scan' : 'Best guess. Check it.';
  };
  const retake = () => { setResult(null); dropClip(); void enableCamera(); };

  return <Dialog title={mode === 'legs' ? `Leg outline · ${SECONDS} s` : `Body scan · ${SECONDS} s`} fullScreen onClose={onClose} label="Close body scan">
    <div className={`scan-session ${status === 'done' ? 'review' : 'capture'}`} data-status={status}>
    <div className="scan-controls">
      <button className="btn" aria-pressed={!voice.muted} onClick={voice.toggle}>{voice.muted ? <VolumeX size={20} aria-hidden="true"/> : <Volume2 size={20} aria-hidden="true"/>}Voice guide {voice.muted ? 'off' : 'on'}</button>
      <button className="btn" disabled={voice.muted} onClick={voice.repeat}><RotateCcw size={18} aria-hidden="true"/>{voice.problem === 'blocked' ? 'Enable voice guide' : 'Repeat instruction'}</button>
      {document.fullscreenEnabled && <button className="btn scan-fullscreen" onClick={() => void toggleFullscreen()}>{fullscreen ? <Minimize size={18} aria-hidden="true"/> : <Maximize size={18} aria-hidden="true"/>}{fullscreen ? 'Exit full screen' : 'Full screen'}</button>}
      <span className="scan-volume-note">{voice.muted ? 'Follow the on-screen guide.' : 'Turn up your device volume before stepping back.'}</span>
      {voice.problem && !voice.muted && <p className="scan-audio-note" role="status">{voice.problem === 'blocked' ? 'Tap Enable voice guide before stepping back.' : 'Audio could not play. Try Repeat instruction or follow the on-screen guide.'}</p>}
      {fullscreenError && <p className="scan-audio-note" role="status">{fullscreenError}</p>}
    </div>
    {status !== 'done' ? <div className={`camera-preview scan-camera ${live ? '' : 'empty'}`}>
      <video ref={video} muted playsInline aria-label="Live body scan camera"/><canvas ref={canvas} width={640} height={480}/>
      <div className="scan-guidance">
        <div className="scan-prompt" role="status" aria-live="polite" aria-atomic="true"><h3>{guide.title}</h3><p>{guide.detail}</p></div>
        {guide.count != null && <output className="scan-count" aria-label="Seconds remaining" aria-live="off">{guide.count}<span>s</span></output>}
      </div>
      <p className="scan-position-reminder">Feet in view · Arms a little out · Hold still</p>
    </div> : <div className="scan-complete" role="status"><h3>{guide.title}</h3><p>{guide.detail}</p></div>}
    {error && <p className="error scan-error" role="alert"><AlertCircle size={16}/> {error}</p>}

    {status === 'done' && result && mode === 'setup' && result.detected && fitted && compare && <>
      <div className="scan-review">
        {/* What was measured, what it made, and the two answers that shape the figure. */}
        <div className="scan-side">
          <div className="scan-evidence">
            <ClipReview clip={clip} centre={centre.current} portrait caption={clipCaption}/>
            <figure className="scan-shot">
              <FigurePreview weights={fitted.weights}/>
              <figcaption>{sex ? `Your figure · ${LABEL[sex]} · ${LABEL[build]}` : 'Avatar preview · choose a model below'}</figcaption>
            </figure>
          </div>
          <div className="scan-picks">
            <p id="scan-model-note">Your avatar model is your choice. The scan fits its proportions.</p>
            <div className="scan-pick">
              <span id="pick-body">Avatar model</span>
              <div><div className="seg" role="group" aria-labelledby="pick-body" aria-describedby="scan-model-note">{(['female', 'male'] as const).map(v => <button key={v} aria-pressed={sex === v} onClick={() => chooseModel(v)}>{LABEL[v]}</button>)}</div><small role="status">{sex ? 'Kept for rescans' : 'Choose a model before saving'}</small></div>
            </div>
            <div className="scan-pick">
              <span id="pick-build">Build</span>
              <div><div className="seg" role="group" aria-labelledby="pick-build">{(BUILDS as NonNullable<Profile['build']>[]).map(v => <button key={v} aria-pressed={build === v} onClick={() => { setBuild(v); setBuildChosen(true); }}>{LABEL[v]}</button>)}</div><small>{buildSource()}</small></div>
            </div>
          </div>
          <dl className="how-why scan-notes">
            <div><dt>Figure</dt><dd>The app’s 3D model reshaped toward you, not a 3D copy of you. A gap between the two marks is what it could not follow.</dd></div>
          </dl>
        </div>
        {/* The numbers, then what they are measured against and how far to trust them. */}
        <div className="scan-side">
          <div>
            <p className="scan-axis" aria-hidden="true">
              <span className="scan-key"><i className="mark-you"/>You<i className="mark-figure"/>Figure</span>
              <span className="scan-ends"><span>Narrower</span><span>0</span><span>Wider</span></span>
            </p>
            <dl className="scan-result" aria-label={`Breadths against the standard ${LABEL[model].toLowerCase()} figure${sex ? '' : ' (preview)'}`}>
              {MEASURES.map((m: string) => <div key={m}>
                <dt>{LABEL[m]}</dt>
                <Bar you={compare[m].you} figure={compare[m].figure} spread={result.spread?.[m]} scale={SCALE.setup}/>
                <dd className="scan-value">{percent(compare[m].you)}<span className="sr">, your figure {percent(compare[m].figure)}</span></dd>
              </div>)}
            </dl>
          </div>
          <dl className="how-why scan-notes">
            <div><dt>Baseline</dt><dd>{!sex && 'Preview until you choose a model. '}0 is the standard {LABEL[model].toLowerCase()} figure: the app’s 3D model at average build and weight. Not a population norm.</dd></div>
            <div><dt>Accuracy</dt><dd>One front view, so an estimate. Loose clothing reads wider. {agree} Tested on {calibration.validation.heldOutBodies} rendered bodies, not on people.</dd></div>
            {cm != null && <div><dt>Legs</dt><dd>Thigh {cm} cm is saved as a leg measurement. Establish a fixed phase reference after three good readings.</dd></div>}
          </dl>
        </div>
      </div>
    </>}

    {status === 'done' && result && mode === 'legs' && <>
      <ClipReview clip={clip} caption={clipCaption}/>
      <dl className="scan-result" aria-label="Thigh breadth">
        <div><dt>Thigh</dt>{legChange != null ? <Bar you={legChange} spread={result.spread?.thighs} scale={SCALE.legs}/> : <dd className="scan-bar none" aria-hidden="true"/>}<dd className="scan-value">{cm != null ? `${cm} cm` : '—'}</dd></div>
      </dl>
      <dl className="how-why scan-notes">
        <div><dt>Baseline</dt><dd>{legChange != null ? `Retained phase reference, ${ghostCm!.toFixed(1)} cm. Today is ${percent(legChange)}; compare only under matching conditions.` : 'No comparable phase reference yet. This outline is saved as a measurement, not automatically made normal.'}</dd></div>
        <div><dt>Accuracy</dt><dd>A front-view breadth with your height as the ruler, not a tape measure. {agree} Wear the same fit each time: loose trousers read wider.</dd></div>
        <div><dt>Zero g</dt><dd>Fluid shifts can reduce leg volume. A narrower silhouette alone cannot establish muscle loss.</dd></div>
      </dl>
    </>}

    {status === 'intro' && !needsHeight && <button className="btn primary" onClick={() => void enableCamera()}><Camera size={16}/> Try again</button>}
    <p className="muted scan-privacy">Runs on this device. {status === 'done' ? 'The clip is for this review only and is erased when you close.' : 'A short clip is recorded for you to review, then erased when you close.'} Only body ratios are kept.</p>
    {status === 'done' && result && <div className="scan-actions">
      <button className="btn primary" disabled={mode === 'setup' && !sex} onClick={() => onSave(result, mode === 'setup' ? { sex, build } : {})}>{mode === 'setup' ? 'Use scan' : 'Save'}</button>
      <button className="btn ghost" onClick={retake}>Retake</button>
    </div>}
    </div>
  </Dialog>;
}

import { useEffect, useRef, useState } from 'react';
import { Camera, Circle, Square, CircleCheck, AlertCircle } from 'lucide-react';
import Dialog from './Dialog';
import type { PoseLandmarker } from '@mediapipe/tasks-vision';
import { shoulderAngle } from './rules.mjs';
import { cameraMessage, loadPose, openCamera } from './pose';
import type { PoseFrame, Recording } from './types';

interface Props { onClose: () => void; onSave: (recording: Recording) => Promise<void>; sol: number }
const connections = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]];

export default function Capture({ onClose, onSave, sol }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const tracker = useRef<PoseLandmarker | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const frames = useRef<PoseFrame[]>([]);
  const recordStart = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  const [status, setStatus] = useState<'intro' | 'loading' | 'ready' | 'recording' | 'saving' | 'saved'>('intro');
  const [error, setError] = useState('');
  const [remaining, setRemaining] = useState(12);
  /** none: no person; partial: a person, but not hips, shoulders and elbows together, so no angle; full: the angle can be read. */
  const [tracking, setTracking] = useState<'none' | 'partial' | 'full'>('none');
  /** The saved left-shoulder angle, or null when no frame showed hip, shoulder and elbow together. */
  const [angle, setAngle] = useState<number | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (recorder.current?.state === 'recording') { recorder.current.onstop = null; recorder.current.stop(); }
      stream.current?.getTracks().forEach(t => t.stop());
      tracker.current?.close();
    };
  }, []);

  async function enableCamera() {
    setStatus('loading');
    setError('');
    try {
      const media = await openCamera();
      if (!mounted.current) { media.getTracks().forEach(t => t.stop()); return; }
      stream.current = media;
      if (video.current) { video.current.srcObject = media; await video.current.play(); }
      const landmarker = await loadPose();
      if (!mounted.current) { landmarker.close(); return; }
      tracker.current = landmarker;
      setStatus('ready');
    } catch (err) {
      stream.current?.getTracks().forEach(t => t.stop());
      setError(cameraMessage(err, 'movement tracking'));
      setStatus('intro');
    }
  }

  useEffect(() => {
    if (status !== 'ready' && status !== 'recording') return;
    let frameId = 0;
    let lastVideoTime = -1;
    let detectTimer: ReturnType<typeof setTimeout>;
    const detect = (now: number) => {
      detectTimer = setTimeout(() => { frameId = requestAnimationFrame(detect); }, 180);
      const element = video.current;
      if (!element || element.readyState < 2 || !tracker.current || element.currentTime === lastVideoTime) return;
      lastVideoTime = element.currentTime;
      try {
        const result = tracker.current.detectForVideo(element, now);
        const pose = result.landmarks[0];
        // The angle needs hip, shoulder and elbow on one side clearly in view; say so live, before recording.
        const seen = (i: number) => (pose?.[i]?.visibility ?? 0) >= .6;
        setTracking(!pose ? 'none' : (seen(23) && seen(11) && seen(13)) || (seen(24) && seen(12) && seen(14)) ? 'full' : 'partial');
        const context = canvas.current?.getContext('2d');
        if (context) {
          context.clearRect(0, 0, 640, 480);
          if (pose) {
            context.strokeStyle = '#d0e7b1'; context.lineWidth = 3; context.fillStyle = '#f3ffde';
            for (const [a, b] of connections) {
              if ((pose[a].visibility ?? 0) < .6 || (pose[b].visibility ?? 0) < .6) continue;
              context.beginPath(); context.moveTo(pose[a].x * 640, pose[a].y * 480); context.lineTo(pose[b].x * 640, pose[b].y * 480); context.stroke();
            }
            for (const point of pose) { if ((point.visibility ?? 0) < .6) continue; context.beginPath(); context.arc(point.x * 640, point.y * 480, 4, 0, Math.PI * 2); context.fill(); }
          }
        }
        if (status === 'recording') {
          if (pose) frames.current.push({ time: (now - recordStart.current) / 1000, landmarks: (result.worldLandmarks[0] || pose).map(p => ({ x: p.x, y: p.y, z: p.z, visibility: p.visibility })) });
          setRemaining(Math.max(0, 12 - (now - recordStart.current) / 1000));
        }
      } catch (err) { setError(`Pose tracking paused: ${err instanceof Error ? err.message : String(err)}`); }
    };
    frameId = requestAnimationFrame(detect);
    return () => { cancelAnimationFrame(frameId); clearTimeout(detectTimer); };
  }, [status]);

  function beginRecording() {
    if (!stream.current || !window.MediaRecorder) { setError('Video recording is not supported in this browser. Try Chrome or Edge.'); return; }
    try {
      const mimeType = ['video/webm;codecs=vp9', 'video/webm', 'video/mp4'].find(type => MediaRecorder.isTypeSupported(type));
      const recording = new MediaRecorder(stream.current, mimeType ? { mimeType } : {});
      const chunks: BlobPart[] = [];
      frames.current = [];
      recording.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recording.onstop = async () => {
        if (!mounted.current) return;
        setStatus('saving');
        const estimate = (side: 'left' | 'right') => {
          const [hip, shoulder, elbow] = side === 'left' ? [23, 11, 13] : [24, 12, 14];
          const angles = frames.current.map(f => shoulderAngle(f.landmarks[hip], f.landmarks[shoulder], f.landmarks[elbow])).filter((v): v is number => v != null).sort((a, b) => a - b);
          return { range: angles.length >= 10 ? Math.round(angles[Math.floor(angles.length * .9)]) : null, count: angles.length };
        };
        try {
          const left = estimate('left'), right = estimate('right');
          setAngle(left.range);
          await onSave({ id: crypto.randomUUID(), date: new Date().toISOString(), sol, blob: new Blob(chunks, { type: recording.mimeType }), frames: frames.current, leftRange: left.range, rightRange: right.range, confidentFrames: { left: left.count, right: right.count } });
          stream.current?.getTracks().forEach(t => t.stop());
          setStatus('saved');
        } catch { setError('The video could not be saved. Your device storage may be full.'); setStatus('ready'); }
      };
      recorder.current = recording;
      recordStart.current = performance.now();
      recording.start();
      setStatus('recording');
      timerRef.current = setTimeout(() => { if (recording.state === 'recording') { setStatus('saving'); recording.stop(); } }, 12000);
    } catch (err) { setError(`Recording could not start: ${err instanceof Error ? err.message : String(err)}`); }
  }

  return <Dialog title="Shoulder range · 12 s" onClose={onClose} label="Close movement recording">
    <div className={`camera-preview ${status === 'intro' || status === 'saved' ? 'empty' : ''}`}>
      <video ref={video} muted playsInline/><canvas ref={canvas} width={640} height={480}/>
      {(status === 'intro' || status === 'loading') && <div className="camera-empty"><Camera size={40}/><strong>{status === 'loading' ? 'Loading pose model…' : 'Stand back so your hips, shoulders and elbows show.'}</strong></div>}
      {status === 'saved' && (angle != null
        ? <div className="camera-empty"><CircleCheck size={40}/><strong>Left shoulder {angle}°</strong><span>Saved, with the video, on this device.</span></div>
        : <div className="camera-empty"><AlertCircle size={40}/><strong>No shoulder angle</strong><span>Hips, shoulders and elbows weren’t all in view. Step back and record again.</span></div>)}
      {(status === 'ready' || status === 'recording') && <div className="tracking-status"><i className={`status-dot ${tracking === 'full' ? '' : 'amber'}`}/>{tracking === 'full' ? 'Pose found' : tracking === 'partial' ? 'Step back: hips to elbows in view' : 'Step back'}{status === 'recording' && <strong>{Math.ceil(remaining)} S</strong>}</div>}
    </div>
    {error && <p className="error" role="alert"><AlertCircle size={16}/> {error}</p>}
    <ol className="steps compact"><li><span>Face the camera</span></li><li><span>Raise both arms slowly</span></li><li><span>Lower and repeat</span></li></ol>
    {status === 'intro' && <button className="btn primary" onClick={() => void enableCamera()}><Camera size={16}/> Enable camera</button>}
    {status === 'loading' && <button disabled className="btn primary">Loading…</button>}
    {status === 'ready' && <button className="btn primary" onClick={beginRecording}><Circle size={14} fill="currentColor"/> Record</button>}
    {status === 'recording' && <button className="btn primary" onClick={() => { if (timerRef.current) clearTimeout(timerRef.current); setStatus('saving'); recorder.current?.stop(); }}><Square size={14} fill="currentColor"/> Stop and save</button>}
    {status === 'saving' && <button disabled className="btn primary">Saving…</button>}
    {status === 'saved' && <div className="row-actions">{angle == null && <button className="btn primary" onClick={() => void enableCamera()}><Camera size={16}/> Record again</button>}<button className={angle == null ? 'btn' : 'btn primary'} onClick={onClose}>Done</button></div>}
  </Dialog>;
}

import { useEffect, useRef, useState } from 'react';
import { Camera, Video, X, Circle, Square, CircleCheck, ShieldCheck, AlertCircle, ArrowRight } from 'lucide-react';
import type { PoseLandmarker } from '@mediapipe/tasks-vision';
import { shoulderAngle } from './rules.mjs';
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
  const [tracking, setTracking] = useState(false);

  useEffect(() => {
    mounted.current = true;
    document.querySelector<HTMLButtonElement>('[aria-label="Close movement recording"]')?.focus();
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
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera access needs localhost or a secure HTTPS connection.');
      const media = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: false });
      if (!mounted.current) { media.getTracks().forEach(t => t.stop()); return; }
      stream.current = media;
      if (video.current) { video.current.srcObject = media; await video.current.play(); }
      const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');
      const vision = await FilesetResolver.forVisionTasks('/wasm');
      const landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: '/models/pose_landmarker_lite.task', delegate: 'CPU' },
        runningMode: 'VIDEO', numPoses: 1, minPoseDetectionConfidence: .6, minTrackingConfidence: .6,
      });
      if (!mounted.current) { landmarker.close(); return; }
      tracker.current = landmarker;
      setStatus('ready');
    } catch (err) {
      stream.current?.getTracks().forEach(t => t.stop());
      const message = err instanceof Error ? err.message : String(err);
      setError(/denied|Permission|NotAllowed/i.test(message) ? 'Camera permission was declined. Allow camera access in your browser and try again.' : `Could not start movement tracking. ${message}`);
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
        setTracking(!!pose);
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
          return angles.length >= 10 ? Math.round(angles[Math.floor(angles.length * .9)]) : null;
        };
        try {
          await onSave({ id: crypto.randomUUID(), date: new Date().toISOString(), sol, blob: new Blob(chunks, { type: recording.mimeType }), frames: frames.current, leftRange: estimate('left'), rightRange: estimate('right') });
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

  return <div className="modal-overlay"><section className="modal capture-modal" role="dialog" aria-modal="true" aria-labelledby="capture-title"><button className="modal-close icon-button" aria-label="Close movement recording" onClick={onClose}><X size={20}/></button><div className="eyebrow">MOVEMENT DIARY · LOCAL CAPTURE</div><h2 id="capture-title">Meet yourself in motion.</h2><p className="modal-description">A 12-second shoulder mobility check. Keep the same camera, distance, restraints, and gravity conditions for future sessions.</p><div className={`camera-preview ${status === 'intro' || status === 'saved' ? 'empty' : ''}`}><video ref={video} muted playsInline/><canvas ref={canvas} width={640} height={480}/>{(status === 'intro' || status === 'loading') && <div className="camera-empty"><Camera size={42}/><strong>{status === 'loading' ? 'Preparing your camera & pose model…' : 'Your camera, your private space.'}</strong><span>Stand far enough back to show your full body.</span></div>}{status === 'saved' && <div className="camera-empty"><CircleCheck size={42}/><strong>Movement saved to your diary.</strong><span>{frames.current.length ? `${frames.current.length} pose frames and original video retained.` : 'Original video saved. No confident pose was detected.'}</span></div>}{(status === 'ready' || status === 'recording') && <div className="tracking-status"><i className={`status-dot ${tracking ? '' : 'amber'}`}/>{tracking ? 'Pose detected' : 'Step back until your body is visible'}{status === 'recording' && <strong>{Math.ceil(remaining)}s</strong>}</div>}</div>{error && <div className="inline-alert"><AlertCircle size={17}/>{error}</div>}<div className="capture-instructions"><span><i>1</i> Face the camera</span><span><i>2</i> Slowly raise both arms</span><span><i>3</i> Lower and repeat</span></div>{status === 'intro' && <button className="button primary full-width" onClick={() => void enableCamera()}><Camera size={17}/> Enable camera & pose tracking</button>}{status === 'loading' && <button disabled className="button primary full-width"><span className="spinner"/> Loading local tracking model</button>}{status === 'ready' && <button className="button primary full-width" onClick={beginRecording}><Circle size={15} fill="currentColor"/> Record 12-second movement</button>}{status === 'recording' && <button className="button primary full-width" onClick={() => { if (timerRef.current) clearTimeout(timerRef.current); setStatus('saving'); recorder.current?.stop(); }}><Square size={14} fill="currentColor"/> Stop & save recording</button>}{status === 'saving' && <button disabled className="button primary full-width">Saving original video…</button>}{status === 'saved' && <button className="button primary full-width" onClick={onClose}>Open movement diary <ArrowRight size={17}/></button>}<p className="privacy-note"><ShieldCheck size={14}/> Video and pose processing stay on this device. No audio is recorded.</p><p className="fine-print"><Video size={12}/> MediaPipe estimates experimental movement angles. The 3D replay is pose driven; it is not a trained 4D Gaussian reconstruction or a clinical measurement.</p></section></div>;
}

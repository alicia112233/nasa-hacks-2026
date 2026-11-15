import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Play, Pause, RotateCcw, Move3d, Maximize2, Layers3, ChevronDown, Camera, Minus, Plus } from 'lucide-react';
import type { PoseFrame } from './types';
import type { GhostReference, Recording } from './types';
import MovementEvidence, { ghostRecording } from './MovementEvidence';

const GaussianSequenceViewer = lazy(() => import('./GaussianSequenceViewer'));

type Mode = 'overlay' | 'today' | 'baseline';
interface Props {
  onRecord: () => void;
  onEvidence: () => void;
  sol?: number;
  simulated: boolean;
  frames?: PoseFrame[];
  leftRange?: number;
  baselineRange?: number;
  hasBaseline?: boolean;
  active?: boolean;
  recordings?: Recording[];
  references?: GhostReference[];
}

function makeAstronaut(ghost: boolean) {
  const root = new THREE.Group();
  const ink = ghost ? '#99ac7b' : '#35574a';
  const suit = new THREE.MeshStandardMaterial({ color: ghost ? '#c3d4a9' : '#d5dfce', roughness: 0.95, transparent: true, opacity: ghost ? 0.18 : 0.88, depthWrite: !ghost });
  const dark = new THREE.MeshStandardMaterial({ color: ghost ? '#94aa77' : '#344d43', roughness: 0.5, transparent: ghost, opacity: ghost ? 0.3 : 1 });
  const pointMaterial = new THREE.PointsMaterial({ color: ink, size: ghost ? 0.014 : 0.011, transparent: true, opacity: ghost ? 0.58 : 0.75, sizeAttenuation: true });

  const surface = (parent: THREE.Group, x: number, y: number, z: number, rx: number, ry: number, rz: number, count: number) => {
    const geo = new THREE.SphereGeometry(1, 32, 24);
    const mesh = new THREE.Mesh(geo, suit);
    mesh.position.set(x, y, z);
    mesh.scale.set(rx, ry, rz);
    parent.add(mesh);
    const points: number[] = [];
    for (let i = 0; i < count; i++) {
      const sy = 1 - (i / (count - 1)) * 2;
      const r = Math.sqrt(1 - sy * sy);
      const theta = Math.PI * (3 - Math.sqrt(5)) * i;
      points.push(x + Math.cos(theta) * r * rx * 1.005, y + sy * ry * 1.005, z + Math.sin(theta) * r * rz * 1.005);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    parent.add(new THREE.Points(geometry, pointMaterial));
  };
  surface(root, 0, 1.79, 0, 0.43, 0.57, 0.26, 2400);
  surface(root, 0, 1.24, 0, 0.34, 0.23, 0.23, 800);
  surface(root, 0, 2.55, 0, 0.335, 0.35, 0.32, 2200);
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.293, 32, 24), dark);
  visor.position.set(0, 2.56, 0.12);
  visor.scale.set(0.94, 0.59, 0.88);
  root.add(visor);
  const neck = new THREE.Mesh(new THREE.TorusGeometry(0.234, 0.034, 8, 32), dark);
  neck.rotation.x = Math.PI / 2;
  neck.position.y = 2.25;
  root.add(neck);
  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.26, 0.035), dark);
  panel.position.set(0.02, 1.88, 0.25);
  root.add(panel);
  for (let i = 0; i < 3; i++) {
    const indicator = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.013, 0.01), new THREE.MeshBasicMaterial({ color: ghost ? '#d2e3b9' : '#bccda7', transparent: ghost, opacity: ghost ? .4 : 1 }));
    indicator.position.set(0.02, 1.94 - i * .05, .274);
    root.add(indicator);
  }
  const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.65, 0.22), suit);
  backpack.position.set(0, 1.83, -0.29);
  root.add(backpack);
  for (const side of [-1, 1]) {
    surface(root, side * .205, .79, 0, .183, .46, .19, 1200);
    surface(root, side * .22, .29, .025, .16, .27, .17, 900);
    surface(root, side * .22, .105, .1, .18, .115, .29, 600);
    const knee = new THREE.Mesh(new THREE.TorusGeometry(.147, .025, 8, 24), dark);
    knee.rotation.x = Math.PI / 2;
    knee.position.set(side * .215, .55, 0);
    root.add(knee);
  }
  const arms: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * .4, 2.1, 0);
    surface(arm, 0, -.23, 0, .173, .31, .18, 1100);
    surface(arm, 0, -.66, .015, .143, .29, .15, 1000);
    surface(arm, 0, -.96, .035, .145, .17, .13, 600);
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(.127, .025, 8, 24), dark);
    cuff.rotation.x = Math.PI / 2;
    cuff.position.set(0, -.81, .02);
    arm.add(cuff);
    root.add(arm);
    arms.push(arm);
  }
  return { root, arms };
}

export default function MovementViewer(props: Props) {
  const [technical, setTechnical] = useState(false);
  const [poseOpen, setPoseOpen] = useState(false);
  if (!props.simulated) {
    // The replay's ghost arms take the ghost recording's angle, so the replay and the videos compare the same two.
    const latest = (props.recordings ?? []).slice().sort((a, b) => a.date.localeCompare(b.date)).at(-1);
    const ghost = ghostRecording(props.recordings ?? [], props.references ?? [], latest);
    const ghostRange = ghost?.recording.leftRange ?? null;
    return <div className="movement-viewer">
      <MovementEvidence recordings={props.recordings ?? []} references={props.references ?? []} onRecord={props.onRecord}/>
      <details className="pose-replay" onToggle={e => setPoseOpen(e.currentTarget.open)}><summary>Estimated pose replay</summary><p className="muted">Pose tracking is an estimate. Trust the video above.</p>{poseOpen && <PoseMovementViewer {...props} hasBaseline={ghostRange != null} baselineRange={ghostRange ?? props.baselineRange}/>}</details>
    </div>;
  }
  return <div className="movement-viewer">
    <p className="comparison-note">Record your own movement to compare.</p>
    <PoseMovementViewer {...props}/>
    <details className="technical-demo" onToggle={e => setTechnical(e.currentTarget.open)}><summary>4DGS model · public reference</summary><p className="muted">Public D-NeRF model.</p>
      {technical && <Suspense fallback={<section className="panel reconstruction-loading" role="status">Preparing the Gaussian splat viewer…</section>}><GaussianSequenceViewer active={props.active ?? true}/></Suspense>}
    </details>
  </div>;
}

function PoseMovementViewer({ onRecord, onEvidence, sol = 42, simulated, frames, leftRange = 134, baselineRange = 152, hasBaseline = true, active = true }: Props) {
  const mount = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode>('overlay');
  const [playing, setPlaying] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [time, setTime] = useState(3.8);
  const [speed, setSpeed] = useState(1);
  const [failed, setFailed] = useState(false);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const stateRef = useRef({ mode, playing, time, speed, leftRange, baselineRange, frames, hasBaseline, simulated, active });
  stateRef.current = { mode, playing, time, speed, leftRange, baselineRange, frames, hasBaseline, simulated, active };
  const duration = frames?.length ? Math.max(1, frames[frames.length - 1].time) : 12;

  useEffect(() => {
    if (!mount.current) return;
    const container = mount.current;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
    catch { setFailed(true); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
    renderer.setClearColor('#f4f1e8', 0);
    container.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-label', 'Interactive 3D astronaut movement comparison. Drag to orbit, scroll to zoom.');
    renderer.domElement.setAttribute('role', 'img');
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog('#edf1e8', 9, 20);
    const camera = new THREE.PerspectiveCamera(32, 1, .1, 50);
    camera.position.set(3.2, 2.7, 6.9);
    cameraRef.current = camera;
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.43, 0);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.minDistance = 5;
    controls.maxDistance = 13;
    controls.maxPolarAngle = Math.PI / 2;
    controlsRef.current = controls;
    scene.add(new THREE.AmbientLight('#ffffff', 2));
    const light = new THREE.DirectionalLight('#fffdf3', 3);
    light.position.set(3, 7, 5);
    scene.add(light);
    const grid = new THREE.GridHelper(18, 54, '#b6c1ad', '#d8dfd1');
    grid.position.y = -.035;
    const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
    gridMaterials.forEach(m => { m.transparent = true; m.opacity = .55; });
    scene.add(grid);
    for (const radius of [1.22, 1.27, 2.1]) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(radius, radius + .008, 100), new THREE.MeshBasicMaterial({ color: '#9daa92', side: THREE.DoubleSide, transparent: true, opacity: .5 }));
      ring.rotation.x = -Math.PI / 2;
      scene.add(ring);
    }
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(.8, 40), new THREE.MeshBasicMaterial({ color: '#6e8064', transparent: true, opacity: .065, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -.01;
    shadow.scale.set(1, .6, 1);
    scene.add(shadow);
    const today = makeAstronaut(false);
    const baseline = makeAstronaut(true);
    baseline.root.position.set(-.14, 0, -.19);
    scene.add(baseline.root, today.root);

    // Dashed traces make the difference in the two shoulder paths visible.
    const traces = new THREE.Group();
    scene.add(traces);
    for (const side of [-1, 1]) {
      const points = Array.from({ length: 60 }, (_, i) => {
        const theta = .2 + i / 59 * 2.55;
        return new THREE.Vector3(side * (.4 + Math.sin(theta) * 1.08), 2.1 - Math.cos(theta) * 1.08, -.19);
      });
      const path = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineDashedMaterial({ color: '#91a379', dashSize: .04, gapSize: .045, transparent: true, opacity: .6 }));
      path.computeLineDistances();
      traces.add(path);
    }
    const resize = new ResizeObserver(() => {
      renderer.setSize(container.clientWidth, container.clientHeight);
      camera.aspect = container.clientWidth / Math.max(1, container.clientHeight);
      camera.updateProjectionMatrix();
    });
    resize.observe(container);
    let animation = 0;
    let previous = performance.now();
    let report = previous;
    let clock = stateRef.current.time;
    const render = (now: number) => {
      animation = requestAnimationFrame(render);
      const s = stateRef.current;
      const dt = Math.min((now - previous) / 1000, .05);
      previous = now;
      if (!s.active || document.hidden) return;
      if (s.playing) clock = (clock + dt * s.speed) % duration;
      else clock = s.time;
      if (s.playing && now - report > 100) { setTime(clock); report = now; }
      const phase = (.5 - .5 * Math.cos(clock / duration * Math.PI * 4));
      const leftAngle = (.18 + phase * s.leftRange / 180 * Math.PI);
      const rightAngle = (.18 + phase * 151 / 180 * Math.PI);
      today.arms[0].rotation.z = -rightAngle;
      today.arms[1].rotation.z = leftAngle;
      if (s.frames?.length) {
        const frame = s.frames.reduce((a, b) => Math.abs(b.time - clock) < Math.abs(a.time - clock) ? b : a);
        const landmarks = frame.landmarks;
        for (const [idx, shoulder, elbow] of [[0, 12, 14], [1, 11, 13]]) {
          if (landmarks[shoulder] && landmarks[elbow]) {
            const dx = landmarks[elbow].x - landmarks[shoulder].x;
            const dy = landmarks[elbow].y - landmarks[shoulder].y;
            today.arms[idx].rotation.z = Math.atan2(dx, dy);
          }
        }
      }
      baseline.arms[0].rotation.z = -(.18 + phase * s.baselineRange / 180 * Math.PI);
      baseline.arms[1].rotation.z = .18 + phase * s.baselineRange / 180 * Math.PI;
      today.root.visible = s.mode !== 'baseline' && (s.simulated || !!s.frames?.length);
      baseline.root.visible = s.mode !== 'today' && s.hasBaseline;
      traces.visible = s.hasBaseline && s.mode !== 'today';
      controls.update();
      renderer.render(scene, camera);
    };
    animation = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animation);
      resize.disconnect();
      controls.dispose();
      scene.traverse(object => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();
        if (mesh.material) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(m => m.dispose());
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [duration]);

  function resetView() {
    cameraRef.current?.position.set(3.2, 2.7, 6.9);
    controlsRef.current?.target.set(0, 1.43, 0);
    controlsRef.current?.update();
  }

  return <section className="panel movement-panel">
    <div className="panel-heading"><h3>Pose · today against your ghost</h3><button className="icon-btn" aria-label="Record a movement" onClick={onRecord}><Camera size={18}/></button></div>
    <div className="movement-stage">
      <div ref={mount} className="three-mount" />
      {(failed || (!simulated && !frames?.length)) && <div className="webgl-fallback"><Move3d size={48}/><p>{failed ? '3D preview needs WebGL.' : 'No confident pose was detected.'}</p><span>{failed ? 'Your diary and check-ins are still available.' : 'Your original video is retained for review.'}</span></div>}
      <div className="stage-top"><div className="stage-session"><span className="live-dot"/> SHOULDER MOBILITY <small>Sol {String(sol).padStart(3, '0')} · Standardized arm raise</small></div><span className="simulation-tag">{simulated ? 'POSE REPLAY' : frames?.length ? 'RECORDED POSE' : 'VIDEO ONLY'}</span></div>
      <div className="viewer-tabs" role="group" aria-label="Comparison mode">{(['overlay', 'today', 'baseline'] as Mode[]).map(m => <button key={m} className={mode === m ? 'active' : ''} aria-pressed={mode === m} disabled={m === 'baseline' && !hasBaseline} onClick={() => setMode(m)}>{m === 'overlay' && <Layers3 size={13}/>} {m[0].toUpperCase() + m.slice(1)}</button>)}</div>
      <div className="ghost-annotation"><span className="annotation-line"/><span>Your ghost<small>{hasBaseline ? 'Your ghost recording' : 'No ghost recording yet'}</small></span></div>
      {hasBaseline && <button className="range-annotation" onClick={onEvidence}><span className="annotation-dot"/><span>Left arm range<strong>{Math.round((leftRange - baselineRange) / baselineRange * 100)}% <small>from baseline</small></strong></span></button>}
      <div className="stage-bottom"><span><Move3d size={13}/> Drag to orbit · Scroll to zoom</span><div><button className="icon-button" aria-label="Zoom out" onClick={() => { cameraRef.current?.position.multiplyScalar(1.12); controlsRef.current?.update(); }}><Minus size={14}/></button><button className="icon-button" aria-label="Zoom in" onClick={() => { cameraRef.current?.position.multiplyScalar(.9); controlsRef.current?.update(); }}><Plus size={14}/></button><button className="icon-button" aria-label="Reset 3D view" onClick={resetView}><RotateCcw size={14}/></button><button className="icon-button" aria-label="Expand movement viewer" onClick={() => { const panel = mount.current?.closest('.movement-panel'); if (document.fullscreenElement) void document.exitFullscreen(); else void panel?.requestFullscreen?.(); }}><Maximize2 size={14}/></button></div></div>
      <div className="axis-label">Y ↑ <span>Z ↙</span> X →</div>
    </div>
    <div className="playback"><button className="play-button" aria-label={playing ? 'Pause playback' : 'Play movement'} onClick={() => setPlaying(!playing)}>{playing ? <Pause size={15} fill="currentColor"/> : <Play size={15} fill="currentColor"/>}</button><span className="time-label">00:{String(Math.floor(time)).padStart(2, '0')}</span><input aria-label="Movement timeline" type="range" min="0" max={duration} step="0.05" value={time} onChange={e => { setPlaying(false); setTime(Number(e.target.value)); }}/><span className="time-label">00:{String(Math.round(duration)).padStart(2, '0')}</span><button className="speed-button" onClick={() => setSpeed(speed === 1 ? .5 : speed === .5 ? 2 : 1)} aria-label={`${speed}\u00d7 playback speed; activate to change`}>{speed}× <ChevronDown size={12}/></button></div>
    <div className="viewer-footer"><span><i className="legend-dot current"/> Today <i className="legend-dot ghost"/> Personal baseline</span><span>{simulated ? '3D pose replay' : 'Pose-driven replay · original video retained'}</span></div>
  </section>;
}

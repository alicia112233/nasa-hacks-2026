import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SparkRenderer } from '@sparkjsdev/spark';
import { ChevronDown, ExternalLink, Maximize2, Minus, Move3d, Pause, Play, Plus, RotateCcw } from 'lucide-react';
import { createNativeGaussians, loadGaussianAsset, type GaussianAsset } from './native-4dgs';

export default function GaussianSequenceViewer({ active }: { active: boolean }) {
  const mount = useRef<HTMLDivElement>(null);
  const [asset, setAsset] = useState<GaussianAsset | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [playing, setPlaying] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [phase, setPhase] = useState(0.25);
  const [speed, setSpeed] = useState(1);
  const state = useRef({ active, playing, phase, speed });
  state.current = { active, playing, phase, speed };
  const view = useRef<{ reset: () => void; zoom: (factor: number) => void } | null>(null);

  useEffect(() => {
    const container = mount.current;
    if (!container) return;
    const abort = new AbortController();
    let disposed = false;
    let cleanScene: (() => void) | undefined;
    setAsset(null);
    setError('');

    async function start(container: HTMLDivElement) {
      try {
        const { asset: loadedAsset, parameters } = await loadGaussianAsset(abort.signal);
        if (disposed) return;
        const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        renderer.setClearColor('#edf1e8', 0);
        renderer.domElement.setAttribute('role', 'img');
        renderer.domElement.setAttribute('aria-label', 'Trained 4D Gaussian reconstruction. Arrow keys orbit, plus and minus zoom.');
        renderer.domElement.tabIndex = 0;
        container.appendChild(renderer.domElement);
        let spark: SparkRenderer | undefined;
        let model: ReturnType<typeof createNativeGaussians> | undefined;
        let controls: OrbitControls | undefined;
        let resize: ResizeObserver | undefined;
        let animation = 0;
        let graphicsAlive = true;
        const cleanup = () => {
          if (!graphicsAlive) return;
          graphicsAlive = false;
          cancelAnimationFrame(animation);
          resize?.disconnect();
          controls?.dispose();
          model?.dispose();
          spark?.dispose();
          renderer.dispose();
          renderer.forceContextLoss();
          renderer.domElement.remove();
          view.current = null;
        };
        cleanScene = cleanup;
        const scene = new THREE.Scene();
        let needsRender = true;
        spark = new SparkRenderer({ renderer, enableLod: false, maxPixelRadius: 128, onDirty: () => { needsRender = true; } });
        scene.add(spark);
        model = createNativeGaussians(loadedAsset, parameters);
        scene.add(model.splats);
        const center = new THREE.Vector3(...loadedAsset.center);
        const camera = new THREE.PerspectiveCamera(38, 1, 0.01, loadedAsset.radius * 50);
        controls = new OrbitControls(camera, renderer.domElement);
        controls.target.copy(center);
        controls.enableDamping = true;
        controls.enablePan = false;
        controls.addEventListener('change', () => { needsRender = true; });
        controls.minDistance = loadedAsset.radius * 0.8;
        controls.maxDistance = loadedAsset.radius * 8;
        const reset = () => {
          camera.position.copy(center).add(new THREE.Vector3(0.3, 0.12, 1).normalize().multiplyScalar(loadedAsset.radius * 3.3));
          controls?.target.copy(center);
          controls?.update();
        };
        const zoom = (factor: number) => {
          const offset = camera.position.clone().sub(center);
          offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, loadedAsset.radius * 0.8, loadedAsset.radius * 8));
          camera.position.copy(center).add(offset);
          controls?.update();
        };
        view.current = { reset, zoom };
        reset();
        renderer.domElement.addEventListener('keydown', event => {
          const directions: Record<string, [number, number]> = { ArrowLeft: [-0.12, 0], ArrowRight: [0.12, 0], ArrowUp: [0, -0.12], ArrowDown: [0, 0.12] };
          if (directions[event.key]) {
            event.preventDefault();
            const offset = new THREE.Spherical().setFromVector3(camera.position.clone().sub(center));
            offset.theta += directions[event.key][0];
            offset.phi += directions[event.key][1];
            offset.makeSafe();
            camera.position.copy(center).add(new THREE.Vector3().setFromSpherical(offset));
            controls?.update();
          } else if (event.key === '+' || event.key === '=' || event.key === '-') {
            event.preventDefault();
            zoom(event.key === '-' ? 1.12 : 0.9);
          } else if (event.key === 'Home') { event.preventDefault(); reset(); }
        });
        renderer.domElement.addEventListener('webglcontextlost', event => {
          event.preventDefault();
          if (!disposed && graphicsAlive) { cancelAnimationFrame(animation); setPlaying(false); setError('The graphics context was lost. Retry to reopen the reconstruction.'); }
        });
        resize = new ResizeObserver(() => {
          renderer.setSize(container.clientWidth, container.clientHeight);
          camera.aspect = container.clientWidth / Math.max(1, container.clientHeight);
          camera.updateProjectionMatrix();
          needsRender = true;
        });
        resize.observe(container);
        let previous = performance.now();
        let reported = previous;
        let rendered = 0;
        let clock = state.current.phase;
        const render = (now: number) => {
          if (disposed || !graphicsAlive) return;
          animation = requestAnimationFrame(render);
          const elapsed = Math.min((now - previous) / 1000, 0.05);
          previous = now;
          const current = state.current;
          if (!current.active || document.hidden) return;
          if (current.playing) clock = (clock + elapsed * current.speed / loadedAsset.cycleSeconds) % 1;
          else clock = current.phase;
          const time = loadedAsset.timeRange[0] + clock * (loadedAsset.timeRange[1] - loadedAsset.timeRange[0]);
          if (model!.phase.value !== time) { model!.phase.value = time; model!.splats.updateVersion(); needsRender = true; }
          controls!.update();
          if (needsRender && now - rendered >= 1000 / 30) {
            needsRender = false;
            rendered = now;
            try {
              renderer.render(scene, camera);
              if (model!.splats.generatorError) throw model!.splats.generatorError;
            } catch {
              cleanup();
              setPlaying(false);
              setError('This device could not render the trained Gaussian model. Try reopening the reconstruction.');
              return;
            }
          }
          if (current.playing && now - reported > 100) { setPhase(clock); reported = now; }
        };
        setAsset(loadedAsset);
        animation = requestAnimationFrame(render);
      } catch (cause) {
        cleanScene?.();
        if (!disposed) setError(cause instanceof Error ? cause.message : 'The trained reconstruction could not be opened.');
      }
    }
    void start(container);
    return () => { disposed = true; abort.abort(); cleanScene?.(); };
  }, [attempt]);

  const ready = !!asset && !error;
  return <section className="panel movement-panel gaussian-panel" aria-label="Trained 4DGS model">
    <div className="panel-heading"><h3>4DGS reference model</h3></div>
    <div className="movement-stage gaussian-stage" data-model-status={error ? 'error' : ready ? 'ready' : 'loading'} data-motion-phase={phase.toFixed(3)}>
      <div ref={mount} className="three-mount"/>
      {(!ready || error) && <div className="gaussian-status" role={error ? 'alert' : 'status'}><Move3d size={36}/><strong>{error ? 'Reconstruction unavailable' : 'Loading the trained reconstruction…'}</strong><p>{error || 'Preparing learned Gaussian geometry and motion on this device.'}</p>{error && <button className="button secondary" onClick={() => setAttempt(value => value + 1)}>Retry reconstruction</button>}</div>}
      <div className="stage-top"><div className="stage-session">{asset?.title ?? 'PUBLIC RESEARCH MODEL'}<small>Public humanoid model · not crew data</small></div><span className="simulation-tag">{ready ? 'TRAINED 4DGS' : '4DGS MODEL'}</span></div>
      <div className="stage-bottom"><span/><div><button className="icon-button" disabled={!ready} aria-label="Zoom out" onClick={() => view.current?.zoom(1.12)}><Minus size={14}/></button><button className="icon-button" disabled={!ready} aria-label="Zoom in" onClick={() => view.current?.zoom(0.9)}><Plus size={14}/></button><button className="icon-button" disabled={!ready} aria-label="Reset 3D view" onClick={() => view.current?.reset()}><RotateCcw size={14}/></button><button className="icon-button" aria-label="Expand movement viewer" onClick={() => { const panel = mount.current?.closest('.movement-panel'); if (document.fullscreenElement) void document.exitFullscreen().catch(() => {}); else void panel?.requestFullscreen?.().catch(() => {}); }}><Maximize2 size={14}/></button></div></div>
    </div>
    <div className="playback"><button className="play-button" disabled={!ready} aria-label={playing ? 'Pause playback' : 'Play movement'} onClick={() => setPlaying(value => !value)}>{playing ? <Pause size={15} fill="currentColor"/> : <Play size={15} fill="currentColor"/>}</button><span className="time-label">{Math.round(phase * 100)}%</span><input aria-label="Movement timeline" aria-valuetext={`${Math.round(phase * 100)} percent of learned motion`} disabled={!ready} type="range" min="0" max="1" step="0.001" value={phase} onChange={event => { setPlaying(false); setPhase(Number(event.target.value)); }}/><span className="time-label">100%</span><button disabled={!ready} className="speed-button" onClick={() => setSpeed(value => value === 1 ? 0.5 : value === 0.5 ? 2 : 1)} aria-label={`${speed}× playback speed; activate to change`}>{speed}× <ChevronDown size={12}/></button></div>
    <div className="gaussian-caption"><p>Public trained 4D Gaussian model. Not crew data.</p></div>
    {asset && <details className="gaussian-provenance"><summary>Model source and display details</summary><p>{asset.method} · {asset.count.toLocaleString()} Gaussians · checkpoint iteration {asset.checkpointIteration.toLocaleString()}.</p><p>{asset.displayNote} The full learned time range is played over an illustrative {asset.cycleSeconds}-second cycle; the source recording duration is unknown.</p><p>{asset.provenanceNote} The publisher declares {asset.declaredCheckpointLicense}.</p><div><a href={asset.sourceUrl} target="_blank" rel="noreferrer">Checkpoint source <ExternalLink size={13}/></a><a href={asset.methodUrl} target="_blank" rel="noreferrer">Method implementation <ExternalLink size={13}/></a></div></details>}
  </section>;
}

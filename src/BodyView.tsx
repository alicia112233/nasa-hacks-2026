import { useEffect, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { regionForMesh, regions } from './body.mjs';
import type { RegionId } from './types';

export type RegionState = 'flag' | 'reported' | 'done' | 'due' | 'none' | 'instrument';
export interface BodyShape { weights: Record<string, number>; scale: number }
interface Props { selected: RegionId | null; states: Record<string, { state: RegionState }>; onSelect: (id: RegionId) => void; shape: BodyShape; children?: ReactNode }

const INK = new THREE.Color('#111111');
const fill = (state: RegionState, selected: boolean) => new THREE.Color(
  selected ? '#e0a100' : state === 'flag' ? '#e9a3ab' : state === 'reported' ? '#f1d27e' : state === 'done' ? '#d7d1bf' : '#ece7da');
const hatched = (state: RegionState) => state === 'none' || state === 'instrument';

// Three printed tones: shadow, mid, paper. Gives the body the flat look of a manual illustration.
const toneRamp = (() => {
  const t = new THREE.DataTexture(new Uint8Array([150, 150, 150, 255, 214, 214, 214, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();

export function cardMaterial() {
  const material = new THREE.MeshToonMaterial({ color: '#ece7da', gradientMap: toneRamp });
  const uniforms = { uHatch: { value: 0 } };
  material.onBeforeCompile = shader => {
    shader.uniforms.uHatch = uniforms.uHatch;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uHatch;')
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\nif (uHatch > 0.5 && mod(gl_FragCoord.x + gl_FragCoord.y, 9.0) < 1.6) gl_FragColor.rgb *= 0.55;');
  };
  return { material, uniforms };
}

// Inverted hull ink line. Uses Three's morph chunks so the outline follows the crew member's shape.
export const outlineMaterial = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  uniforms: { color: { value: INK }, width: { value: 0.0068 } },
  vertexShader: `#include <common>
#include <morphtarget_pars_vertex>
uniform float width;
void main() {
  #include <beginnormal_vertex>
  #include <morphnormal_vertex>
  #include <begin_vertex>
  #include <morphtarget_vertex>
  gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed + normalize(objectNormal) * width, 1.0);
}`,
  fragmentShader: 'uniform vec3 color; void main(){ gl_FragColor = vec4(color, 1.0); }',
});

type Anchor = { mesh: THREE.Mesh; index: number } | THREE.Vector3;

/** Surface vertex nearest a target point, so a leader line lands on skin and follows morphs. */
function nearestVertex(mesh: THREE.Mesh, target: THREE.Vector3) {
  const pos = mesh.geometry.getAttribute('position');
  let best = 0, bestD = Infinity;
  for (let i = 0; i < pos.count; i++) {
    const d = (pos.getX(i) - target.x) ** 2 + (pos.getY(i) - target.y) ** 2 + (pos.getZ(i) - target.z) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

const LEFT = new Set(['head', 'chest', 'abdomen', 'pelvis']);

export default function BodyView({ selected, states, onSelect, shape, children }: Props) {
  const mount = useRef<HTMLDivElement>(null);
  const tagLayer = useRef<HTMLDivElement>(null);
  const leaderLayer = useRef<SVGSVGElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const live = useRef({ selected, states, onSelect, shape, hover: null as string | null });
  live.current.selected = selected; live.current.states = states; live.current.onSelect = onSelect; live.current.shape = shape;
  const repaint = useRef<() => void>(() => {});

  useEffect(() => {
    const container = mount.current!;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' }); }
    catch { setStatus('failed'); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 30);
    // A three-quarter view shows NASA's floating posture (knees and forearms forward) rather than a flat front.
    camera.position.set(Math.sin(0.4) * 4.6, 1.0, Math.cos(0.4) * 4.6);
    scene.add(new THREE.HemisphereLight('#fffaf0', '#8b8f94', 2.1));
    const key = new THREE.DirectionalLight('#ffffff', 1.6); key.position.set(1.5, 3, 2.5); scene.add(key);
    const rim = new THREE.DirectionalLight('#ffffff', 0.5); rim.position.set(-2, 1.5, -2); scene.add(rim);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.86, 0);
    controls.enablePan = false; controls.enableZoom = false; controls.enableDamping = true;
    controls.minPolarAngle = controls.maxPolarAngle = Math.PI * 0.47;
    controls.rotateSpeed = 0.6;
    const body = new THREE.Group();
    scene.add(body);
    const parts: { mesh: THREE.Mesh; region: string; mat: ReturnType<typeof cardMaterial> }[] = [];
    const anchors = new Map<string, Anchor>();
    const anchorX = new Map<string, number>();
    const current: BodyShape = { weights: { ...live.current.shape.weights }, scale: live.current.shape.scale };
    let shapeDirty = true;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let disposed = false;

    repaint.current = () => {
      for (const p of parts) {
        const st = (live.current.states[p.region]?.state ?? 'none') as RegionState;
        const isSel = p.region === live.current.selected;
        const color = fill(st, isSel);
        if (live.current.hover === p.region && !isSel) color.offsetHSL(0, 0, -0.06);
        p.mat.material.color.copy(color);
        p.mat.uniforms.uHatch.value = hatched(st) && !isSel ? 1 : 0;
      }
    };

    new GLTFLoader().load('/models/body.glb', gltf => {
      if (disposed) return;
      // Collect first: traversing while adding outline children would visit (and colour, and scale) the outlines too.
      const meshes: THREE.Mesh[] = [];
      gltf.scene.traverse(obj => { if ((obj as THREE.Mesh).isMesh) meshes.push(obj as THREE.Mesh); });
      meshes.forEach(mesh => {
        const region = regionForMesh(mesh.name) ?? regionForMesh(mesh.parent?.name ?? '');
        if (!region) return;
        const mat = cardMaterial();
        mesh.material = mat.material;
        mesh.userData.region = region.id;
        const outline = new THREE.Mesh(mesh.geometry, outlineMaterial);
        outline.morphTargetInfluences = mesh.morphTargetInfluences;
        outline.morphTargetDictionary = mesh.morphTargetDictionary;
        outline.raycast = () => {};
        mesh.add(outline);
        parts.push({ mesh, region: region.id, mat });
        mesh.geometry.computeBoundingBox();
        const box = mesh.geometry.boundingBox!;
        const centre = box.getCenter(new THREE.Vector3());
        // Leader lines land on skin facing the viewer (brow, outer eye, sternum, elbow, knee); cabin on the deck rim.
        if (region.id === 'cabin') { anchors.set('cabin', new THREE.Vector3(box.max.x * 0.82, box.max.y, box.max.z * 0.45)); return; }
        const target = new THREE.Vector3(centre.x, centre.y, box.max.z);
        if (region.id === 'head') target.y = box.max.y - 0.05;
        if (region.id === 'eyes') target.x = box.max.x;
        if (!anchorX.has(region.id) || centre.x > anchorX.get(region.id)!) {
          anchorX.set(region.id, centre.x);
          anchors.set(region.id, { mesh, index: nearestVertex(mesh, target) });
        }
      });
      body.add(gltf.scene);
      repaint.current();
      setStatus('ready');
    }, undefined, () => !disposed && setStatus('failed'));

    const ray = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const pick = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(pointer, camera);
      const hit = ray.intersectObjects(parts.map(p => p.mesh), false)[0];
      return (hit?.object.userData.region as string | undefined) ?? null;
    };
    let down = { x: 0, y: 0 };
    const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY }; };
    const onUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
      const region = pick(e);
      if (region) live.current.onSelect(region as RegionId);
    };
    const onMove = (e: PointerEvent) => {
      if (e.buttons) return;
      const region = pick(e);
      if (region !== live.current.hover) { live.current.hover = region; renderer.domElement.style.cursor = region ? 'pointer' : 'grab'; repaint.current(); }
    };
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);
    renderer.domElement.addEventListener('pointermove', onMove);

    const resize = () => {
      const { width, height } = container.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      const dist = width / height < 0.62 ? 6.2 : width / height < 0.85 ? 5.2 : 4.6;
      const az = controls.getAzimuthalAngle();
      camera.position.set(controls.target.x + Math.sin(az) * dist, camera.position.y, controls.target.z + Math.cos(az) * dist);
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    /** Ease the body toward the profile's shape (instant with reduced motion). */
    const reshape = () => {
      const goal = live.current.shape;
      const k = reduced ? 1 : 0.14;
      let moving = Math.abs(goal.scale - current.scale) > 1e-4;
      current.scale += (goal.scale - current.scale) * k;
      for (const [name, value] of Object.entries(goal.weights)) {
        const now = current.weights[name] ?? 0;
        if (Math.abs(value - now) > 1e-4) moving = true;
        current.weights[name] = now + (value - now) * k;
      }
      if (!moving && !shapeDirty) return;
      shapeDirty = moving;
      for (const p of parts) {
        if (p.region !== 'cabin') p.mesh.scale.setScalar(current.scale);
        const dict = p.mesh.morphTargetDictionary, infl = p.mesh.morphTargetInfluences;
        if (dict && infl) for (const [name, i] of Object.entries(dict)) infl[i] = current.weights[name] ?? 0;
      }
    };

    const v = new THREE.Vector3();
    let frame = 0;
    const tick = (t: number) => {
      frame = requestAnimationFrame(tick);
      controls.update();
      if (parts.length) reshape();
      if (!reduced) body.position.y = Math.sin(t / 1400) * 0.012;
      renderer.render(scene, camera);
      const layer = tagLayer.current;
      const leaders = leaderLayer.current;
      if (!layer || !leaders || !anchors.size) return;
      const { width, height } = container.getBoundingClientRect();
      const toScreen = (p: THREE.Vector3) => { v.copy(p).add(body.position).project(camera); return { x: (v.x * 0.5 + 0.5) * width, y: (-v.y * 0.5 + 0.5) * height }; };
      const anchorScreen = (a: Anchor) => {
        if (a instanceof THREE.Vector3) return toScreen(a);
        a.mesh.getVertexPosition(a.index, v);
        a.mesh.localToWorld(v).project(camera);
        return { x: (v.x * 0.5 + 0.5) * width, y: (-v.y * 0.5 + 0.5) * height };
      };
      // Tags sit in two columns outside the arm span, joined to the anatomy by leader lines.
      const centre = toScreen(new THREE.Vector3(0, 0.9, 0));
      const span = Math.abs(toScreen(new THREE.Vector3(0.6, 0.9, 0)).x - centre.x) + 22;
      const placed = Array.from(layer.children as HTMLCollectionOf<HTMLElement>).map(el => {
        const id = el.dataset.region!;
        const a = anchors.get(id);
        const p = a ? anchorScreen(a) : { x: -99, y: -99 };
        return { el, id, p, side: LEFT.has(id) ? -1 : 1, y: p.y };
      });
      for (const side of [-1, 1]) {
        const col = placed.filter(t => t.side === side).sort((m, n) => m.y - n.y);
        for (let i = 1; i < col.length; i++) col[i].y = Math.max(col[i].y, col[i - 1].y + 34);
        const overflow = col.length ? col[col.length - 1].y - (height - 18) : 0;
        if (overflow > 0) col.forEach(t => { t.y -= overflow; });
      }
      const lines = leaders.children;
      placed.forEach((t, i) => {
        const x = Math.min(width - 16, Math.max(16, centre.x + t.side * span));
        t.el.style.opacity = t.p.x < 0 ? '0' : '1';
        t.el.style.transform = `translate(${x}px, ${t.y}px)`;
        const line = lines[i] as SVGPolylineElement | undefined;
        if (line) line.setAttribute('points', `${t.p.x},${t.p.y} ${x - t.side * 22},${t.y} ${x - t.side * 13},${t.y}`);
      });
    };
    frame = requestAnimationFrame(tick);
    const onLost = (e: Event) => { e.preventDefault(); setStatus('failed'); };
    renderer.domElement.addEventListener('webglcontextlost', onLost);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener('webglcontextlost', onLost);
      parts.forEach(p => { p.mesh.geometry.dispose(); p.mat.material.dispose(); });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  useEffect(() => { repaint.current(); }, [selected, states]);

  return <div className="body-stage">
    <div ref={mount} className="body-canvas" aria-hidden="true"/>
    <svg ref={leaderLayer} className="body-leaders" aria-hidden="true">
      {regions.map(r => <polyline key={r.id} className={selected === r.id ? 'on' : ''} points=""/>)}
    </svg>
    <div ref={tagLayer} className="body-tags" aria-hidden="true">
      {regions.map(r => <button key={r.id} tabIndex={-1} data-region={r.id} className={`tag ${selected === r.id ? 'on' : ''} ${states[r.id]?.state ?? ''}`} onClick={() => onSelect(r.id as RegionId)}>{r.letter}</button>)}
    </div>
    {children}
    {status === 'loading' && <p className="stage-note" role="status">Loading body…</p>}
    {status === 'failed' && <p className="stage-note" role="status">3D view unavailable. Use the index below.</p>}
  </div>;
}

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { regionForMesh } from './body.mjs';
import { cardMaterial, outlineMaterial } from './BodyView';

/**
 * The body figure alone, seen from the front like the scan camera, shaped by a set of morph weights.
 * The scan result puts it beside the recorded clip, so the crew member can see what the scan did to the figure.
 * It draws only while the shape is changing.
 */
export default function FigurePreview({ weights }: { weights: Record<string, number> }) {
  const mount = useRef<HTMLDivElement>(null);
  const goal = useRef(weights);
  const wake = useRef<() => void>(() => {});
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  goal.current = weights;

  useEffect(() => {
    const container = mount.current!;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' }); }
    catch { setStatus('failed'); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(26, 3 / 4, 0.1, 30);
    scene.add(new THREE.HemisphereLight('#fffaf0', '#8b8f94', 2.1));
    const key = new THREE.DirectionalLight('#ffffff', 1.6); key.position.set(1.5, 3, 2.5); scene.add(key);
    const parts: { mesh: THREE.Mesh; material: THREE.Material }[] = [];
    const current: Record<string, number> = {};
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let disposed = false, frame = 0;

    const draw = () => {
      frame = 0;
      let moving = false;
      for (const [name, value] of Object.entries(goal.current)) {
        const now = current[name] ?? 0, next = reduced || Math.abs(value - now) < 1e-3 ? value : now + (value - now) * 0.18;
        if (next !== value) moving = true;
        current[name] = next;
      }
      for (const { mesh } of parts) {
        const dict = mesh.morphTargetDictionary, infl = mesh.morphTargetInfluences;
        if (dict && infl) for (const [name, i] of Object.entries(dict)) infl[i] = current[name] ?? 0;
      }
      renderer.render(scene, camera);
      if (moving) frame = requestAnimationFrame(draw);
    };
    wake.current = () => { if (!frame && !disposed) frame = requestAnimationFrame(draw); };

    new GLTFLoader().load('/models/body.glb', gltf => {
      if (disposed) return;
      const meshes: THREE.Mesh[] = [];
      gltf.scene.traverse(obj => { if ((obj as THREE.Mesh).isMesh) meshes.push(obj as THREE.Mesh); });
      const box = new THREE.Box3();
      gltf.scene.updateMatrixWorld(true);
      meshes.forEach(mesh => {
        const region = regionForMesh(mesh.name) ?? regionForMesh(mesh.parent?.name ?? '');
        // The deck under the feet belongs to the body index, not to the person.
        if (!region || region.id === 'cabin') { mesh.visible = false; return; }
        const { material } = cardMaterial();
        mesh.material = material;
        const outline = new THREE.Mesh(mesh.geometry, outlineMaterial);
        outline.morphTargetInfluences = mesh.morphTargetInfluences;
        outline.morphTargetDictionary = mesh.morphTargetDictionary;
        mesh.add(outline);
        parts.push({ mesh, material });
        // The resting shape only: a geometry's own bounding box also spans every morph target.
        box.union(new THREE.Box3().setFromBufferAttribute(mesh.geometry.getAttribute('position') as THREE.BufferAttribute).applyMatrix4(mesh.matrixWorld));
      });
      scene.add(gltf.scene);
      // Frame the reference body with room for the widest and tallest morphs.
      const centre = box.getCenter(new THREE.Vector3()), tall = box.max.y - box.min.y;
      camera.position.set(centre.x, centre.y, centre.z + (tall * 1.12) / (2 * Math.tan(THREE.MathUtils.degToRad(13))));
      camera.lookAt(centre);
      Object.assign(current, goal.current);
      setStatus('ready');
      wake.current();
    }, undefined, () => !disposed && setStatus('failed'));

    const resize = () => {
      const { width, height } = container.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      wake.current();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    const onLost = (e: Event) => { e.preventDefault(); setStatus('failed'); };
    renderer.domElement.addEventListener('webglcontextlost', onLost);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', onLost);
      parts.forEach(p => { p.mesh.geometry.dispose(); p.material.dispose(); });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  useEffect(() => { wake.current(); }, [weights]);

  return <div className="figure-preview">
    <div ref={mount} className="figure-canvas" aria-hidden="true"/>
    {status !== 'ready' && <p className="stage-note" role="status">{status === 'loading' ? 'Loading body…' : '3D view unavailable.'}</p>}
  </div>;
}

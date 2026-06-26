import React, { useRef, useEffect, useState, useMemo, useLayoutEffect, Suspense } from 'react';
import { createPortal } from 'react-dom';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, Html, useProgress, Environment, OrbitControls } from '@react-three/drei';
import './DroneExperience.css';

// Fallback model if a drone record has no modelUrl (shouldn't happen in prod).
const DEFAULT_MODEL_URL = '/drone-draco.glb';

// How far parts fly apart at peak explosion, as a multiple of each part's
// distance from the model centre (so outer parts travel further — a classic
// exploded view). Tune to taste.
const EXPLODE_STRENGTH = 1.8;
// Full sequence = one 360° turn. +1 = counter-clockwise viewed from above.
const SPIN_DIRECTION = 1;
// Wheel sensitivity: smaller = more scrolling needed for the full sequence.
const SCROLL_SENSITIVITY = 0.0006;
// How quickly the model eases toward the scroll target (0..1 per frame).
const SMOOTHING = 0.08;
// Camera choreography: it orbits OPPOSITE to the drone's spin while rising and
// dipping, tracing a diagonal up-and-down arc over the full sequence.
const CAM_DIST_FACTOR = 2.6; // distance from centre, in bounding-sphere radii
const CAM_ELEV_BASE = 0.30;  // resting elevation above the horizon (radians)
const CAM_ELEV_AMP = 0.5;    // up/down swing amplitude (radians)
// Shift the rendered subject toward the right (fraction of width) so the
// left side is free for the description/components panel. Negative = right.
const CAM_VIEW_SHIFT = 0.18;
// Scroll progress at which the intro animation is "done" and free-orbit unlocks.
const INTERACT_THRESHOLD = 0.995;
// How far a selected component slides out, as a fraction of the model radius.
const EXTRACT_DIST = 0.5;

// Reused scratch vector for per-frame world-position reads (avoids allocations).
const _worldPos = new THREE.Vector3();
// CAD (FreeCAD) is Z-up; three.js is Y-up. Tilt the model -90° about X so its
// rotor plane lies flat → yaw about Y is then the correct horizontal spin.
// If the drone appears upside-down, flip the sign to +Math.PI / 2.
const MODEL_TILT_X = Math.PI / 2;
// Starting yaw so the drone's front (webcam) faces the camera at rest. If the
// back or a side faces you instead, try Math.PI, -Math.PI / 2, or 0.
const MODEL_YAW_OFFSET = Math.PI / 2;

// Per-part materials, keyed by category. metalness/roughness tuned to read
// against the studio Environment below.
const PALETTE = {
  carbon:  { color: '#15171b', metalness: 0.4, roughness: 0.45 },
  silver:  { color: '#c9ced4', metalness: 0.95, roughness: 0.28 },
  black:   { color: '#08080a', metalness: 0.1, roughness: 0.6 }, // matte, reads black under HDR
  webcam:  { color: '#74879b', metalness: 0.25, roughness: 0.45 }, // blue-grey steel tint
  gold:    { color: '#d3a72c', metalness: 0.9, roughness: 0.33 },
  green:   { color: '#2f9e44', metalness: 0.25, roughness: 0.5 },
  blue:    { color: '#2f6bff', metalness: 0.35, roughness: 0.4 },
  neutral: { color: '#2b2e34', metalness: 0.5, roughness: 0.5 },
};

// Procedural triplanar carbon-fibre weave. The meshes have no UVs (FreeCAD
// didn't export any), so we sample a woven pattern from object-space position,
// blended across the three axes by the surface normal — no UVs required.
function applyCarbonWeave(material) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCfPos;\nvarying vec3 vCfNormal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCfPos = position;\nvCfNormal = normal;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vCfPos;
varying vec3 vCfNormal;
float cfWeave(vec2 uv){
  vec2 g = abs(fract(uv) - 0.5);
  float cb = mod(floor(uv.x) + floor(uv.y), 2.0);     // basket-weave cells
  float thread = smoothstep(0.46, 0.5, max(g.x, g.y)); // dark groove between threads
  return cb * 0.6 - thread * 0.35;
}`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
{
  vec3 nn = abs(normalize(vCfNormal));
  nn /= (nn.x + nn.y + nn.z + 1e-5);
  float sc = 150.0; // weave cells ~ a few mm on a ~0.5 m model
  float p = cfWeave(vCfPos.yz * sc) * nn.x
          + cfWeave(vCfPos.xz * sc) * nn.y
          + cfWeave(vCfPos.xy * sc) * nn.z;
  diffuseColor.rgb = mix(vec3(0.030, 0.034, 0.040), vec3(0.105, 0.115, 0.135), clamp(p + 0.5, 0.0, 1.0));
}`);
  };
  material.customProgramCacheKey = () => 'carbon-weave-v1';
}

// Map a part's node name to a palette category. Order matters: more specific
// keywords (e.g. "arm mount", "standoff") are tested before broader ones.
function categorize(rawName) {
  const n = (rawName || '').toLowerCase();
  if (n.includes('standoff')) return 'gold';
  if (n.includes('arm mount') || n.includes('motor mount')) return 'black';
  if (n.includes('landing gear')) return 'black';
  if (n.includes('pixhawk')) return 'black';
  if (n.includes('gps')) return 'black';
  if (n.includes('ld06') || n.includes('lidar')) return 'black';
  if (n.includes('propeller')) return 'blue';
  if (n.includes('motor')) return 'silver';
  if (n.includes('dropping')) return 'silver';
  if (n.includes('arm')) return 'carbon';
  if (n.includes('plate')) return 'carbon';
  if (n.includes('logitech') || n.includes('c270')) return 'webcam';
  if (n.includes('raspberry') || n.includes('pi_5')) return 'green';
  if (n.includes('batter')) return 'green'; // "Li ion Battery" (standoffs handled above)
  return 'neutral';
}

// Imported detail models that replace placeholder CAD blocks, matched by node
// name. `rotation` (radians, model-local Z-up frame) and `scale` are manual
// nudges on top of the automatic bounding-box fit.
const PART_SWAPS = [
  {
    url: '/RaspberryPi5_4GB.glb',
    test: (n) => n.includes('raspberry') || n.includes('pi_5'),
    rotation: [-Math.PI / 2, 0, 0], // lay the board flat, top face up
    scale: 1.0,
  },
  // Motors intentionally NOT swapped — keep the original CAD motors.
];

// Hide a placeholder node's geometry and drop an imported model into its
// bounding box (auto position + scale), as a child so it rides the explode.
function fitAndReplace(node, sourceScene, rotation, scaleMul) {
  if (!sourceScene) return;
  node.updateWorldMatrix(true, true);
  const phBox = new THREE.Box3().setFromObject(node);
  if (phBox.isEmpty()) return;
  const phCenter = phBox.getCenter(new THREE.Vector3());
  const phSize = phBox.getSize(new THREE.Vector3());

  // Hide the placeholder meshes (done before adding the replacement).
  node.traverse((o) => { if (o.isMesh) o.visible = false; });

  const repl = sourceScene.clone(true);
  repl.rotation.set(rotation[0], rotation[1], rotation[2]);

  const holder = new THREE.Group();
  holder.add(repl);
  const rBox = new THREE.Box3().setFromObject(repl);
  const rSize = rBox.getSize(new THREE.Vector3());
  const rCenter = rBox.getCenter(new THREE.Vector3());
  repl.position.sub(rCenter); // centre the replacement at the holder origin

  const fit =
    Math.max(phSize.x, phSize.y, phSize.z) /
    Math.max(rSize.x, rSize.y, rSize.z || 1e-6);
  const s = fit * (scaleMul || 1);

  // Counter the node's own world transform so the holder lands correctly in
  // node-local space (placeholder centre, world-aligned orientation, fitted scale).
  const nPos = new THREE.Vector3();
  const nQuat = new THREE.Quaternion();
  const nScl = new THREE.Vector3();
  node.matrixWorld.decompose(nPos, nQuat, nScl);
  holder.quaternion.copy(nQuat).invert();
  const avgScale = (nScl.x + nScl.y + nScl.z) / 3 || 1;
  holder.scale.setScalar(s / avgScale);
  holder.position.copy(node.worldToLocal(phCenter.clone()));

  repl.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  node.add(holder);
}

/**
 * The drone model. Centres itself at the origin, then on every frame maps the
 * smoothed scroll progress (0..1) to:
 *   - explosion  = sin(pi * p)   → 0 at start, peak at the half-way point, 0 at end
 *   - yaw        = p * 2pi       → exactly one full revolution
 * So it explodes while rotating through the first half, then reassembles while
 * finishing the turn, landing back where it started, fully assembled.
 */
function DroneModel({ progressRef, modelUrl, onComplete, selected }) {
  // Second arg = Draco decoder path; self-hosted in public/draco/ (no CDN).
  const { scene } = useGLTF(modelUrl, '/draco/');
  const piGltf = useGLTF('/RaspberryPi5_4GB.glb', '/draco/');
  const pivotRef = useRef();
  const trackerRef = useRef(); // follows the selected part for the callout anchor
  const interactiveRef = useRef(false);
  const selectedRef = useRef(null);
  selectedRef.current = selected;
  const { camera, size } = useThree();

  // Clone so repeated open/close doesn't accumulate transforms on the cached gltf.
  const model = useMemo(() => scene.clone(true), [scene]);

  // Recolour each part by category. One shared material per category.
  useMemo(() => {
    const cache = {};
    const matFor = (key) => {
      if (!cache[key]) {
        const p = PALETTE[key];
        const mat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(p.color),
          metalness: p.metalness,
          roughness: p.roughness,
          side: THREE.DoubleSide,
        });
        if (key === 'carbon') applyCarbonWeave(mat);
        cache[key] = mat;
      }
      return cache[key];
    };
    for (const part of model.children) {
      const mat = matFor(categorize(part.name));
      part.traverse((o) => {
        if (o.isMesh) {
          o.material = mat;
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
    }
  }, [model]);

  // Record each part's rest position + radial explode vector, all in the model's
  // own LOCAL space. Centring and the Z-up→Y-up tilt are applied by wrapper
  // groups (below), so the explode math stays independent of them.
  const { parts, center, radius } = useMemo(() => {
    model.position.set(0, 0, 0);
    model.rotation.set(0, 0, 0);
    model.scale.set(1, 1, 1);
    model.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(model);
    const c = box.getCenter(new THREE.Vector3());
    const r = box.getBoundingSphere(new THREE.Sphere()).radius || 1;

    const list = model.children.map((node) => {
      const b = new THREE.Box3().setFromObject(node);
      const cc = b.getCenter(new THREE.Vector3());
      const dir = cc.clone().sub(c); // radial direction from model centre (local space)
      // Unit direction a selected part slides along; central parts lift up (+Z local).
      const extractDir = dir.lengthSq() > 1e-6 ? dir.clone().normalize() : new THREE.Vector3(0, 0, 1);
      return {
        node,
        base: node.position.clone(),
        dir,
        extractDir,
        cur: 0, // animated isolate amount (0..1), mutated in useFrame
      };
    });

    return { parts: list, center: c, radius: r };
  }, [model]);

  // Swap placeholder blocks for imported detail models (Pi, motors). Runs after
  // `parts` so the model is at identity and bounding boxes are accurate.
  useMemo(() => {
    const sources = {
      '/RaspberryPi5_4GB.glb': piGltf.scene,
    };
    for (const node of model.children) {
      const name = (node.name || '').toLowerCase();
      const swap = PART_SWAPS.find((sw) => sw.test(name));
      if (swap) fitAndReplace(node, sources[swap.url], swap.rotation, swap.scale);
    }
  }, [model, piGltf.scene]);

  // Frame the camera to the model size once (set near/far + the p=0 pose so the
  // first frame doesn't flash; useFrame drives it from there).
  useLayoutEffect(() => {
    const dist = radius * CAM_DIST_FACTOR;
    camera.position.set(0, dist * Math.sin(CAM_ELEV_BASE), dist * Math.cos(CAM_ELEV_BASE));
    camera.near = radius * 0.02;
    camera.far = radius * 50;
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [radius, camera]);

  const smoothed = useRef(0);
  const viewShiftRef = useRef(0); // 0 = centred (during intro), 1 = shifted right

  useFrame(() => {
    const target = progressRef.current;
    smoothed.current += (target - smoothed.current) * SMOOTHING;
    const p = smoothed.current;

    // Flip into / out of free-orbit mode as the intro animation completes.
    const isComplete = p >= INTERACT_THRESHOLD;
    if (isComplete !== interactiveRef.current) {
      interactiveRef.current = isComplete;
      onComplete?.(isComplete);
    }

    const explode = Math.sin(Math.PI * THREE.MathUtils.clamp(p, 0, 1));
    const selName = selectedRef.current?.nodeName;
    for (const part of parts) {
      // ease this part's "isolated" amount toward 1 if selected, else 0
      const goal = selName && part.node.name === selName ? 1 : 0;
      part.cur += (goal - part.cur) * 0.18;
      part.node.position
        .copy(part.base)
        .addScaledVector(part.dir, explode * EXPLODE_STRENGTH)
        .addScaledVector(part.extractDir, part.cur * radius * EXTRACT_DIST);
    }
    if (pivotRef.current) {
      pivotRef.current.rotation.y = MODEL_YAW_OFFSET + p * Math.PI * 2 * SPIN_DIRECTION;
    }

    // Anchor the callout to the selected part's current world position so the
    // leader line + box track it as the camera orbits.
    if (trackerRef.current && selName) {
      const part = parts.find((pt) => pt.node.name === selName);
      if (part) {
        part.node.updateWorldMatrix(true, false);
        part.node.getWorldPosition(_worldPos);
        trackerRef.current.position.copy(_worldPos);
      }
    }

    // While the intro plays, the camera is scroll-driven (orbit opposite to the
    // drone + diagonal rise/dip). Once complete, OrbitControls owns the camera.
    if (!isComplete) {
      const dist = radius * CAM_DIST_FACTOR;
      const az = -p * Math.PI * 2 * SPIN_DIRECTION;
      const el = CAM_ELEV_BASE + CAM_ELEV_AMP * Math.sin(Math.PI * 2 * p);
      const cosEl = Math.cos(el);
      camera.position.set(
        dist * cosEl * Math.sin(az),
        dist * Math.sin(el),
        dist * cosEl * Math.cos(az),
      );
      camera.lookAt(0, 0, 0);
    }

    // Once complete, ease the projection so the drone slides to the right and
    // frees the left for the panel. Centred (offset 0) during the intro.
    const targetShift = isComplete ? 1 : 0;
    viewShiftRef.current += (targetShift - viewShiftRef.current) * 0.08;
    if (size.width > 0) {
      const sx = -size.width * CAM_VIEW_SHIFT * viewShiftRef.current;
      camera.setViewOffset(size.width, size.height, sx, 0, size.width, size.height);
      camera.updateProjectionMatrix();
    }
  });

  // pivot (animated yaw) → tilt (Z-up fix) → centre → model.
  return (
    <>
      <group ref={pivotRef}>
        <group rotation={[MODEL_TILT_X, 0, 0]}>
          <group position={[-center.x, -center.y, -center.z]}>
            <primitive object={model} />
          </group>
        </group>
      </group>


      {/* Leader-line callout that tracks the selected component. */}
      <group ref={trackerRef}>
        {selected && (
          <Html className="drone-callout" style={{ pointerEvents: 'none' }} zIndexRange={[120, 0]}>
            <div className="drone-callout-inner">
              <span className="drone-callout-dot" />
              <span className="drone-callout-leader" />
              <div className="drone-callout-box">
                <h4>{selected.label || selected.nodeName}</h4>
                {selected.description && <p>{selected.description}</p>}
              </div>
            </div>
          </Html>
        )}
      </group>
    </>
  );
}

// Drone models load on demand (dynamic Cloudinary URLs); only the local Pi
// detail model is preloaded since it's reused across the Swaayatt drone.
useGLTF.preload('/RaspberryPi5_4GB.glb', '/draco/');

function Loader() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div className="drone-loader">Loading model… {Math.round(progress)}%</div>
    </Html>
  );
}

/**
 * Full-screen takeover holding the scroll-driven 3D drone. The background matches
 * the site (navy) rather than black, and the drone is shifted right so the left
 * holds the info panel. Scrolling drives the intro; once it completes the user
 * can freely orbit, and the description + component list appear on the left.
 */
export default function DroneExperience({
  onClose,
  modelUrl = DEFAULT_MODEL_URL,
  name = '',
  description = '',
  components = [],
}) {
  const overlayRef = useRef(null);
  const progressRef = useRef(0); // 0..1 target progress, driven by the wheel
  const [interactive, setInteractive] = useState(false);
  const [selected, setSelected] = useState(null); // selected component object

  // Entering free-orbit reveals the panel; leaving it clears any selection.
  const handleComplete = (done) => {
    setInteractive(done);
    if (!done) setSelected(null);
  };

  useEffect(() => {
    const el = overlayRef.current;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    const onWheel = (e) => {
      e.preventDefault();
      const next = progressRef.current + e.deltaY * SCROLL_SENSITIVITY;
      progressRef.current = THREE.MathUtils.clamp(next, 0, 1);
    };
    document.addEventListener('keydown', onKey);
    el?.addEventListener('wheel', onWheel, { passive: false });
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Hide the page content behind the transparent overlay so only the site's
    // Silk background shows through (the class is handled in the CSS).
    document.body.classList.add('drone-open');
    return () => {
      document.removeEventListener('keydown', onKey);
      el?.removeEventListener('wheel', onWheel);
      document.body.style.overflow = prevOverflow;
      document.body.classList.remove('drone-open');
    };
  }, [onClose]);

  return createPortal(
    <div className="drone-experience" ref={overlayRef} role="dialog" aria-modal="true">
      <button className="drone-experience-close" onClick={onClose} aria-label="Close">×</button>
      <div className="drone-experience-hint">
        {interactive ? 'Drag to rotate · scroll up to replay · Esc to close' : 'Scroll to explode & rotate · Esc to close'}
      </div>

      <div className="drone-hud" aria-hidden="true">
        <div>┌─ DRONE.VIEWER ─────────</div>
        <div>│ model   : {name || 'unknown'}</div>
        <div>│ parts   : {components.length} mapped</div>
        <div>│ status  : {interactive ? 'READY' : 'RENDERING'}</div>
        <div>└─ {interactive ? 'select a component' : 'scroll to inspect'} <span className="drone-hud-cursor">▮</span></div>
      </div>

      {/* Info panel — appears once the intro animation finishes. */}
      {interactive && (
        <div className="drone-panel">
          {name && <h2 className="drone-panel-name">{name}</h2>}
          {description && <p className="drone-panel-desc">{description}</p>}
          {components.length > 0 && (
            <div className="drone-components">
              <h3 className="drone-components-title">// COMPONENTS</h3>
              {components.map((c) => (
                <button
                  key={c.nodeName}
                  type="button"
                  className={`drone-component-item ${selected?.nodeName === c.nodeName ? 'active' : ''}`}
                  onClick={() => setSelected(selected?.nodeName === c.nodeName ? null : c)}
                >
                  {c.label || c.nodeName}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <Canvas
        camera={{ fov: 45, position: [0, 0.3, 1.4], near: 0.01, far: 100 }}
        gl={{ antialias: true, powerPreference: 'high-performance', alpha: true }}
        dpr={[1, 2]}
      >
        <ambientLight intensity={0.45} />
        <hemisphereLight skyColor="#cfe8ff" groundColor="#101018" intensity={0.5} />
        <directionalLight position={[5, 8, 6]} intensity={1.4} />
        <directionalLight position={[-6, 3, -4]} intensity={0.7} color="#9ec5ff" />

        <Suspense fallback={<Loader />}>
          {/* Studio HDR gives the metals real reflections against the black. */}
          <Environment preset="warehouse" environmentIntensity={0.8} />
          <DroneModel progressRef={progressRef} modelUrl={modelUrl} onComplete={handleComplete} selected={selected} />
        </Suspense>

        {/* Free-orbit only after the intro completes; wheel stays reserved for
            the timeline (so scrolling up replays), hence zoom off. */}
        {interactive && (
          <OrbitControls makeDefault enablePan={false} enableZoom={false} enableDamping dampingFactor={0.1} />
        )}
      </Canvas>
    </div>,
    document.body,
  );
}

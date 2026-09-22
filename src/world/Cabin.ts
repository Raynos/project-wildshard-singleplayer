import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { loadPBR, loadGLTF, pbrMaterial, type PBRSet } from '../core/assets';
import { Rng } from '../core/rng';
import { SEED } from '../core/config';
import { heightAt, CABIN_SITES } from './Heightfield';
import { attachFogUniforms } from './Atmosphere';
import type { Sky } from './Sky';
import type { Collider } from '../player/Player';
import { TIER_CONFIG } from '../core/tier';
import { macrotask } from '../boot/plan';

/**
 * The three log cabins of the chunk.
 *
 *   const cabins = new Cabins(sky);
 *   const { group, colliders, interactables } = await cabins.build();
 *   scene.add(group); player.colliders.push(...colliders);
 *   game.onUpdate((dt, t) => cabins.update(dt, t));
 *
 * - `group`         everything static + animated (doors, fire, smoke, lantern).
 * - `colliders`     oriented boxes (Player.ts format) for walls, chimney, porch rails/posts,
 *                   furniture, woodpiles, fire pit. A door's collider is disabled while it is open.
 * - `interactables` one per door: `{ position, radius, label, onInteract() }`. `label` toggles
 *                   "Open door" / "Close door". Call `onInteract()` from the HUD's use key.
 * - `update(dt, t)` door swing (0.6 s ease in-out), fire / lantern flicker, smoke + embers.
 * - `floorHeightAt(x, z)` → world y of a cabin floor / porch deck under (x,z), or undefined
 *                   (Player has no walkable platforms yet — the floor is only 22 cm above the pad).
 * - `firePits`      `{ x, y, z }` of the camp fires (audio / warmth logic).
 *
 * Cabin local frame: door + porch face local +X, the ridge runs along local Z. The whole cabin is
 * rotated by CABIN_SITES[i].rot around Y and sits on `heightAt(site)` (pads are flat; the stone
 * plinth reaches 0.9 m below ground so no residual mismatch can show).
 *
 * Built procedurally from the Poly Haven PBR sets: every wall log is a real cylinder (round
 * silhouette, interleaved notched-corner overhangs, chinking slab behind), the roof is planks over
 * rafters + purlins + a ridge log, doors are hinged plank doors that swing inward, windows have
 * frames, mullions and reflective glass with a warm interior glow. Static geometry is merged per
 * material: ~14 draw calls per cabin, props are instanced across cabins.
 */

export interface Interactable { position: THREE.Vector3; radius: number; label: string; onInteract: () => void }

const LOG = 0.25;           // log row pitch (m)
const LOG_R = 0.112;        // log radius → ~2.6 cm chinking line between logs
const OVERHANG = 0.32;      // notched log ends past the corner
const BOARDS = 7;           // boards across the wood_trunk_wall texture
const BOARD_LEN = 1.25;     // texture size (m) along the board grain
const PLINTH = 0.18;        // stone foundation above ground
const FLOOR = PLINTH + 0.04;
const RAFTER_H = 0.14;
const SHEET = 0.045;

interface Opening { a0: number; a1: number; y0: number; y1: number } // along-wall range, height range (absolute local y)
const FRAME = 0.09;                                                   // window frame thickness
/** snap a height to the nearest chinking gap of a wall (eave walls: rows at (i+½)·LOG, gable walls: (i+1)·LOG) */
function snapRow(y: number, gableWall: boolean) {
  const off = gableWall ? 0.5 : 0;
  return PLINTH + (Math.round((y - PLINTH) / LOG - off) + off) * LOG;
}
/** the hole cut through the logs for a window: glass opening + frame, top/bottom snapped to log gaps so no cut log end shows */
function roughOpening(o: Opening, gableWall: boolean): Opening {
  return { a0: o.a0 - FRAME + 0.01, a1: o.a1 + FRAME - 0.01, y0: snapRow(o.y0 - FRAME, gableWall), y1: snapRow(o.y1 + FRAME, gableWall) };
}
type WallId = 'front' | 'back' | 'zpos' | 'zneg';
interface WallExt { from?: number; to?: number; overhangFrom?: boolean; overhangTo?: boolean }
interface LogBoxOpts {
  gables: { zpos: boolean; zneg: boolean };
  skip?: WallId[];
  ext?: Partial<Record<WallId, WallExt>>;
  openings?: Partial<Record<WallId, Opening[]>>;
}

interface WindowSpec { wall: WallId; at: number; w?: number; y?: number; h?: number }
interface CabinSpec {
  W: number; L: number; rows: number; pitch: number;
  doorZ: number;
  windows: WindowSpec[];
  chimney: 'zpos' | 'zneg';
  porchDepth: number;
  annex?: { W: number; L: number; rows: number; pitch: number };   // L-shaped wing off the gable end opposite the chimney
  leanTo?: boolean;                                               // wood shed on the gable end opposite the chimney
  lantern?: boolean;
  firePit?: boolean;
  bench?: 'logs' | 'table';
}

const SPECS: CabinSpec[] = [
  { // cabin 1 — the hollow: classic 7×5, camp fire out front with log benches
    W: 5, L: 7, rows: 11, pitch: 0.72, doorZ: 0.9,
    windows: [{ wall: 'front', at: -1.6 }, { wall: 'back', at: 0.6 }, { wall: 'zpos', at: -1.5 }],
    chimney: 'zneg', porchDepth: 2.1, firePit: true, bench: 'logs', leanTo: true, lantern: true,
  },
  { // cabin 2 — 9×6 with an L-shaped annex, lantern on the porch, table outside
    W: 6, L: 9, rows: 12, pitch: 0.66, doorZ: 1.2,
    windows: [{ wall: 'front', at: -1.5 }, { wall: 'front', at: 3.2, w: 0.7 }, { wall: 'zneg', at: 1.6 }, { wall: 'back', at: 3.0 }],
    chimney: 'zneg', porchDepth: 2.3, annex: { W: 3.6, L: 4.0, rows: 8, pitch: 0.55 }, lantern: true, bench: 'table',
  },
  { // cabin 3 — the ridge: 6×5, steep roof, lean-to wood shed
    W: 5, L: 6, rows: 11, pitch: 0.82, doorZ: -0.6,
    windows: [{ wall: 'front', at: 1.5 }, { wall: 'back', at: 0 }, { wall: 'zneg', at: -1.3, w: 0.7, h: 0.6 }],
    chimney: 'zpos', porchDepth: 1.9, leanTo: true, bench: 'logs', lantern: true,
  },
];

interface Door { pivot: THREE.Object3D; open: boolean; t: number; collider: Collider; interactable: Interactable }
interface Fire { light: THREE.PointLight; base: number; seed: number }
/** phone tier: a point light's slot — the 4 shared lights jump to the nearest cabin's anchors each frame */
interface LightAnchor { anchor: THREE.Object3D; color: number; intensity: number; distance: number; decay: number; seed: number }
interface CabinLod { root: THREE.Object3D; detail: THREE.Object3D[]; far: THREE.Object3D[]; anchors: LightAnchor[]; detailOn: boolean; farOn: boolean }
interface Swing { pivot: THREE.Object3D; seed: number }
interface Floor { x: number; z: number; rot: number; hw: number; hd: number; y: number }
type PropKind = 'crate' | 'barrel' | 'bucket' | 'hatchet';
/** one (geometry, material, world matrix) part of a flattened glTF prop */
interface PropPart { geometry: THREE.BufferGeometry; material: THREE.Material; matrix: THREE.Matrix4 }

// ───────────────────────────── materials ─────────────────────────────

interface Mats {
  log: THREE.MeshStandardMaterial; endGrain: THREE.MeshStandardMaterial; chink: THREE.MeshStandardMaterial;
  roof: THREE.MeshStandardMaterial; beam: THREE.MeshStandardMaterial; deck: THREE.MeshStandardMaterial;
  door: THREE.MeshStandardMaterial; stone: THREE.MeshStandardMaterial; glass: THREE.MeshStandardMaterial;
  bark: THREE.MeshStandardMaterial; iron: THREE.MeshStandardMaterial; cloth: THREE.MeshStandardMaterial;
  char: THREE.MeshStandardMaterial;
  smoke: THREE.ShaderMaterial; flame: THREE.ShaderMaterial; ember: THREE.ShaderMaterial; glow: THREE.MeshBasicMaterial;
}
type MatKey = Exclude<keyof Mats, 'smoke' | 'flame' | 'ember' | 'glow' | 'glass'>;

async function loadMats(sky: Sky): Promise<Mats> {
  const [logSet, roofSet, beamSet, deckSet, doorSet, stoneSet, barkSet] = await Promise.all([
    loadPBR('wood_trunk_wall'), loadPBR('wood_planks_grey'), loadPBR('wood_planks_grey'), loadPBR('wood_planks_dirt'),
    loadPBR('rough_pine_door'), loadPBR('stone_wall'), loadPBR('pine_bark'),
  ]);
  const std = (set: PBRSet, extra: THREE.MeshStandardMaterialParameters = {}) => pbrMaterial(set, { metalness: 0, ...extra });
  const m: Mats = {
    log: std(logSet, { color: new THREE.Color(0.95, 0.9, 0.84), normalScale: new THREE.Vector2(0.8, 0.8) }),
    endGrain: new THREE.MeshStandardMaterial({ map: makeEndGrainTexture(), roughness: 0.95, metalness: 0, color: 0xb0a48e }),
    chink: new THREE.MeshStandardMaterial({ color: 0x4d473f, roughness: 1, metalness: 0 }),
    roof: std(roofSet, { color: new THREE.Color(0.46, 0.43, 0.39), normalScale: new THREE.Vector2(1.3, 1.3) }),
    beam: std(beamSet, { color: new THREE.Color(0.9, 0.86, 0.8) }),
    deck: std(deckSet),
    door: std(doorSet, { color: new THREE.Color(0.72, 0.68, 0.62) }),
    stone: std(stoneSet, { color: new THREE.Color(0.58, 0.56, 0.53) }),
    glass: new THREE.MeshStandardMaterial({ // Standard, not Physical: same look, and it shares the double-sided program with the fire pit
      color: 0x0a0c0e, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.66, envMapIntensity: 0.8,
      emissive: new THREE.Color(1.0, 0.5, 0.17), emissiveIntensity: 1.15, side: THREE.DoubleSide, depthWrite: false,
    }),
    bark: std(barkSet, { color: new THREE.Color(0.85, 0.8, 0.75) }),
    iron: new THREE.MeshStandardMaterial({ color: 0x2b2724, roughness: 0.6, metalness: 0.75 }),
    cloth: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0, vertexColors: true }),
    char: new THREE.MeshStandardMaterial({ color: 0x14100d, roughness: 0.95, metalness: 0, emissive: 0xff4a08, emissiveIntensity: 0.12 }),
    smoke: makeParticleMaterial('smoke', sky),
    flame: makeParticleMaterial('flame', sky),
    ember: makeParticleMaterial('ember', sky),
    glow: new THREE.MeshBasicMaterial({ map: makeGlowTexture(), color: 0xff7a1a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
  };
  installMoss(m.roof, sky, 'roof');
  installMoss(m.stone, sky, 'stone');
  // the rough_pine_door scan is a saturated orange-red: pull it toward a weathered grey-brown in the shader
  m.door.onBeforeCompile = (shader) => {
    attachFogUniforms(shader);
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      diffuseColor.rgb = mix(vec3(dot(diffuseColor.rgb, vec3(0.333))), diffuseColor.rgb, 0.45) * vec3(0.9, 0.95, 1.0);`);
  };
  m.door.customProgramCacheKey = () => 'cabin-door';
  for (const k of ['log', 'endGrain', 'chink', 'roof', 'beam', 'deck', 'door', 'stone', 'glass', 'bark', 'iron', 'cloth', 'char'] as const) sky.setupMaterial(m[k]);
  return m;
}

function makeEndGrainTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  if (g === null) throw new Error('Cabin: no 2d canvas context');
  g.fillStyle = '#9d8b6c'; g.fillRect(0, 0, 256, 256);
  const rng = new Rng(SEED + 31);
  // weathering speckle
  for (let i = 0; i < 6000; i++) { g.fillStyle = rng.next() < 0.5 ? 'rgba(60,45,30,0.25)' : 'rgba(200,185,160,0.2)'; g.fillRect(rng.range(0, 256), rng.range(0, 256), 1 + rng.range(0, 2), 1 + rng.range(0, 2)); }
  for (let r = 4; r < 128; r += 3 + rng.range(0, 4)) {
    g.beginPath();
    for (let a = 0; a <= 64; a++) {
      const th = (a / 64) * Math.PI * 2;
      const rr = r * (1 + 0.05 * Math.sin(th * 3 + r) + 0.03 * Math.sin(th * 7));
      const x = 128 + Math.cos(th) * rr, y = 128 + Math.sin(th) * rr;
      if (a > 0) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.closePath();
    g.strokeStyle = rng.next() < 0.5 ? 'rgba(70,50,30,0.5)' : 'rgba(110,85,55,0.35)';
    g.lineWidth = 0.8 + rng.range(0, 1.4);
    g.stroke();
  }
  g.strokeStyle = 'rgba(40,28,15,0.8)';
  for (let i = 0; i < 7; i++) { const th = rng.range(0, Math.PI * 2), l = rng.range(50, 122); g.lineWidth = 1 + rng.range(0, 2); g.beginPath(); g.moveTo(128 + Math.cos(th) * 8, 128 + Math.sin(th) * 8); g.lineTo(128 + Math.cos(th + 0.05) * l, 128 + Math.sin(th + 0.05) * l); g.stroke(); }
  g.strokeStyle = '#3d2c1c'; g.lineWidth = 9; g.beginPath(); g.arc(128, 128, 124, 0, Math.PI * 2); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

function makeGlowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  if (g === null) throw new Error('Cabin: no 2d canvas context');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function makeNoiseTexture() {
  const s = 128, c = document.createElement('canvas'); c.width = c.height = s;
  const g = c.getContext('2d');
  if (g === null) throw new Error('Cabin: no 2d canvas context');
  const img = g.createImageData(s, s);
  const rng = new Rng(SEED + 77);
  const oct = [8, 16, 32].map((n) => { const a = new Float32Array(n * n); for (let i = 0; i < a.length; i++) a[i] = rng.next(); return { n, a }; });
  const sm = (t: number) => t * t * (3 - 2 * t);
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    let v = 0, amp = 0.55, sum = 0;
    for (const { n, a } of oct) {
      const fx = (x / s) * n, fy = (y / s) * n, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = sm(fx - x0), ty = sm(fy - y0);
      const q = (i: number, j: number) => a[((j + n) % n) * n + ((i + n) % n)] ?? 0;
      const vv = (q(x0, y0) * (1 - tx) + q(x0 + 1, y0) * tx) * (1 - ty) + (q(x0, y0 + 1) * (1 - tx) + q(x0 + 1, y0 + 1) * tx) * ty;
      v += vv * amp; sum += amp; amp *= 0.5;
    }
    const b = Math.floor((v / sum) * 255), i = (y * s + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = b; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

let noiseTex: THREE.Texture | undefined;

/** Billboard particle material driven entirely by uTime (no per-frame CPU work). */
function makeParticleMaterial(kind: 'smoke' | 'flame' | 'ember', sky: Sky) {
  noiseTex ??= makeNoiseTexture();
  const cfg = {
    smoke: { life: 11.0, rise: 12.0, spread: 0.25, size: [0.7, 4.6], wind: [1.6, 0.0, 0.45], blend: THREE.NormalBlending, fog: true },
    flame: { life: 0.85, rise: 0.95, spread: 0.36, size: [0.95, 0.3], wind: [0, 0, 0], blend: THREE.AdditiveBlending, fog: false },
    ember: { life: 2.8, rise: 3.4, spread: 0.4, size: [0.04, 0.012], wind: [0.3, 0, 0.15], blend: THREE.AdditiveBlending, fog: false },
  }[kind];
  const uniforms: Record<string, THREE.IUniform> = {
    uTime: { value: 0 }, uLife: { value: cfg.life }, uRise: { value: cfg.rise }, uSpread: { value: cfg.spread },
    uSize: { value: new THREE.Vector2(cfg.size[0], cfg.size[1]) }, uWind: { value: new THREE.Vector3(...cfg.wind) }, tNoise: { value: noiseTex },
    uSunDir: { value: sky.sunDir.clone() }, uSunColor: { value: sky.sunColor.clone() },
    ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uKind: { value: { smoke: 0, flame: 1, ember: 2 }[kind] },
  };
  return new THREE.ShaderMaterial({
    // one program for smoke / flame / ember: the kind is a uniform branch, not a define, and every kind carries the
    // fog uniforms (only smoke applies them) — three per-define variants were three ~150 ms compiles on the iPhone
    uniforms, transparent: true, depthWrite: false, blending: cfg.blend, fog: true, side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      attribute vec4 seed;
      uniform float uTime, uLife, uRise, uSpread; uniform vec2 uSize; uniform vec3 uWind; uniform vec3 uSunDir; uniform int uKind;
      varying vec2 vUv; varying float vAge; varying vec4 vSeed; varying vec2 vSunView;
      #include <fog_pars_vertex>
      void main() {
        float age = fract(uTime / uLife * (0.85 + 0.3 * seed.z) + seed.w);
        vAge = age; vSeed = seed; vUv = uv;
        float ang = seed.y * 6.2831853;
        vec3 p = vec3(cos(ang), 0.0, sin(ang)) * uSpread * sqrt(seed.z);
        if (uKind == 1) {
          p.y += age * uRise * (0.6 + 0.8 * seed.x);
          p.xz *= 1.0 - age * 0.55;
          p.x += sin(uTime * 7.0 + seed.x * 20.0) * 0.06 * age;
          p.z += cos(uTime * 6.3 + seed.y * 20.0) * 0.06 * age;
        } else {
          p.y += age * uRise * (0.7 + 0.6 * seed.x);
          p.x += sin(age * 9.0 + seed.x * 12.0) * 0.12 * age + sin(uTime * 1.3 + seed.y * 9.0) * 0.08 * age;
          p.z += cos(age * 7.0 + seed.y * 12.0) * 0.12 * age;
        }
        vec3 windW = vec3(0.0);
        if (uKind != 1) {
          // wind is a world-space vector: undo the cabin's yaw so every plume drifts the same way
          windW = (inverse(mat3(modelMatrix)) * uWind) * age * age * (0.6 + 0.8 * seed.x);
          if (uKind == 0) {
            windW += (inverse(mat3(modelMatrix)) * vec3(sin(uTime * 0.37 + seed.x * 6.0), 0.0, cos(uTime * 0.29 + seed.y * 6.0))) * 0.9 * age * age;
          }
          p += windW;
        }
        vSunView = normalize((viewMatrix * vec4(uSunDir, 0.0)).xy + vec2(1e-4));
        float size = mix(uSize.x, uSize.y, age) * (0.75 + 0.5 * seed.x);
        if (uKind == 0) {
          size = mix(uSize.x, uSize.y, pow(age, 0.7)) * (0.75 + 0.5 * seed.x) * smoothstep(0.0, 0.08, age);
        }
        vec3 transformed = p;
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        float rot = seed.x * 6.28 + age * (seed.y - 0.5) * 2.0;
        vec2 q = position.xy * size;
        if (uKind == 0) {
          q = vec2(q.x * cos(rot) - q.y * sin(rot), q.x * sin(rot) + q.y * cos(rot));
        }
        if (uKind == 1) {
          q.y *= 1.9;
        }
        mvPosition.xy += q;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D tNoise; uniform float uTime; uniform vec3 uSunColor; uniform int uKind;
      varying vec2 vUv; varying float vAge; varying vec4 vSeed; varying vec2 vSunView;
      #include <fog_pars_fragment>
      void main() {
        vec2 d = vUv - 0.5;
        if (uKind == 0) {
          float n = texture2D(tNoise, vUv * 1.3 + vSeed.xy * 3.0 + vec2(uTime * 0.015, -uTime * 0.04)).r;
          float n2 = texture2D(tNoise, vUv * 3.1 + vSeed.zw * 5.0 + vec2(-uTime * 0.03, -uTime * 0.02)).r;
          float m = smoothstep(0.5, 0.08, length(d) + (n - 0.5) * 0.42 + (n2 - 0.5) * 0.15);
          float a = m * 0.55 * smoothstep(0.0, 0.08, vAge) * (1.0 - smoothstep(0.3, 1.0, vAge));
          // lit on the sun side of each puff, cool blue-grey in its own shadow
          float lit = smoothstep(-0.55, 0.6, dot(d * 2.0, vSunView) + (n - 0.5) * 0.6);
          vec3 col = mix(vec3(0.36, 0.38, 0.44), vec3(0.95, 0.9, 0.85) * uSunColor * 1.25, lit) * (0.85 + 0.3 * n2);
          gl_FragColor = vec4(col, a);
          #include <fog_fragment>
        }
        if (uKind == 1) {
          vec2 uv = vUv;
          float n1 = texture2D(tNoise, uv * vec2(1.2, 0.7) + vec2(vSeed.x * 4.0, -uTime * 0.9 - vSeed.y * 5.0)).r;
          float n2 = texture2D(tNoise, uv * vec2(2.3, 1.4) + vec2(-vSeed.y * 3.0, -uTime * 1.6 + vSeed.x * 7.0)).r;
          float n = n1 * 0.65 + n2 * 0.35;
          float width = mix(0.42, 0.06, uv.y) * (0.7 + 0.6 * n);
          float body = smoothstep(width, width * 0.25, abs(d.x + (n - 0.5) * 0.25 * uv.y));
          body *= smoothstep(0.0, 0.18, uv.y) * smoothstep(1.0, 0.55, uv.y + (n - 0.5) * 0.4);
          float life = smoothstep(0.0, 0.1, vAge) * (1.0 - smoothstep(0.55, 1.0, vAge));
          float heat = body * (1.0 - uv.y * 0.6) * (1.0 - vAge * 0.5);
          vec3 col = mix(vec3(1.0, 0.18, 0.02), vec3(1.0, 0.62, 0.12), smoothstep(0.15, 0.6, heat));
          col = mix(col, vec3(1.0, 0.96, 0.75), smoothstep(0.55, 1.0, heat));
          gl_FragColor = vec4(col * body * life * 1.8, body * life);
        }
        if (uKind == 2) {
          float m = smoothstep(0.5, 0.15, length(d));
          float flick = 0.6 + 0.4 * sin(uTime * 17.0 + vSeed.x * 40.0);
          float life = smoothstep(0.0, 0.05, vAge) * (1.0 - smoothstep(0.4, 1.0, vAge));
          gl_FragColor = vec4(vec3(1.0, 0.55, 0.15) * 2.5 * m * flick * life, m * life);
        }
      }`,
  });
}

function makeParticles(mat: THREE.ShaderMaterial, count: number, rng: Rng) {
  const geo = new THREE.InstancedBufferGeometry();
  const quad = new THREE.PlaneGeometry(1, 1);
  geo.setAttribute('position', quad.getAttribute('position'));
  geo.setAttribute('uv', quad.getAttribute('uv'));
  geo.setIndex(quad.index);
  const seeds = new Float32Array(count * 4);
  for (let i = 0; i < seeds.length; i++) seeds[i] = rng.next();
  geo.setAttribute('seed', new THREE.InstancedBufferAttribute(seeds, 4));
  geo.instanceCount = count;
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 5, 0), 18);
  return new THREE.Mesh(geo, mat);
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
/** `instanceof THREE.Mesh` narrows to `Mesh<any, any>`; this keeps the default generics */
const isMesh = (o: THREE.Object3D): o is THREE.Mesh => 'isMesh' in o;

/**
 * Procedural moss / lichen overlay: value-noise patches in world space, denser where the `moss`
 * vertex attribute is high (eaves, foundation base) and on faces turned away from the sun, with a
 * soft normal bump along the patch edges.
 */
function installMoss(mat: THREE.MeshStandardMaterial, sky: Sky, kind: 'roof' | 'stone') {
  const strength = kind === 'roof' ? 1.0 : 0.6;
  mat.onBeforeCompile = (shader) => {
    attachFogUniforms(shader);
    shader.uniforms['uMossSun'] = { value: sky.sunDir };
    shader.uniforms['uMossStrength'] = { value: strength };
    shader.uniforms['uMossUpOnly'] = { value: kind === 'roof' ? 1.0 : 0.0 };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float moss; varying float vMoss; varying vec3 vMossPos; varying vec3 vMossN;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vMoss = moss; vMossPos = (modelMatrix * vec4(transformed, 1.0)).xyz; vMossN = normalize(mat3(modelMatrix) * objectNormal);`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform vec3 uMossSun; uniform float uMossStrength, uMossUpOnly;
        varying float vMoss; varying vec3 vMossPos; varying vec3 vMossN;
        float mossHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float mossNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
          return mix(mix(mossHash(i), mossHash(i + vec2(1, 0)), f.x), mix(mossHash(i + vec2(0, 1)), mossHash(i + vec2(1, 1)), f.x), f.y); }
        float mossFbm(vec2 p) { mat2 r = mat2(0.8, 0.6, -0.6, 0.8); vec2 p2 = r * p * 2.13 + 3.7; vec2 p3 = r * p2 * 2.02 + 9.1;
          return mossNoise(p) * 0.5 + mossNoise(p2) * 0.3 + mossNoise(p3) * 0.2; }
        float mossMask;`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          #ifdef USE_MAP
            vec2 mp = vMapUv * vec2(1.6, 3.6) + vMossPos.xz * 0.2;       // patches stretched along the planks
          #else
            vec2 mp = vMossPos.xz * 2.0 + vMossPos.y * 0.35;
          #endif
          float n = mossFbm(mp) * 0.8 + mossFbm(mat2(0.6, 0.8, -0.8, 0.6) * mp * 2.7 + 11.0) * 0.2;
          float patchy = 0.55 + 0.9 * mossNoise(mp * 0.3 + 2.0);            // large-scale variation so some stretches stay bare
          float shade = 1.0 - smoothstep(-0.3, 0.5, dot(vMossN, uMossSun));
          float density = (0.2 + 0.75 * pow(vMoss, 1.6) + 0.18 * shade) * patchy * uMossStrength * mix(1.0, smoothstep(-0.05, 0.45, vMossN.y), uMossUpOnly);
          float th = 0.8 - density * 0.5;
          mossMask = smoothstep(th, th + 0.22, n);
          float lichen = smoothstep(0.74, 0.86, mossFbm(mat2(0.6, 0.8, -0.8, 0.6) * mp * 4.0 + 17.0)) * density * 0.35;
          vec3 mossCol = mix(vec3(0.02, 0.038, 0.009), vec3(0.075, 0.115, 0.03), mossFbm(mp * 2.0 + 5.0));
          mossCol *= clamp(0.6 + 3.0 * dot(diffuseColor.rgb, vec3(0.33)), 0.6, 1.25);   // let the plank grain show through the mat
          vec3 lichenCol = vec3(0.055, 0.07, 0.04);
          diffuseColor.rgb = mix(diffuseColor.rgb, mossCol, mossMask);
          diffuseColor.rgb = mix(diffuseColor.rgb, lichenCol, lichen * (1.0 - mossMask));
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.97, mossMask);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          // bump along the moss patch edges (same maths as three's perturbNormalArb)
          float mh = mossMask * 0.35;
          vec2 dHdxy = vec2(dFdx(mh), dFdy(mh));
          vec3 sp = -vViewPosition;
          vec3 vSigmaX = dFdx(sp), vSigmaY = dFdy(sp);
          vec3 R1 = cross(vSigmaY, normal), R2 = cross(normal, vSigmaX);
          float fDet = dot(vSigmaX, R1) * faceDirection;
          vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
          normal = normalize(abs(fDet) * normal - vGrad * 6.0);
        }`);
  };
  mat.customProgramCacheKey = () => 'cabin-moss'; // strength / upOnly are uniforms: roof and stone share one program
}

// ───────────────────────────── geometry helpers ─────────────────────────────

/** planar UVs by dominant face normal, in the geometry's current space, metres / scale */
function boxUV(geo: THREE.BufferGeometry, scale: number, uOff = 0, vOff = 0) {
  const pos = geo.getAttribute('position'), nor = geo.getAttribute('normal');
  const uv = geo.getAttribute('uv');
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i));
    let u: number, v: number;
    if (ny >= nx && ny >= nz) { u = pos.getX(i); v = pos.getZ(i); }
    else if (nx >= nz) { u = pos.getZ(i); v = pos.getY(i); }
    else { u = pos.getX(i); v = pos.getY(i); }
    uv.setXY(i, u / scale + uOff, v / scale + vOff);
  }
  return geo;
}
function swapUV(geo: THREE.BufferGeometry) {
  const uv = geo.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getY(i), uv.getX(i));
  return geo;
}

/** a horizontal log along +X of `len`, radius r, textured with one board of the log-wall set (or bark when `bark`) */
function logGeo(len: number, r: number, board: number, vOff: number, segs = 14, bark = false) {
  const side = new THREE.CylinderGeometry(r, r, len, segs, 1, true);
  const pos = side.getAttribute('position'), uv = side.getAttribute('uv');
  for (let i = 0; i < pos.count; i++) {
    const th = Math.atan2(pos.getZ(i), pos.getX(i)) / (Math.PI * 2) + 0.5; // 0..1 around
    if (bark) uv.setXY(i, th * (r * 6.283) * 0.5, (pos.getY(i) + vOff) * 0.5); // pine_bark is a 2 m tile
    else {
      const tri = th < 0.5 ? th * 2 : 2 - th * 2;                              // mirror so the board wraps front & back
      uv.setXY(i, (board + 0.06 + tri * 0.88) / BOARDS, (pos.getY(i) + vOff) / BOARD_LEN);
    }
  }
  side.rotateZ(-Math.PI / 2); // +Y → +X
  const capA = new THREE.CircleGeometry(r, segs).rotateY(Math.PI / 2).translate(len / 2, 0, 0);
  const capB = new THREE.CircleGeometry(r, segs).rotateY(-Math.PI / 2).translate(-len / 2, 0, 0);
  return { side, caps: mergeGeometries([capA, capB]) };
}

/** @types/three says mergeGeometries always returns a geometry; at runtime it returns null on an attribute mismatch */
function mergeOrNull(list: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
  return mergeGeometries(list);
}

/** wall shape (rect or gable pentagon) with rectangular holes, extruded through the wall thickness; x = along, y = up, z = thickness */
function wallSlab(a0: number, a1: number, h: number, thick: number, openings: Opening[], gableApex?: number) {
  const s = new THREE.Shape();
  s.moveTo(a0, 0); s.lineTo(a1, 0); s.lineTo(a1, h);
  if (gableApex !== undefined) s.lineTo((a0 + a1) / 2, gableApex);
  s.lineTo(a0, h); s.closePath();
  for (const o of openings) {
    const p = new THREE.Path();
    p.moveTo(o.a0, o.y0); p.lineTo(o.a1, o.y0); p.lineTo(o.a1, o.y1); p.lineTo(o.a0, o.y1); p.closePath();
    s.holes.push(p);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false });
  g.translate(0, 0, -thick / 2);
  return g;
}

// ───────────────────────────── one cabin ─────────────────────────────

const DETAIL_KEYS = new Set<MatKey>(['iron', 'cloth', 'char', 'chink']);
/** merged parts that go too past 2× cabinDetailDist (log ends, woodpile bark, door frame) */
const FAR_KEYS = new Set<MatKey>(['endGrain', 'bark', 'door']);

class CabinBuilder {
  root = new THREE.Group();
  /** small parts hidden beyond TIER_CONFIG.cabinDetailDist */
  detail: THREE.Object3D[] = [];
  /** mid parts hidden beyond 2× cabinDetailDist */
  far: THREE.Object3D[] = [];
  /** phone tier: where this cabin's point lights would be (see Cabins.sharedLights) */
  anchors: LightAnchor[] = [];
  private parts = new Map<MatKey, THREE.BufferGeometry[]>();
  private rng: Rng;
  private wallTop: number;
  private ridgeY: number;
  private tanP: number;
  private m = new THREE.Matrix4();

  constructor(
    private owner: Cabins, private spec: CabinSpec, private index: number,
    private cx: number, private cy: number, private cz: number, private rot: number,
    private mats: Mats, private sky: Sky, private propInstances: Record<PropKind, THREE.Matrix4[]>,
  ) {
    this.rng = new Rng(SEED + 500 + index * 17);
    this.root.position.set(cx, cy, cz);
    this.root.rotation.y = rot;
    this.root.updateMatrixWorld(true);
    this.wallTop = PLINTH + spec.rows * LOG;                // top of the eave (Z) walls
    this.tanP = Math.tan(spec.pitch);
    this.ridgeY = this.wallTop + (spec.W / 2) * this.tanP;
  }

  // ── helpers ──
  private add(key: MatKey, geo: THREE.BufferGeometry, matrix?: THREE.Matrix4) {
    if (matrix) geo.applyMatrix4(matrix);
    const g = geo.index ? geo.toNonIndexed() : geo;
    if ((key === 'roof' || key === 'stone') && !g.hasAttribute('moss')) {
      // moss density hint: stone = near the ground, roof default = mid-slope
      const pos = g.getAttribute('position'), moss = new Float32Array(pos.count);
      for (let i = 0; i < pos.count; i++) moss[i] = key === 'stone' ? clamp01((0.9 - pos.getY(i)) / 1.1) : 0.35;
      g.setAttribute('moss', new THREE.BufferAttribute(moss, 1));
    }
    const list = this.parts.get(key);
    if (list === undefined) this.parts.set(key, [g]); else list.push(g);
  }
  private box(key: MatKey, w: number, h: number, d: number, x: number, y: number, z: number, uvScale = 1, ry = 0, rz = 0, rx = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    boxUV(g, uvScale, this.rng.range(0, 1), this.rng.range(0, 1));
    this.m.makeRotationFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')).setPosition(x, y, z);
    this.add(key, g, this.m);
  }
  /** log along +X (or +Z when `alongZ`) centred at (x,y,z) */
  private log(len: number, x: number, y: number, z: number, alongZ = false, r = LOG_R, key: MatKey = 'log') {
    const { side, caps } = logGeo(len, r, this.rng.int(0, BOARDS - 1), this.rng.range(0, BOARD_LEN), 14, key === 'bark');
    this.m.makeRotationY(alongZ ? Math.PI / 2 : 0).setPosition(x, y, z);
    this.add(key, side, this.m);
    this.add('endGrain', caps, this.m);
  }
  private collider(lx: number, lz: number, hw: number, hd: number, yBottom: number, yTop: number, localRot = 0): Collider {
    const c = Math.cos(this.rot), s = Math.sin(this.rot);
    const col: Collider = {
      x: this.cx + lx * c + lz * s, z: this.cz - lx * s + lz * c,
      hw, hd, rot: -(this.rot + localRot), yTop: this.cy + yTop, yBottom: this.cy + yBottom,
    };
    this.owner.colliders.push(col);
    return col;
  }
  private worldPos(lx: number, ly: number, lz: number) { return new THREE.Vector3(lx, ly, lz).applyMatrix4(this.root.matrixWorld); }
  /** a flickering point light under `parent` — a real light on desktop, an anchor for the shared set on the phone */
  private pointLight(parent: THREE.Object3D, color: number, intensity: number, distance: number, decay: number, x: number, y: number, z: number, seed: number) {
    if (TIER_CONFIG.sharedCabinLights) {
      const anchor = new THREE.Object3D(); anchor.position.set(x, y, z); parent.add(anchor);
      this.anchors.push({ anchor, color, intensity, distance, decay, seed });
      return;
    }
    const light = new THREE.PointLight(color, intensity, distance, decay);
    light.position.set(x, y, z); parent.add(light);
    this.owner._fire({ light, base: intensity, seed });
  }
  private placeProp(kind: PropKind, x: number, y: number, z: number, ry: number, scale = 1) {
    const local = new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z).scale(new THREE.Vector3(scale, scale, scale));
    this.propInstances[kind].push(new THREE.Matrix4().multiplyMatrices(this.root.matrixWorld, local));
  }

  build(firePit: THREE.Object3D, lantern: THREE.Object3D) {
    const { W, L } = this.spec;
    const a = this.spec.annex;
    const annexSide = this.spec.chimney === 'zpos' ? -1 : 1;    // annex / lean-to go on the gable end without the chimney
    const hz = L / 2 - LOG_R;
    const ext: Partial<Record<WallId, WallExt>> = {};
    const openings = this.openingsFor();
    let annexBox: { ox: number; oz: number } | undefined;
    if (a) {
      // the back wall is simply extended to cover the annex (no seam), the annex adds its own front + far gable walls
      const oz = annexSide * (hz + a.L / 2), ox = -(W / 2) + a.W / 2;
      annexBox = { ox, oz };
      ext.back = annexSide > 0 ? { to: hz + a.L } : { from: -(hz + a.L) };
      (openings[annexSide > 0 ? 'zpos' : 'zneg'] ??= []).push({ a0: ox - 0.5, a1: ox + 0.5, y0: PLINTH - 0.05, y1: FLOOR + 2.0 });
    }
    this.foundation(W, L, 0, 0);
    this.floorPlanks(W, L, 0, 0);
    this.logBox(W, L, 0, 0, this.spec.rows, this.spec.pitch, { gables: { zpos: true, zneg: true }, ext, openings });
    this.roof(W, L, 0, 0, this.spec.pitch, this.wallTop, 0.12, 0.55, 0.5, 0.5);
    this.door();
    this.windows();
    this.chimney();
    this.porch();
    this.interior();
    if (annexBox && a) this.annex(annexBox.ox, annexBox.oz, annexSide, a);
    if (this.spec.leanTo) this.leanTo(annexSide);
    else this.woodpile(-(W / 2) - 0.32, -annexSide * (L / 2 - 1.6), 0, 4, 1.8, { x: -(W / 2) - 0.25, z: -annexSide * (L / 2 + 0.9) });
    if (this.spec.firePit) this.firePit(firePit);
    this.lantern(lantern);
    this.outdoorProps();
    this.rubble();
    this.smoke();
    this.finish();
  }

  // ── stone plinth: one course above ground, deep enough to hide any slope ──
  private foundation(W: number, L: number, ox: number, oz: number) {
    const drop = 0.9;
    this.box('stone', W + 0.3, PLINTH + drop, L + 0.3, ox, (PLINTH - drop) / 2, oz, 2.0);
    this.box('stone', W + 0.44, 0.1, L + 0.44, ox, 0.05, oz, 2.0); // proud footing course at grade
  }

  private floorPlanks(W: number, L: number, ox: number, oz: number) {
    const g = new THREE.BoxGeometry(W - 0.2, FLOOR - PLINTH + 0.02, L - 0.2);
    boxUV(g, 1.3, this.rng.next(), this.rng.next());
    this.m.makeTranslation(ox, (FLOOR + PLINTH) / 2, oz);
    this.add('deck', g, this.m);
    const w = this.worldPos(ox, FLOOR, oz);
    this.owner._floor({ x: w.x, z: w.z, rot: this.rot, hw: W / 2, hd: L / 2, y: w.y });
  }

  /** four log walls of a W (x) × L (z) rectangle centred at (ox, oz) */
  private logBox(W: number, L: number, ox: number, oz: number, rows: number, pitch: number, opts: LogBoxOpts) {
    const ops = opts.openings ?? {};
    const wallTop = PLINTH + rows * LOG;
    const tanP = Math.tan(pitch);
    const ridge = wallTop + (W / 2) * tanP;
    const hx = W / 2 - LOG_R, hz = L / 2 - LOG_R; // log axes inset by a radius
    // eave walls run along Z at x = ±hx; rows centred at (i + 0.5) LOG
    // gable walls run along X at z = ±hz; rows centred at (i + 1) LOG (interleaved notch)
    const walls: { id: WallId; alongZ: boolean; at: number; from: number; to: number; y0: number; gable: boolean }[] = [
      { id: 'front', alongZ: true, at: hx, from: -hz, to: hz, y0: 0.5, gable: false },
      { id: 'back', alongZ: true, at: -hx, from: -hz, to: hz, y0: 0.5, gable: false },
      { id: 'zpos', alongZ: false, at: hz, from: -hx, to: hx, y0: 1.0, gable: opts.gables.zpos },
      { id: 'zneg', alongZ: false, at: -hz, from: -hx, to: hx, y0: 1.0, gable: opts.gables.zneg },
    ];
    for (const w of walls) {
      if (opts.skip?.includes(w.id)) continue;
      const e = opts.ext?.[w.id] ?? {};
      w.from = e.from ?? w.from; w.to = e.to ?? w.to;
      const ohF = e.overhangFrom ?? true, ohT = e.overhangTo ?? true;
      const wallOps = ops[w.id] ?? [];
      // gable walls start half a row up: a slim sill log fills the gap to the plinth
      if (w.y0 === 1.0) this.log(w.to - w.from, ox + (w.from + w.to) / 2, PLINTH + 0.07, oz + w.at, false, 0.07);
      const nRows = w.gable ? rows + Math.ceil((ridge - wallTop) / LOG) + 1 : rows;
      for (let i = 0; i < nRows; i++) {
        const yc = PLINTH + (i + w.y0) * LOG;
        let from = w.from - (ohF ? OVERHANG : 0), to = w.to + (ohT ? OVERHANG : 0);
        if (yc > wallTop + 1e-3) {
          if (!w.gable) break;
          const half = (ridge - (yc + LOG_R * 0.6)) / tanP;   // shorten to the roof underside
          if (half < 0.3) break;
          from = -half; to = half;
        }
        let segs: [number, number][] = [[from, to]];
        for (const o of wallOps) {
          if (o.y1 <= yc - LOG_R || o.y0 >= yc + LOG_R) continue;
          const next: [number, number][] = [];
          for (const [a, b] of segs) {
            if (o.a1 <= a || o.a0 >= b) { next.push([a, b]); continue; }
            if (o.a0 > a) next.push([a, o.a0]);
            if (o.a1 < b) next.push([o.a1, b]);
          }
          segs = next;
        }
        for (const [a, b] of segs) {
          if (b - a < 0.12) continue;
          const mid = (a + b) / 2;
          if (w.alongZ) this.log(b - a, ox + w.at, yc, oz + mid, true);
          else this.log(b - a, ox + mid, yc, oz + w.at, false);
        }
      }
      // chinking slab behind the logs (openings cut out). Eave walls fill up to the roof sheet like blocking.
      const cosP = Math.cos(pitch);
      const h = (w.gable ? wallTop : wallTop + RAFTER_H / cosP - 0.01) - PLINTH;
      const slab = wallSlab(w.from, w.to, h, LOG_R * 0.75, wallOps.map((o) => ({ ...o, y0: Math.max(0.002, o.y0 - PLINTH), y1: Math.min(h - 0.002, o.y1 - PLINTH) })),
        w.gable ? ridge - PLINTH + LOG * 0.3 : undefined);
      boxUV(slab, 1);
      this.m.makeRotationY(w.alongZ ? -Math.PI / 2 : 0).setPosition(w.alongZ ? ox + w.at : ox, PLINTH, w.alongZ ? oz : oz + w.at);
      this.add('chink', slab, this.m);

      // colliders: the wall minus door openings (doors get their own toggled collider)
      const doorOps = wallOps.filter((o) => o.y0 <= PLINTH + 0.01);
      let cs: [number, number][] = [[w.from - (ohF ? OVERHANG : 0), w.to + (ohT ? OVERHANG : 0)]];
      for (const o of doorOps) cs = cs.flatMap(([a, b]): [number, number][] => (o.a1 <= a || o.a0 >= b ? [[a, b]] : [[a, o.a0], [o.a1, b]])).filter(([a, b]) => b - a > 0.05);
      for (const [a, b] of cs) {
        const mid = (a + b) / 2, half = (b - a) / 2;
        if (w.alongZ) this.collider(ox + w.at, oz + mid, LOG_R, half, 0, wallTop + 1);
        else this.collider(ox + mid, oz + w.at, half, LOG_R, 0, wallTop + 1);
      }
    }
  }

  private openingsFor(): Partial<Record<WallId, Opening[]>> {
    const out: Partial<Record<WallId, Opening[]>> = {};
    (out.front ??= []).push(this.doorOpening());
    for (const w of this.spec.windows) (out[w.wall] ??= []).push(roughOpening(this.windowOpening(w), w.wall === 'zpos' || w.wall === 'zneg'));
    return out;
  }
  private doorOpening(): Opening { return { a0: this.spec.doorZ - 0.54, a1: this.spec.doorZ + 0.54, y0: PLINTH - 0.05, y1: snapRow(FLOOR + 2.1 + 0.1, false) }; }
  private windowOpening(w: WindowSpec): Opening {
    const ww = w.w ?? 0.95, h = w.h ?? 0.85, y = w.y ?? FLOOR + 1.15;
    return { a0: w.at - ww / 2, a1: w.at + ww / 2, y0: y, y1: y + h };
  }

  // ── roof: plank sheets over rafters + purlins + ridge log; ridge along Z ──
  private roof(W: number, L: number, ox: number, oz: number, pitch: number, wallTop: number, eaveFront: number, eaveBack: number, overPos: number, overNeg: number) {
    const tanP = Math.tan(pitch), cosP = Math.cos(pitch);
    const ridge = wallTop + (W / 2) * tanP;
    const len = L + overPos + overNeg, zc = oz + (overPos - overNeg) / 2;
    for (const side of [1, -1]) {
      const run = W / 2 + (side > 0 ? eaveFront : eaveBack);
      const slope = run / cosP;
      const sheet = swapUV(boxUV(new THREE.BoxGeometry(slope, SHEET, len), 1.5, 0, this.rng.range(0, 1)));  // planks run down the slope
      { // moss hint: 0 at the ridge → 1 at the eave (local +x is down-slope on the +side, up-slope on the −side)
        const pos = sheet.getAttribute('position'), moss = new Float32Array(pos.count);
        for (let i = 0; i < pos.count; i++) moss[i] = clamp01(0.5 + (side * pos.getX(i)) / slope);
        sheet.setAttribute('moss', new THREE.BufferAttribute(moss, 1));
      }
      this.m.makeRotationZ(-side * pitch).setPosition(ox + side * run / 2, ridge - (run / 2) * tanP + (RAFTER_H + SHEET / 2) / cosP, zc);
      this.add('roof', sheet, this.m);
      // a few loose / lifted planks
      for (let k = 0; k < 3; k++) {
        const pl = swapUV(boxUV(new THREE.BoxGeometry(this.rng.range(0.7, 1.3), 0.03, 0.14), 1.5, 0, this.rng.next()));
        const px = this.rng.range(-slope / 2 + 0.7, slope / 2 - 0.7), pz = this.rng.range(-len / 2 + 0.3, len / 2 - 0.3);
        const lift = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(this.rng.range(-0.06, 0.06), this.rng.range(-0.05, 0.05), this.rng.range(0.02, 0.06))).setPosition(px, SHEET / 2 + 0.03, pz);
        this.m.makeRotationZ(-side * pitch).setPosition(ox + side * run / 2, ridge - (run / 2) * tanP + (RAFTER_H + SHEET / 2) / cosP, zc).multiply(lift);
        this.add('roof', pl, this.m);
      }
      const n = Math.max(2, Math.round(len / 0.8));
      for (let i = 0; i <= n; i++) {
        const z = zc - len / 2 + 0.08 + (len - 0.16) * (i / n);
        const rg = boxUV(new THREE.BoxGeometry(slope - 0.02, RAFTER_H, 0.09), 1.0, this.rng.range(0, 1));
        this.m.makeRotationZ(-side * pitch).setPosition(ox + side * run / 2, ridge - (run / 2) * tanP + (RAFTER_H / 2) / cosP, z);
        this.add('beam', rg, this.m);
      }
      for (const f of [0.3, 0.64]) this.log(len + 0.1, ox + side * (W / 2) * f, ridge - (W / 2) * f * tanP - LOG_R * 0.9, zc, true, LOG_R * 0.75);
    }
    this.log(len + 0.2, ox, ridge - LOG_R * 0.45, oz + (overPos - overNeg) / 2, true, LOG_R * 0.95);
    for (const side of [1, -1]) {
      const g = boxUV(new THREE.BoxGeometry(0.22, 0.03, len + 0.02), 1.5);
      this.m.makeRotationZ(-side * pitch).setPosition(ox + side * 0.1, ridge + (RAFTER_H + SHEET) / cosP + 0.015, zc);
      this.add('roof', g, this.m);
    }
  }

  // ── plank door on strap hinges, swings inward ──
  private door() {
    const { W } = this.spec;
    const dz = this.spec.doorZ, x = W / 2 - LOG_R;
    const H = 2.1, DW = 0.95;
    const fd = LOG * 1.15;
    const top = this.doorOpening().y1 + 0.01;
    this.box('beam', fd, top - FLOOR, 0.1, x, (top + FLOOR) / 2, dz - 0.5, 1.0);
    this.box('beam', fd, top - FLOOR, 0.1, x, (top + FLOOR) / 2, dz + 0.5, 1.0);
    this.box('beam', fd, top - (FLOOR + H + 0.04), 1.1, x, (top + FLOOR + H + 0.04) / 2, dz, 1.0);
    this.box('beam', fd + 0.06, 0.05, 1.1, x, FLOOR + 0.02, dz, 1.0);
    const pivot = new THREE.Group();
    pivot.position.set(x - 0.02, FLOOR + 0.02, dz - DW / 2);
    const leaf = new THREE.BoxGeometry(0.06, H, DW);
    {
      const uv = leaf.getAttribute('uv'), pos = leaf.getAttribute('position'), nor = leaf.getAttribute('normal');
      for (let i = 0; i < uv.count; i++) {
        if (Math.abs(nor.getX(i)) > 0.5) uv.setXY(i, 0.02 + (pos.getZ(i) / DW + 0.5) * 0.46, (pos.getY(i) / H + 0.5) * 1.05);
        else uv.setXY(i, 0.5 + pos.getY(i) * 0.5, 0.05 + pos.getZ(i) * 0.3);
      }
    }
    leaf.translate(0, H / 2, DW / 2);
    const doorMesh = new THREE.Mesh(leaf, this.mats.door);
    doorMesh.castShadow = true; doorMesh.receiveShadow = true;
    pivot.add(doorMesh);
    const iron: THREE.BufferGeometry[] = [];
    for (const hy of [0.32, H - 0.32]) {
      iron.push(new THREE.BoxGeometry(0.015, 0.06, 0.42).translate(0.04, hy, 0.19));
      iron.push(new THREE.CylinderGeometry(0.018, 0.018, 0.12, 8).translate(0.045, hy, -0.005));
    }
    iron.push(new THREE.TorusGeometry(0.045, 0.008, 6, 14).rotateY(Math.PI / 2).translate(0.045, 1.0, DW - 0.13));
    iron.push(new THREE.CylinderGeometry(0.012, 0.012, 0.09, 6).rotateZ(Math.PI / 2).translate(0.01, 1.0, DW - 0.13));
    const ironMesh = new THREE.Mesh(mergeGeometries(iron.map((g) => g.toNonIndexed())), this.mats.iron);
    ironMesh.castShadow = true;
    pivot.add(ironMesh); this.detail.push(ironMesh);
    const battens: THREE.BufferGeometry[] = [];
    for (const by of [0.35, H / 2, H - 0.35]) battens.push(boxUV(new THREE.BoxGeometry(0.03, 0.12, DW - 0.1), 1).translate(-0.045, by, DW / 2));
    battens.push(boxUV(new THREE.BoxGeometry(0.03, 0.12, Math.hypot(H - 0.7, DW - 0.1) - 0.1), 1).rotateX(Math.atan2(H - 0.7, DW - 0.1)).translate(-0.045, H / 2, DW / 2));
    const battenMesh = new THREE.Mesh(mergeGeometries(battens.map((g) => g.toNonIndexed())), this.mats.beam);
    battenMesh.castShadow = true;
    pivot.add(battenMesh); this.detail.push(battenMesh);
    this.root.add(pivot); this.far.push(doorMesh);

    const col = this.collider(x, dz, 0.08, DW / 2, 0, FLOOR + H);
    const d: Door = {
      pivot, open: false, t: 0, collider: col,
      interactable: { position: this.worldPos(x + 0.5, FLOOR + 1.0, dz), radius: 2.4, label: 'Open door', onInteract: () => { /* bound below, once `d` exists */ } },
    };
    d.interactable.onInteract = () => {
      d.open = !d.open;
      d.interactable.label = d.open ? 'Close door' : 'Open door';
      col.yTop = d.open ? -1e4 : this.cy + FLOOR + H;
    };
    this.owner._door(d);
  }

  // ── windows: frame, sill, mullions, glass ──
  private windowFrame(o: Opening, alongZ: boolean, at: number, glass: THREE.BufferGeometry[]) {
    const ww = o.a1 - o.a0, hh = o.y1 - o.y0, yc = (o.y0 + o.y1) / 2, ac = (o.a0 + o.a1) / 2;
    const rough = roughOpening(o, !alongZ);
    const sillH = o.y0 - rough.y0 + 0.01, headH = rough.y1 - o.y1 + 0.01;   // fill up to the log gaps
    const fd = LOG * 1.15, ft = FRAME;
    const g: THREE.BufferGeometry[] = [];
    const fb = (w: number, h: number, d: number, x: number, y: number, z: number) => g.push(boxUV(new THREE.BoxGeometry(w, h, d), 1, this.rng.next(), this.rng.next()).translate(x, y, z));
    fb(ww + ft * 2, headH, fd, 0, hh / 2 + headH / 2, 0);
    fb(ww + ft * 2, sillH, fd + 0.06, 0, -hh / 2 - sillH / 2, 0);   // sill, slightly proud
    fb(ft, hh + sillH + headH, fd, -ww / 2 - ft / 2, (headH - sillH) / 2, 0);
    fb(ft, hh + sillH + headH, fd, ww / 2 + ft / 2, (headH - sillH) / 2, 0);
    fb(0.04, hh, 0.04, 0, 0, 0);
    fb(ww, 0.04, 0.04, 0, 0, 0);
    const m = new THREE.Matrix4().makeRotationY(alongZ ? -Math.PI / 2 : 0).setPosition(alongZ ? at : ac, yc, alongZ ? ac : at);
    this.add('beam', mergeGeometries(g.map((x) => x.toNonIndexed())), m);
    glass.push(new THREE.PlaneGeometry(ww, hh).applyMatrix4(m));
  }
  private windows() {
    const { W, L } = this.spec;
    const glass: THREE.BufferGeometry[] = [];
    for (const w of this.spec.windows) {
      const alongZ = w.wall === 'front' || w.wall === 'back';
      const at = w.wall === 'front' ? W / 2 - LOG_R : w.wall === 'back' ? -(W / 2 - LOG_R) : w.wall === 'zpos' ? L / 2 - LOG_R : -(L / 2 - LOG_R);
      this.windowFrame(this.windowOpening(w), alongZ, at, glass);
    }
    this.glassMesh(glass);
  }
  private glassMesh(glass: THREE.BufferGeometry[]) {
    if (glass.length === 0) return;
    const gm = new THREE.Mesh(mergeGeometries(glass), this.mats.glass);
    gm.receiveShadow = true; gm.renderOrder = 2;
    this.root.add(gm); this.detail.push(gm);
  }

  // ── stone chimney on a gable end, with a fireplace inside ──
  private chimney() {
    const { L } = this.spec;
    const side = this.spec.chimney === 'zpos' ? 1 : -1;
    const zWall = side * (L / 2);
    const cw = 1.1, cd = 0.75, cx = -0.6;
    const top = this.ridgeY + 0.7;
    const zc = zWall + side * (cd / 2 + 0.05);
    this.box('stone', cw, top + 0.6, cd, cx, (top - 0.6) / 2, zc, 2.0);
    this.box('stone', cw + 0.5, 1.9 + 0.6, cd + 0.35, cx, (1.9 - 0.6) / 2, zc, 2.0);   // wider shoulder
    this.box('stone', cw + 0.25, 0.12, cd + 0.25, cx, top + 0.06, zc, 2.0);           // cap
    this.box('iron', cw - 0.4, 0.05, cd - 0.3, cx, top + 0.13, zc, 1);                  // dark flue
    this.collider(cx, zc, (cw + 0.5) / 2, (cd + 0.35) / 2, 0, top);
    // fireplace breast inside
    const bz = zWall - side * 0.35;
    this.box('stone', 1.6, 1.5, 0.6, cx, PLINTH + 0.75, bz, 2.0);
    this.box('stone', 1.9, 0.08, 0.9, cx, FLOOR + 0.04, bz - side * 0.1, 2.0); // hearth slab
    this.box('stone', 1.7, 0.1, 0.7, cx, PLINTH + 1.55, bz, 2.0);              // mantel
    this.box('iron', 0.8, 0.7, 0.32, cx, FLOOR + 0.4, bz - side * 0.15, 1);    // firebox
    for (let i = 0; i < 3; i++) this.box('char', 0.45, 0.08, 0.08, cx + this.rng.range(-0.15, 0.15), FLOOR + 0.12 + i * 0.05, bz - side * (0.42 + i * 0.03), 1, this.rng.range(-0.4, 0.4));
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.6), this.mats.glow);
    glow.position.set(cx, FLOOR + 0.35, bz - side * 0.5); glow.rotation.y = side > 0 ? Math.PI : 0;
    this.root.add(glow); this.detail.push(glow);
    this.pointLight(this.root, 0xffa050, 14, 10, 2, cx, FLOOR + 0.6, bz - side * 0.7, this.index * 3.1);
    // room light so the windows glow at dusk
    this.pointLight(this.root, 0xffb070, 16, 11, 2, 0.2, FLOOR + 1.9, 0, this.index * 1.7 + 0.5);
    this.collider(cx, bz, 0.8, 0.3, 0, PLINTH + 1.6);
  }

  // ── porch: decking, steps, posts, rails, lower-pitch roof breaking off the main roof ──
  private porch() {
    const { W, L, porchDepth: D } = this.spec;
    const x0 = W / 2 + 0.05;
    const cx = x0 + D / 2, len = L + 0.3;
    const deck = swapUV(boxUV(new THREE.BoxGeometry(D, 0.05, len), 1.3, this.rng.next(), this.rng.next()));
    this.m.makeTranslation(cx, FLOOR - 0.025, 0);
    this.add('deck', deck, this.m);
    this.box('beam', D, 0.16, 0.12, cx, FLOOR - 0.13, -len / 2 + 0.06, 1);
    this.box('beam', D, 0.16, 0.12, cx, FLOOR - 0.13, len / 2 - 0.06, 1);
    this.box('beam', 0.12, 0.16, len, x0 + D - 0.06, FLOOR - 0.13, 0, 1);
    for (const z of [-len / 2 + 0.3, 0, len / 2 - 0.3]) this.box('stone', 0.35, PLINTH + 0.5, 0.35, x0 + D - 0.25, (PLINTH - 0.5) / 2 - 0.05, z, 2);
    const wf = this.worldPos(cx, FLOOR, 0);
    this.owner._floor({ x: wf.x, z: wf.z, rot: this.rot, hw: D / 2, hd: len / 2, y: wf.y });
    // step in front of the door
    const dz = this.spec.doorZ, sw = 1.4;
    this.box('deck', 0.36, 0.05, sw, x0 + D + 0.18, FLOOR - 0.12, dz, 1.3);
    this.box('beam', 0.36, 0.07, sw, x0 + D + 0.18, FLOOR - 0.18, dz, 1.0);
    this.box('stone', 0.5, 0.1, sw + 0.2, x0 + D + 0.55, 0.05, dz, 2);
    // porch roof: breaks off the main roof just past the wall at a lower pitch
    const q = 0.26, tanQ = Math.tan(q), cosQ = Math.cos(q);
    const xb = W / 2 + 0.12, cosP = Math.cos(this.spec.pitch);
    const yTopB = this.ridgeY - xb * this.tanP + (RAFTER_H + SHEET) / cosP - 0.01;  // main sheet top at the break
    const postX = x0 + D - 0.12, xe = x0 + D + 0.3;
    const run = xe - xb, slope = run / cosQ;
    const under = (x: number) => yTopB - (x - xb) * tanQ - (SHEET + RAFTER_H) / cosQ;  // rafter underside line
    const sheet = swapUV(boxUV(new THREE.BoxGeometry(slope, SHEET, len + 0.2), 1.5, 0, this.rng.next()));
    this.m.makeRotationZ(-q).setPosition(xb + run / 2, yTopB - (run / 2) * tanQ - (SHEET / 2) / cosQ, 0);
    this.add('roof', sheet, this.m);
    const nr = Math.max(2, Math.round(len / 0.8));
    for (let i = 0; i <= nr; i++) {
      const z = -len / 2 + 0.07 + (len - 0.14) * (i / nr);
      const rg = boxUV(new THREE.BoxGeometry(slope - 0.05, RAFTER_H * 0.85, 0.08), 1, this.rng.next());
      this.m.makeRotationZ(-q).setPosition(xb + run / 2, yTopB - (run / 2) * tanQ - (SHEET + RAFTER_H * 0.425) / cosQ, z);
      this.add('beam', rg, this.m);
    }
    const headerBottom = under(postX) - 0.02;
    this.box('beam', 0.14, 0.18, len, postX, headerBottom - 0.09, 0, 1);
    const postH = headerBottom - 0.18 - FLOOR;
    const posts = [-len / 2 + 0.12, len / 2 - 0.12];
    for (const p of [dz - sw / 2 - 0.25, dz + sw / 2 + 0.25]) if (Math.abs(p) < len / 2 - 0.7) posts.push(p);
    posts.sort((a, b) => a - b);
    for (const z of posts) {
      this.box('beam', 0.14, postH, 0.14, postX, FLOOR + postH / 2, z, 1);
      this.collider(postX, z, 0.08, 0.08, 0, FLOOR + postH);
    }
    // railing between posts, open in front of the step
    const railY = FLOOR + 0.95;
    for (let i = 0; i < posts.length - 1; i++) {
      const a = posts[i], b = posts[i + 1];
      if (a === undefined || b === undefined) continue;
      if (dz > a && dz < b) continue;
      const mid = (a + b) / 2, l = b - a - 0.14;
      this.box('beam', 0.09, 0.07, l, postX, railY, mid, 1);
      this.box('beam', 0.07, 0.06, l, postX, FLOOR + 0.12, mid, 1);
      const n = Math.max(1, Math.floor(l / 0.32));
      for (let k = 1; k < n; k++) this.box('beam', 0.045, railY - FLOOR - 0.16, 0.045, postX, FLOOR + 0.15 + (railY - FLOOR - 0.16) / 2, a + 0.07 + (l * k) / n, 1);
      this.collider(postX, mid, 0.06, l / 2, 0, railY + 0.1);
    }
    for (const s of [-1, 1]) {
      const z = s * (len / 2 - 0.05), rl = D - 0.4;
      this.box('beam', rl, 0.07, 0.09, x0 + rl / 2, railY, z, 1);
      const n = Math.floor(rl / 0.32);
      for (let k = 1; k < n; k++) this.box('beam', 0.045, railY - FLOOR - 0.16, 0.045, x0 + (rl * k) / n, FLOOR + 0.15 + (railY - FLOOR - 0.16) / 2, z, 1);
      this.collider(x0 + rl / 2, z, rl / 2, 0.06, 0, railY + 0.1);
    }
  }

  // ── interior: bed, table, chairs, shelf, a few props ──
  private interior() {
    const { W, L } = this.spec;
    const chimSide = this.spec.chimney === 'zpos' ? 1 : -1;
    const bx = -(W / 2) + LOG_R + 0.55;
    const bedZ = -chimSide * (L / 2 - LOG_R - 1.15);            // bed at the end away from the fireplace
    this.box('beam', 0.95, 0.12, 2.05, bx, FLOOR + 0.36, bedZ, 1);
    for (const [dx, dz] of [[-0.42, -0.97], [0.42, -0.97], [-0.42, 0.97], [0.42, 0.97]] as const) this.box('beam', 0.08, 0.36, 0.08, bx + dx, FLOOR + 0.18, bedZ + dz, 1);
    this.box('beam', 0.06, 0.55, 1.0, bx - 0.47, FLOOR + 0.55, bedZ, 1);
    this.cloth(0.88, 0.16, 1.95, bx, FLOOR + 0.5, bedZ, 0xd9cdb4);
    this.cloth(0.9, 0.08, 1.3, bx, FLOOR + 0.62, bedZ + 0.3 * chimSide, 0x6a3b2e);
    this.cloth(0.5, 0.1, 0.35, bx, FLOOR + 0.63, bedZ - 0.75 * chimSide, 0xe8e0cc);
    this.collider(bx, bedZ, 0.5, 1.05, 0, FLOOR + 0.7);
    const tx = 0.4, tz = -chimSide * 0.4;
    this.box('beam', 1.25, 0.05, 0.8, tx, FLOOR + 0.75, tz, 1);
    for (const [dx, dz] of [[-0.55, -0.32], [0.55, -0.32], [-0.55, 0.32], [0.55, 0.32]] as const) this.box('beam', 0.07, 0.73, 0.07, tx + dx, FLOOR + 0.365, tz + dz, 1);
    this.collider(tx, tz, 0.62, 0.4, 0, FLOOR + 0.8);
    for (const s of [-1, 1]) this.chair(tx + this.rng.range(-0.15, 0.15), tz + s * 0.75, (s > 0 ? Math.PI : 0) + this.rng.range(-0.3, 0.3));
    const sz = -chimSide * (L / 2 - LOG_R - 0.16), sx = W / 2 - 1.5;
    for (const y of [1.3, 1.75]) {
      this.box('beam', 1.4, 0.035, 0.28, sx, FLOOR + y, sz, 1);
      for (const dx of [-0.6, 0.6]) this.box('beam', 0.05, 0.16, 0.24, sx + dx, FLOOR + y - 0.1, sz, 1);
    }
    this.placeProp('bucket', sx + 0.3, FLOOR + 1.335, sz, this.rng.range(0, 6), 0.75);
    this.placeProp('crate', -W / 2 + 0.9, FLOOR, chimSide * (L / 2 - 1.9), Math.PI / 2 + this.rng.range(-0.2, 0.2), 0.9);
    this.placeProp('barrel', W / 2 - 0.7, FLOOR, sz + chimSide * 0.6, this.rng.range(0, 6), 0.85);
  }
  private chair(x: number, z: number, yaw: number) {
    const g: THREE.BufferGeometry[] = [];
    const b = (w: number, h: number, d: number, px: number, py: number, pz: number) => g.push(boxUV(new THREE.BoxGeometry(w, h, d), 1, this.rng.next(), this.rng.next()).translate(px, py, pz));
    b(0.42, 0.04, 0.42, 0, 0.45, 0);
    for (const [dx, dz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]] as const) b(0.04, 0.45, 0.04, dx, 0.225, dz);
    for (const dx of [-0.18, 0.18]) b(0.04, 0.45, 0.04, dx, 0.68, -0.19);
    b(0.42, 0.14, 0.03, 0, 0.8, -0.19);
    this.m.makeRotationY(yaw).setPosition(x, FLOOR, z);
    this.add('beam', mergeGeometries(g.map((gg) => gg.toNonIndexed())), this.m);
  }
  /** a drying animal hide folded over a rope line: irregular outline, two flaps either side of the rope */
  private hide(x: number, y: number, z: number, yaw: number) {
    const outline = new THREE.Shape();
    const n = 18;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = 0.42 * (1 + 0.18 * Math.sin(a * 2 + 0.5) + 0.12 * Math.sin(a * 5 + 1.3) + this.rng.range(-0.05, 0.05));
      const px = Math.cos(a) * r * 1.15, py = Math.sin(a) * r;
      if (i > 0) outline.lineTo(px, py); else outline.moveTo(px, py);
    }
    outline.closePath();
    for (const sgn of [-1, 1]) {
      const g = new THREE.ExtrudeGeometry(outline, { depth: 0.015, bevelEnabled: false }).toNonIndexed();
      g.translate(0, -0.44, 0);                                   // hang from the rope
      const pos = g.getAttribute('position');
      const c = new THREE.Color(0x120b06), col = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) { const f = 0.75 + 0.35 * Math.abs(Math.sin(pos.getX(i) * 9 + pos.getY(i) * 7)); col[i * 3] = c.r * f; col[i * 3 + 1] = c.g * f; col[i * 3 + 2] = c.b * f; }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      this.m.makeRotationFromEuler(new THREE.Euler(sgn * 0.1, yaw, 0, 'YXZ')).setPosition(x, y, z);
      g.translate(0, 0, sgn > 0 ? 0.01 : -0.025);
      this.add('cloth', g, this.m);
    }
  }
  private cloth(w: number, h: number, d: number, x: number, y: number, z: number, color: number, yaw = 0, lean = 0) {
    const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
    const c = new THREE.Color(color), col = new Float32Array(g.getAttribute('position').count * 3);
    for (let i = 0; i < col.length; i += 3) { col[i] = c.r * this.rng.range(0.85, 1.05); col[i + 1] = c.g * this.rng.range(0.85, 1.05); col[i + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (lean) g.translate(0, -h / 2, lean > 0 ? d : -d);
    this.m.makeRotationFromEuler(new THREE.Euler(lean, yaw, 0, 'YXZ')).setPosition(x, lean ? y + h / 2 : y, z);
    this.add('cloth', g, this.m);
  }

  // ── woodpile (logs along local X of the pile frame, stacked along its Z) + chopping block with a hatchet ──
  private woodpile(px: number, pz: number, yaw: number, rows: number, width: number, block: { x: number; z: number }) {
    const base = new THREE.Matrix4().makeRotationY(yaw).setPosition(px, 0, pz);
    const r0 = 0.085, len = 0.5;
    for (let row = 0; row < rows; row++) {
      const n = Math.max(1, Math.floor(width / (r0 * 2.1)) - row);
      for (let i = 0; i < n; i++) {
        const r = r0 * this.rng.range(0.8, 1.15);
        const along = -width / 2 + r0 * 1.05 + row * r0 * 1.05 + i * r0 * 2.1 + this.rng.range(-0.01, 0.01);
        const { side, caps } = logGeo(len * this.rng.range(0.9, 1.05), r, 0, this.rng.next(), 10, true);
        const m = new THREE.Matrix4().makeRotationY(this.rng.range(-0.08, 0.08)).setPosition(this.rng.range(-0.03, 0.03), r0 + row * r0 * 1.8, along).premultiply(base);
        this.add('bark', side, m);
        this.add('endGrain', caps, m);
      }
    }
    this.collider(px, pz, 0.3, width / 2, 0, rows * r0 * 1.8, yaw);
    const { side, caps } = logGeo(0.55, 0.19, 0, 0, 14, true);
    const m = new THREE.Matrix4().makeRotationZ(Math.PI / 2).setPosition(block.x, 0.275, block.z);
    this.add('bark', side, m); this.add('endGrain', caps, m);
    this.placeProp('hatchet', block.x + 0.02, 0.6, block.z, this.rng.range(0, 6), 1.15);
    this.collider(block.x, block.z, 0.2, 0.2, 0, 0.55);
    // split firewood scattered around the block
    for (let i = 0; i < 9; i++) {
      const a = this.rng.range(0, Math.PI * 2), d = this.rng.range(0.35, 1.2);
      const r = this.rng.range(0.06, 0.09), l = this.rng.range(0.32, 0.45);
      const wedge = new THREE.CylinderGeometry(r, r, l, 7, 1, false, 0, Math.PI);
      const uv = wedge.getAttribute('uv'), pos = wedge.getAttribute('position');
      for (let k = 0; k < uv.count; k++) uv.setXY(k, pos.getX(k) * 0.5 + this.rng.next(), pos.getY(k) * 0.5);
      this.m.makeRotationFromEuler(new THREE.Euler(this.rng.range(-0.1, 0.1), this.rng.range(0, 6.3), Math.PI / 2 + this.rng.range(-0.15, 0.15), 'YXZ')).setPosition(block.x + Math.cos(a) * d, r * 0.5, block.z + Math.sin(a) * d);
      this.add('bark', wedge, this.m);
    }
  }

  // ── L-shaped annex on the gable end: shares the back wall line, own front + far gable walls, lower roof ──
  private annex(ox: number, oz: number, side: number, a: NonNullable<CabinSpec['annex']>) {
    const hza = a.L / 2 - LOG_R;
    this.foundation(a.W - 0.04, a.L, ox, oz);
    this.floorPlanks(a.W, a.L, ox, oz);
    const wallTop = PLINTH + a.rows * LOG;
    const win: Opening = { a0: -0.45, a1: 0.45, y0: FLOOR + 1.1, y1: FLOOR + 1.9 };
    const farWall: WallId = side > 0 ? 'zpos' : 'zneg', nearWall: WallId = side > 0 ? 'zneg' : 'zpos';
    this.logBox(a.W, a.L, ox, oz, a.rows, a.pitch, {
      gables: { zpos: side > 0, zneg: side < 0 },
      skip: [nearWall, 'back'],
      ext: { front: side > 0 ? { from: -hza - LOG_R + 0.05, overhangFrom: false } : { to: hza + LOG_R - 0.05, overhangTo: false } },
      openings: { [farWall]: [roughOpening(win, true)] },
    });
    this.roof(a.W, a.L, ox, oz, a.pitch, wallTop, 0.45, 0.45, side > 0 ? 0.45 : -0.15, side > 0 ? -0.15 : 0.45);
    const glass: THREE.BufferGeometry[] = [];
    this.windowFrame({ ...win, a0: win.a0 + ox, a1: win.a1 + ox }, false, oz + side * hza, glass);
    this.glassMesh(glass);
    // doorway frame through the shared gable wall
    const zW = side * (this.spec.L / 2 - LOG_R);
    this.box('beam', 0.1, 2.0, 0.34, ox - 0.5, FLOOR + 1.0, zW, 1);
    this.box('beam', 0.1, 2.0, 0.34, ox + 0.5, FLOOR + 1.0, zW, 1);
    this.box('beam', 1.1, 0.12, 0.34, ox, FLOOR + 2.06, zW, 1);
    // a second bed + shelf in the annex
    const bz = oz + side * (hza - 1.15), bxa = ox - a.W / 2 + LOG_R + 0.55;
    this.box('beam', 0.95, 0.12, 2.05, bxa, FLOOR + 0.36, bz, 1, Math.PI / 2);
    this.cloth(0.88, 0.16, 1.95, bxa, FLOOR + 0.5, bz, 0xcfc4a8);
    this.cloth(0.9, 0.08, 1.2, bxa, FLOOR + 0.62, bz - side * 0.3, 0x3f4a3a);
    this.collider(bxa, bz, 0.5, 1.05, 0, FLOOR + 0.7);
    this.placeProp('crate', ox + a.W / 2 - 0.7, FLOOR, oz - side * 0.2, this.rng.range(0, 6), 0.9);
    this.placeProp('crate', ox + a.W / 2 - 0.7, FLOOR + 0.43, oz - side * 0.25, this.rng.range(0, 6), 0.8);
  }

  // ── lean-to wood shed on the gable end ──
  private leanTo(side: number) {
    const { W, L } = this.spec;
    const z0 = side * (L / 2 + 0.05), depth = 2.2, width = W - 0.6;
    const hiY = this.wallTop - 0.05, loY = hiY - depth * 0.42;
    const zc = z0 + side * depth / 2;
    for (const x of [-width / 2 + 0.1, width / 2 - 0.1]) {
      this.box('beam', 0.14, loY, 0.14, x, loY / 2, z0 + side * (depth - 0.1), 1);
      this.collider(x, z0 + side * (depth - 0.1), 0.08, 0.08, 0, loY);
    }
    this.box('beam', width, 0.16, 0.14, 0, loY + 0.08, z0 + side * (depth - 0.1), 1);
    this.box('beam', width, 0.16, 0.14, 0, hiY + 0.08, z0 + side * 0.1, 1);
    const pitch = Math.atan2(hiY - loY, depth - 0.2) * side, slope = Math.hypot(hiY - loY, depth);
    for (let i = 0; i <= 4; i++) {
      const x = -width / 2 + 0.07 + (width - 0.14) * (i / 4);
      const rg = boxUV(new THREE.BoxGeometry(0.08, 0.12, slope), 1, this.rng.next());
      this.m.makeRotationX(pitch).setPosition(x, (hiY + loY) / 2 + 0.22, zc);
      this.add('beam', rg, this.m);
    }
    const sheet = boxUV(new THREE.BoxGeometry(width + 0.3, SHEET, slope + 0.2), 1.5);
    this.m.makeRotationX(pitch).setPosition(0, (hiY + loY) / 2 + 0.3, zc);
    this.add('roof', sheet, this.m);
    this.woodpile(0, z0 + side * 0.55, Math.PI / 2, 5, width - 0.8, { x: width / 2 + 0.6, z: z0 + side * 1.3 });
  }

  // ── camp fire out front ──
  private firePit(model: THREE.Object3D) {
    const { W, porchDepth } = this.spec;
    const fx = W / 2 + porchDepth + 3.4, fz = -1.2;
    const pit = model.clone(true);
    pit.traverse((mesh) => {
      if (isMesh(mesh)) { mesh.castShadow = true; mesh.receiveShadow = true; this.sky.setupMaterial(mesh.material as THREE.Material); }
    });
    pit.position.set(fx, 0.19 - 0.06, fz);
    pit.rotation.y = this.rng.range(0, 6);
    this.root.add(pit); this.detail.push(pit);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.3;
      const g = boxUV(new THREE.CylinderGeometry(0.05, 0.065, 0.75, 7), 1);
      this.m.makeRotationFromEuler(new THREE.Euler(0, a, 1.15, 'YXZ')).setPosition(fx - Math.cos(a) * 0.1, 0.33, fz + Math.sin(a) * 0.1);
      this.add('char', g, this.m);
    }
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5).rotateX(-Math.PI / 2), this.mats.glow);
    glow.position.set(fx, 0.14, fz);
    this.root.add(glow); this.detail.push(glow);
    const flames = makeParticles(this.mats.flame, 44, this.rng); flames.position.set(fx, 0.16, fz); flames.renderOrder = 5;
    const embers = makeParticles(this.mats.ember, 64, this.rng); embers.position.set(fx, 0.35, fz); embers.renderOrder = 6;
    // ring of stones around the pit
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + this.rng.range(-0.1, 0.1), rr = 0.92 + this.rng.range(-0.06, 0.08);
      const r = this.rng.range(0.11, 0.18);
      const g = boxUV(new THREE.DodecahedronGeometry(r, 0), 1.5, this.rng.next(), this.rng.next());
      g.scale(1, this.rng.range(0.55, 0.85), this.rng.range(0.8, 1.3));
      this.m.makeRotationFromEuler(new THREE.Euler(this.rng.range(0, 0.3), a, this.rng.range(0, 0.3))).setPosition(fx + Math.cos(a) * rr, r * 0.4, fz + Math.sin(a) * rr);
      this.add('stone', g, this.m);
    }
    // iron tripod with a hanging cooking pot
    const apexY = 1.75;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.4, foot = 0.8;
      const legLen = Math.hypot(foot, apexY), tilt = Math.atan2(foot, apexY);
      const leg = new THREE.CylinderGeometry(0.014, 0.02, legLen, 6);
      this.m.makeRotationFromEuler(new THREE.Euler(0, -a, tilt, 'YXZ')).setPosition(fx + Math.cos(a) * foot / 2, apexY / 2, fz + Math.sin(a) * foot / 2);
      this.add('iron', leg, this.m);
    }
    this.box('iron', 0.09, 0.05, 0.09, fx, apexY + 0.01, fz, 1);                           // apex ring
    const potY = 1.12;
    this.m.makeTranslation(fx, (apexY + potY + 0.2) / 2, fz);
    this.add('iron', new THREE.CylinderGeometry(0.007, 0.007, apexY - potY - 0.2, 5), this.m);   // chain
    const pot = new THREE.CylinderGeometry(0.2, 0.17, 0.24, 14, 1, true);
    this.m.makeTranslation(fx, potY, fz); this.add('iron', pot, this.m);
    this.add('iron', new THREE.CircleGeometry(0.17, 14).rotateX(Math.PI / 2).translate(fx, potY - 0.12, fz));
    this.add('iron', new THREE.TorusGeometry(0.19, 0.008, 5, 16).rotateX(Math.PI / 2).translate(fx, potY + 0.12, fz));
    this.add('iron', new THREE.TorusGeometry(0.2, 0.008, 5, 16, Math.PI).rotateZ(0).translate(fx, potY + 0.12, fz));   // bail handle
    this.add('char', new THREE.CircleGeometry(0.15, 12).rotateX(-Math.PI / 2).translate(fx, potY + 0.06, fz));           // stew surface
    this.root.add(flames, embers); this.detail.push(flames, embers);
    this.owner._particles(this.mats.flame); this.owner._particles(this.mats.ember);
    this.pointLight(this.root, 0xff9a3c, 28, 22, 2, fx, 0.9, fz, 7.7);
    this.collider(fx, fz, 0.7, 0.7, 0, 0.6);
    const wp = this.worldPos(fx, 0.2, fz);
    this.owner.firePits.push({ x: wp.x, y: wp.y, z: wp.z });
    for (const [bx, bz, yaw] of [[fx - 1.9, fz + 0.2, 0.1], [fx + 0.6, fz + 1.9, Math.PI / 2 + 0.2], [fx + 1.0, fz - 1.9, -Math.PI / 2 - 0.1]] as const) {
      const { side, caps } = logGeo(1.8, 0.2, 0, 0, 12, true);
      const m = new THREE.Matrix4().makeRotationY(yaw + Math.PI / 2).setPosition(bx, 0.18, bz);
      this.add('bark', side, m); this.add('endGrain', caps, m);
      this.box('deck', 0.36, 0.05, 1.7, bx, 0.38, bz, 1.3, yaw);
      this.collider(bx, bz, 0.2, 0.9, 0, 0.45, yaw);
    }
  }

  // ── hanging lantern on the porch ──
  private lantern(model: THREE.Object3D) {
    const x = this.spec.W / 2 + 0.3, z = this.spec.doorZ + 0.78;   // bracket arm out from the wall beside the door
    const hangY = FLOOR + 2.05;
    this.box('iron', 0.42, 0.025, 0.025, x - 0.16, hangY + 0.03, z, 1);
    this.box('iron', 0.025, 0.2, 0.025, this.spec.W / 2 - LOG_R + 0.05, hangY - 0.07, z, 1);
    const lan = model.clone(true);
    lan.traverse((mesh) => {
      if (!isMesh(mesh)) return;
      mesh.castShadow = true;
      // rebuild the materials as plain MeshStandardMaterials (the glTF's physical brass + tangents
      // produced NaN fragments that bloom smeared over the whole frame)
      mesh.geometry = mesh.geometry.clone();
      mesh.geometry.deleteAttribute('tangent');
      const mat = mesh.material as THREE.MeshPhysicalMaterial;
      if (mat.transparent || /glass/i.test(mat.name)) {
        mesh.material = new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: new THREE.Color(1.0, 0.72, 0.4), emissiveIntensity: 3.0, roughness: 0.2, metalness: 0, transparent: true, opacity: 0.85 });
        this.sky.setupMaterial(mesh.material); // lit like everything else: one shared program instead of its own non-CSM one
        mesh.castShadow = false;
      } else {
        mesh.material = new THREE.MeshStandardMaterial({ map: mat.map, normalMap: mat.normalMap, roughnessMap: mat.roughnessMap, metalnessMap: mat.metalnessMap, aoMap: mat.aoMap, metalness: 0.9, roughness: 1, color: 0xd8b070 });
        this.sky.setupMaterial(mesh.material);
      }
    });
    const pivot = new THREE.Group();
    pivot.position.set(x, hangY + 0.02, z);
    lan.position.set(0, -0.46, 0);
    lan.scale.setScalar(1.35);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.005, 6, 12), this.mats.iron);
    ring.position.y = -0.03;
    pivot.add(lan, ring);
    this.pointLight(pivot, 0xffb060, 9, 11, 2, 0, -0.3, 0, 2.2 + this.index);
    this.root.add(pivot);
    this.detail.push(lan, ring); // never the pivot: its light must stay visible (a changing light count recompiles every shader)
    this.owner._swing({ pivot, seed: this.index * 2.3 });
  }

  // ── stone rubble and mossy stones along the foundation ──
  private rubble() {
    const { W, L } = this.spec;
    const n = Math.round((W + L) * 2.2);
    for (let i = 0; i < n; i++) {
      const side = this.rng.int(0, 3);
      const t = this.rng.range(-0.5, 0.5);
      let x: number, z: number;
      if (side === 0) { x = W / 2 + 0.25 + this.rng.range(0, 0.5); z = t * L; }
      else if (side === 1) { x = -(W / 2) - 0.25 - this.rng.range(0, 0.5); z = t * L; }
      else if (side === 2) { z = L / 2 + 0.25 + this.rng.range(0, 0.5); x = t * W; }
      else { z = -(L / 2) - 0.25 - this.rng.range(0, 0.5); x = t * W; }
      if (side === 0 && Math.abs(z) < L / 2 + 0.3) continue;                    // porch side
      const r = this.rng.range(0.07, 0.2);
      const g = boxUV(new THREE.DodecahedronGeometry(r, 0), 1.5, this.rng.next(), this.rng.next());
      g.scale(1, this.rng.range(0.5, 0.8), this.rng.range(0.8, 1.3));
      this.m.makeRotationFromEuler(new THREE.Euler(this.rng.range(0, 0.4), this.rng.range(0, 6.3), this.rng.range(0, 0.4))).setPosition(x, r * 0.35, z);
      this.add('stone', g, this.m);
    }
  }

  // ── crates, barrels, bucket, outdoor table/bench ──
  private outdoorProps() {
    const { L, porchDepth: D } = this.spec;
    const x0 = this.spec.W / 2 + 0.05, dz = this.spec.doorZ;
    const far = dz > 0 ? -1 : 1;
    this.placeProp('barrel', x0 + 0.5, FLOOR, far * (L / 2 - 0.6), this.rng.range(0, 6));
    this.placeProp('crate', x0 + 0.55, FLOOR, far * (L / 2 - 1.5), Math.PI / 2 + this.rng.range(-0.15, 0.15));
    this.placeProp('bucket', x0 + D - 0.45, FLOOR, far * (L / 2 - 0.5) * 0.9, this.rng.range(0, 6));
    this.placeProp('crate', x0 + D + 0.9, 0, dz + far * -1.4, this.rng.range(0, 6), 0.85);          // crate by the steps
    this.placeProp('barrel', -(this.spec.W / 2) - 0.5, 0, -far * (L / 2 - 0.4), this.rng.range(0, 6));  // rain barrel under the back eave
    if (this.spec.firePit) {
      // rope line with a drying hide between two posts
      const px = x0 + D + 1.4, pz = far * (L / 2 + 1.2), yaw = 0.3;
      const dx = Math.cos(yaw) * 1.5, dzz = -Math.sin(yaw) * 1.5;
      for (const sgn of [-1, 1]) { this.box('beam', 0.09, 1.9, 0.09, px + sgn * dx, 0.95, pz + sgn * dzz, 1); this.collider(px + sgn * dx, pz + sgn * dzz, 0.06, 0.06, 0, 1.9); }
      const rope = new THREE.CylinderGeometry(0.008, 0.008, 3.0, 5).rotateZ(Math.PI / 2);
      this.m.makeRotationY(yaw).setPosition(px, 1.78, pz); this.add('bark', rope, this.m);
      this.hide(px + 0.2 * Math.cos(yaw), 1.78, pz - 0.2 * Math.sin(yaw), yaw);
      this.collider(px, pz, 0.5, 0.05, 0, 1.8, yaw);
    }
    if (this.spec.bench === 'table') {
      const tx = x0 + D + 2.2, tz = -far * (L / 2 - 0.5);
      this.box('deck', 1.6, 0.06, 0.8, tx, 0.76, tz, 1.3);
      for (const [dx, dz2] of [[-0.65, -0.3], [0.65, -0.3], [-0.65, 0.3], [0.65, 0.3]] as const) this.box('beam', 0.09, 0.74, 0.09, tx + dx, 0.37, tz + dz2, 1);
      this.collider(tx, tz, 0.8, 0.4, 0, 0.8);
      for (const s of [-1, 1]) {
        this.box('deck', 1.5, 0.05, 0.28, tx, 0.45, tz + s * 0.7, 1.3);
        for (const dx of [-0.6, 0.6]) this.box('beam', 0.08, 0.43, 0.08, tx + dx, 0.215, tz + s * 0.7, 1);
        this.collider(tx, tz + s * 0.7, 0.75, 0.14, 0, 0.5);
      }
      this.placeProp('bucket', tx + 0.5, 0.79, tz - 0.15, this.rng.range(0, 6), 0.8);
    }
  }

  private smoke() {
    const { L } = this.spec;
    const side = this.spec.chimney === 'zpos' ? 1 : -1;
    const p = makeParticles(this.mats.smoke, 40, this.rng);
    p.position.set(-0.6, this.ridgeY + 0.85, side * (L / 2 + 0.42));
    p.renderOrder = 4;
    this.root.add(p);
    this.owner._particles(this.mats.smoke);
  }

  private finish() {
    for (const [key, list] of this.parts) {
      const merged = mergeOrNull(list);
      if (merged === null) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, this.mats[key]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.root.add(mesh);
      if (DETAIL_KEYS.has(key)) this.detail.push(mesh);
      else if (FAR_KEYS.has(key)) this.far.push(mesh);
    }
    this.parts.clear();
  }
}

// ───────────────────────────── the chunk's cabins ─────────────────────────────

export class Cabins {
  group = new THREE.Group();
  colliders: Collider[] = [];
  interactables: Interactable[] = [];
  firePits: { x: number; y: number; z: number }[] = [];
  private doors: Door[] = [];
  private fires: Fire[] = [];
  private swings: Swing[] = [];
  private particleMats = new Set<THREE.ShaderMaterial>();
  private floors: Floor[] = [];
  private lods: CabinLod[] = [];
  /** phone tier: the one shared set of point lights (a constant NUM_POINT_LIGHTS keeps every shader from recompiling) */
  private sharedLights: THREE.PointLight[] = [];
  private nearestCabin = -1;
  private tmpV = new THREE.Vector3();

  constructor(private sky: Sky) {}

  async build(): Promise<{ group: THREE.Group; colliders: Collider[]; interactables: Interactable[] }> {
    // the seven PBR sets and the six models in one round of fetches (they were two, back to back)
    const [mats, [firePitGltf, lanternGltf, crate, barrel, bucket, hatchet]] = await Promise.all([loadMats(this.sky), Promise.all([
      loadGLTF('stone_fire_pit'), loadLod('Lantern_01'), loadGLTF('wooden_crate_02'), loadGLTF('wine_barrel_01'), loadGLTF('wooden_bucket_01'), loadGLTF('hatchet'),
    ])]);
    const props = { crate: prepModel(crate.scene, this.sky), barrel: prepModel(barrel.scene, this.sky), bucket: prepModel(bucket.scene, this.sky), hatchet: prepModel(hatchet.scene, this.sky) };
    for (const [i, site] of CABIN_SITES.entries()) {
      if (i > 0) await macrotask(); // one cabin per task: the whole homestead in one go was a 180 ms long task at 4x CPU
      const spec = SPECS[i];
      if (spec === undefined) throw new Error(`Cabins: no spec for site ${i}`);
      const y = heightAt(site.x, site.z);
      // per-cabin prop instances: each cabin's crates / barrels / buckets / hatchet are its own detail meshes
      // (hidden with the rest of its hardware past cabinDetailDist) — 8 chunk-wide instanced meshes were always drawn
      const propInstances: Record<PropKind, THREE.Matrix4[]> = { crate: [], barrel: [], bucket: [], hatchet: [] };
      const b = new CabinBuilder(this, spec, i, site.x, y, site.z, site.rot, mats, this.sky, propInstances);
      b.build(firePitGltf.scene, lanternGltf.scene);
      this.group.add(b.root);
      for (const k of Object.keys(propInstances) as PropKind[]) {
        const list = propInstances[k];
        if (list.length === 0) continue;
        for (const m of props[k]) {
          const im = new THREE.InstancedMesh(m.geometry, m.material, list.length);
          im.castShadow = true; im.receiveShadow = true;
          const tmp = new THREE.Matrix4();
          list.forEach((mat, j) => { im.setMatrixAt(j, tmp.copy(mat).multiply(m.matrix)); });
          im.instanceMatrix.needsUpdate = true;
          im.computeBoundingSphere();
          this.group.add(im);
          b.detail.push(im);
        }
      }
      if (!TIER_CONFIG.cabinDetailShadows) for (const o of b.detail) o.traverse((c) => { c.castShadow = false; });
      this.lods.push({ root: b.root, detail: b.detail, far: b.far, anchors: b.anchors, detailOn: true, farOn: false });
    }
    return { group: this.group, colliders: this.colliders, interactables: this.interactables };
  }

  /** world y of a floor / deck under (x,z) if inside a cabin or porch footprint */
  floorHeightAt(x: number, z: number): number | undefined {
    for (const f of this.floors) {
      const c = Math.cos(f.rot), s = Math.sin(f.rot);
      const lx = (x - f.x) * c - (z - f.z) * s, lz = (x - f.x) * s + (z - f.z) * c;
      if (Math.abs(lx) <= f.hw && Math.abs(lz) <= f.hd) return f.y;
    }
    return undefined;
  }

  update(dt: number, t: number): void {
    // LOD: hardware (iron, glass, lantern, fire pit, flames …) only within cabinDetailDist; the 4 shared phone
    // lights follow the nearest cabin
    const cam = this.sky.viewCamera; cam.getWorldPosition(this.tmpV);
    let nearest = -1, nearestD2 = Infinity;
    const dd = TIER_CONFIG.cabinDetailDist * TIER_CONFIG.cabinDetailDist;
    this.lods.forEach((l, i) => {
      const d2 = l.root.position.distanceToSquared(this.tmpV);
      if (d2 < nearestD2) { nearestD2 = d2; nearest = i; }
      const on = d2 < dd;
      if (on !== l.detailOn) { l.detailOn = on; for (const o of l.detail) o.visible = on; }
      // past 2× the detail distance only the silhouette parts stay (log walls, roof, stone, deck, beams, smoke)
      const far = d2 > dd * 4;
      if (far !== l.farOn) { l.farOn = far; for (const o of l.far) o.visible = !far; }
    });
    const l = this.lods[nearest];
    if (this.sharedLights.length > 0 && nearest >= 0 && l !== undefined) {
      if (nearest !== this.nearestCabin) {
        this.nearestCabin = nearest;
        this.fires = this.fires.filter((f) => !this.sharedLights.includes(f.light));
        this.sharedLights.forEach((light, i) => {
          const a = l.anchors[i];
          if (!a) { light.intensity = 0; return; }
          light.color.set(a.color); light.distance = a.distance; light.decay = a.decay;
          this.fires.push({ light, base: a.intensity, seed: a.seed });
        });
      }
      this.sharedLights.forEach((light, i) => { const a = l.anchors[i]; if (a) a.anchor.getWorldPosition(light.position); });
    }
    for (const d of this.doors) {
      const target = d.open ? 1 : 0;
      if (d.t === target) continue;
      d.t = Math.max(0, Math.min(1, d.t + Math.sign(target - d.t) * dt / 0.6));
      const e = d.t < 0.5 ? 2 * d.t * d.t : 1 - (-2 * d.t + 2) ** 2 / 2; // ease in-out
      d.pivot.rotation.y = -e * 1.85;
    }
    for (const f of this.fires) {
      const n = Math.sin(t * 11 + f.seed) * 0.5 + Math.sin(t * 23.7 + f.seed * 2.3) * 0.3 + Math.sin(t * 3.1 + f.seed) * 0.2;
      f.light.intensity = f.base * (1 + 0.28 * n);
    }
    for (const sw of this.swings) { sw.pivot.rotation.z = Math.sin(t * 1.35 + sw.seed) * 0.05 + Math.sin(t * 2.9 + sw.seed * 1.7) * 0.015; sw.pivot.rotation.x = Math.cos(t * 1.1 + sw.seed) * 0.03; }
    for (const m of this.particleMats) { const u = m.uniforms['uTime']; if (u !== undefined) u.value = t; }
  }

  /** @internal */ _door(d: Door): void { this.doors.push(d); this.colliders.push(d.collider); this.interactables.push(d.interactable); }
  /** @internal */ _fire(f: Fire): void { this.fires.push(f); }
  /** @internal */ _swing(sw: Swing): void { this.swings.push(sw); }
  /** @internal */ _particles(m: THREE.ShaderMaterial): void { this.particleMats.add(m); }
  /** @internal */ _floor(f: Floor): void { this.floors.push(f); }
}

// ───────────────────────────── glTF helpers ─────────────────────────────

const lodLoader = new GLTFLoader();
export function loadLod(id: string): Promise<{ scene: THREE.Group }> {
  return new Promise<{ scene: THREE.Group }>((resolve, reject) => { lodLoader.load(`/assets/models/${id}/${id}_lod.glb`, resolve, undefined, reject); });
}

/** flatten a glTF scene into (geometry, material, world matrix) triples with sky-aware materials */
export function prepModel(scene: THREE.Object3D, sky: Sky): PropPart[] {
  scene.updateMatrixWorld(true);
  const out: PropPart[] = [];
  scene.traverse((m) => {
    if (!isMesh(m)) return;
    const mat = m.material as THREE.MeshStandardMaterial;
    for (const t of [mat.map, mat.normalMap, mat.roughnessMap, mat.aoMap]) if (t) t.anisotropy = 8;
    sky.setupMaterial(mat);
    out.push({ geometry: m.geometry, material: mat, matrix: m.matrixWorld.clone() });
  });
  return out;
}

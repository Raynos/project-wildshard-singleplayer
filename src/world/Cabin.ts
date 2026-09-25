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
import { boxDesc, type ColliderDesc } from './registry';
import { TIER_CONFIG } from '../core/tier';
import { macrotask } from '../boot/plan';
import { LightPool } from '../fx/LightPool';
import { SHADOW_LAYER } from '../core/shadowLayer';
import { stateSlot } from '../core/shardState';

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
 * - `colliderDescs()` PHYSICS P3: the static collision as real geometry (walls, floors, porch + its step, furniture);
 *                   `doorPieces()` the door slabs, in each door pivot's frame, for kinematic pieces that swing with it.
 *
 * Cabin local frame: door + porch face local +X, the ridge runs along local Z. The whole cabin is
 * rotated by CABIN_SITES[i].rot around Y and sits on `heightAt(site)` (pads are flat; the stone
 * plinth reaches 0.9 m below ground so no residual mismatch can show).
 *
 * Built procedurally from the Poly Haven PBR sets: every wall log is a real cylinder (round
 * silhouette, interleaved notched-corner overhangs, chinking slab behind), the roof is planks over
 * rafters + purlins + a ridge log, doors are hinged plank doors that swing inward, windows have
 * frames, mullions and reflective glass with a warm interior glow. Static geometry is merged per
 * material, the never-hidden materials across the cabins (Cabins.batchCores); props are instanced across cabins.
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

/** `open`: an unglazed hatch (the trader's serving window: no glass, a counter + awning outside when on the front wall) */
interface WindowSpec { wall: WallId; at: number; w?: number; y?: number; h?: number; open?: boolean }
export interface CabinSpec {
  W: number; L: number; rows: number; pitch: number;
  doorZ: number;
  windows: WindowSpec[];
  chimney: 'zpos' | 'zneg';
  /** no chimney stack or fireplace (a shed, the stall, the mill); `chimney` still names the end the annex / lean-to avoids */
  noChimney?: boolean;
  /** 0 = no porch (the floor is a 0.22 m step up from the pad) */
  porchDepth: number;
  annex?: { W: number; L: number; rows: number; pitch: number };   // L-shaped wing off the gable end opposite the chimney
  leanTo?: boolean;                                               // wood shed on the gable end opposite the chimney
  lantern?: boolean;
  firePit?: boolean;
  bench?: 'logs' | 'table';
  /** 'swing' (default): a hinged door you open; 'fixed': shut for good, merged into the static mesh (0 draws of its own) */
  door?: 'swing' | 'fixed';
  /** what is inside: the ranger's 'home' (default), the lodge's 'hall', a 'store' of crates, the 'mill' stones, or 'none' */
  interior?: 'home' | 'hall' | 'store' | 'mill' | 'none';
  /** how far the stone plinth reaches below the pad (default 0.9; the mill's creek side falls away) */
  plinthDrop?: number;
  /**
   * the watermill's wheel wing (PH-B3): a log room on stilts off the back wall (local −X), `L` long, reaching out over the
   * creek's bank, and the undershot wheel beside its far end, turning in the creek (radius `r`, axle `axleY` above the pad)
   */
  wing?: { W: number; L: number; rows: number; pitch: number; r: number; axleY: number };
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

interface Door {
  id: string; pivot: THREE.Object3D; open: boolean; t: number; collider: Collider; interactable: Interactable;
  /** PHYSICS P3: the leaf as a box in the pivot's local frame */
  slab: ColliderDesc;
}
/** `kind`: a fire burns all day and only reads stronger at night; a lamp (lantern, room light) is lit by the clock (PH-L3) */
type LightKind = 'fire' | 'lamp';
interface Fire { light: THREE.PointLight; base: number; seed: number; kind: LightKind }
/** phone tier: a point light's slot — the shared lights jump to the nearest cabin's anchors (`rank`: which ones get a light) */
interface LightAnchor { anchor: THREE.Object3D; color: number; intensity: number; distance: number; decay: number; seed: number; kind: LightKind; rank: number }
/** `pad`: metres added to the LOD distances (a cluster's root sits at its centroid, its buildings up to `pad` m away) */
/** a room's floor rectangle in the building's frame (inside = the pooled pair lights the room: Cabins.update) */
interface Room { x: number; z: number; hw: number; hd: number }
interface CabinLod {
  root: THREE.Object3D; detail: THREE.Object3D[]; far: THREE.Object3D[]; anchors: LightAnchor[]; detailOn: boolean; farOn: boolean; pad: number; lit?: () => boolean;
  /** the building's rooms and its door (local x, z): an eye inside, or within 3 m of the door, ranks the room lamps first */
  rooms?: Room[]; door?: [number, number];
  /** desktop: casters that cast only while the detail LOD is off (a near proxy in `detail` draws their depth while it is on) */
  swap?: THREE.Object3D[];
}
interface Swing { pivot: THREE.Object3D; seed: number }
interface Floor { x: number; z: number; rot: number; hw: number; hd: number; y: number }
type PropKind = 'crate' | 'barrel' | 'bucket' | 'hatchet';
const PROP_KINDS: readonly PropKind[] = ['crate', 'barrel', 'bucket', 'hatchet'];
/** one (geometry, material, world matrix) part of a flattened glTF prop */
interface PropPart { geometry: THREE.BufferGeometry; material: THREE.Material; matrix: THREE.Matrix4 }

// ───────────────────────────── materials ─────────────────────────────

export interface Mats {
  log: THREE.MeshStandardMaterial; endGrain: THREE.MeshStandardMaterial; chink: THREE.MeshStandardMaterial;
  roof: THREE.MeshStandardMaterial; beam: THREE.MeshStandardMaterial; deck: THREE.MeshStandardMaterial;
  door: THREE.MeshStandardMaterial; stone: THREE.MeshStandardMaterial; glass: THREE.MeshStandardMaterial;
  bark: THREE.MeshStandardMaterial; iron: THREE.MeshStandardMaterial; cloth: THREE.MeshStandardMaterial;
  char: THREE.MeshStandardMaterial;
  smoke: THREE.ShaderMaterial; flame: THREE.ShaderMaterial; ember: THREE.ShaderMaterial; glow: THREE.MeshBasicMaterial;
}
export type MatKey = Exclude<keyof Mats, 'smoke' | 'flame' | 'ember' | 'glow' | 'glass'>;

const matsCache = new WeakMap<Sky, Promise<Mats>>();
/** the cabins' PBR materials, loaded once per sky and shared (PH-B3: the landmarks build with the same set — no new programs) */
export function cabinMats(sky: Sky): Promise<Mats> {
  let p = matsCache.get(sky);
  if (p === undefined) { p = loadMats(sky); matsCache.set(sky, p); }
  return p;
}

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

export function makeGlowTexture(): THREE.CanvasTexture {
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

/** the night's hold on the cabins' particles: uShade dims the smoke's shadow side, uLamps lights the chimney glow (Cabins.update) */
const cabinNight = { uShade: { value: 1 }, uLamps: { value: 1 } };
/** the phone's pooled cabin lights (PH-L3) */
const SHARED_CABIN_LIGHTS = 2;

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
    uSunDir: { value: sky.sunDir }, uSunColor: { value: sky.sunColor }, uShade: cabinNight.uShade, uLamps: cabinNight.uLamps, // the sky's own: the clock moves them
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
      uniform sampler2D tNoise; uniform float uTime; uniform vec3 uSunColor; uniform int uKind; uniform float uShade; uniform float uLamps;
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
          vec3 col = mix(vec3(0.36, 0.38, 0.44), vec3(0.95, 0.9, 0.85) * uSunColor * 1.25, lit) * (0.85 + 0.3 * n2) * uShade;
          // the chimney's glow (PH-L3): the young plume catches the hearth's light from below at night
          col += vec3(1.0, 0.42, 0.12) * 0.16 * uLamps * (1.0 - smoothstep(0.0, 0.1, vAge)) * (1.0 - uShade);
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
export function boxUV<G extends THREE.BufferGeometry>(geo: G, scale: number, uOff = 0, vOff = 0): G {
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
export function swapUV<G extends THREE.BufferGeometry>(geo: G): G {
  const uv = geo.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getY(i), uv.getX(i));
  return geo;
}

/** a horizontal log along +X of `len`, radius r, textured with one board of the log-wall set (or bark when `bark`) */
export function logGeo(len: number, r: number, board: number, vOff: number, segs = 14, bark = false): { side: THREE.CylinderGeometry; caps: THREE.BufferGeometry } {
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
/** never drawn in a view (SHADOW_LAYER), only its depth: front-sided like every cabin material, so the shadow side matches */
const shadowProxyMaterial = new THREE.MeshBasicMaterial({ colorWrite: false });

/** position-only merged caster on SHADOW_LAYER (drawn into the sun's shadow maps and nowhere else); null for an empty list */
function shadowProxy(list: THREE.BufferGeometry[]): THREE.Mesh | null {
  const g = list.length > 0 ? mergeOrNull(list) : null;
  if (g === null) return null;
  g.computeBoundingSphere();
  const proxy = new THREE.Mesh(g, shadowProxyMaterial);
  proxy.castShadow = true; proxy.layers.set(SHADOW_LAYER);
  return proxy;
}
/**
 * `geo`'s positions only, moved by `m`, indexed with every triangle twice — as it is and with its winding reversed — for
 * the front-sided shadowProxyMaterial: the glTF casters (fire pit, crates, barrels, buckets, hatchet) are double-sided,
 * whose depth pass draws each triangle whichever way it faces; the front-sided (back-face) depth pass draws exactly one of
 * the pair, so the same depth — with the depth program the cabins' proxies already use, no double-sided one.
 */
function twoSidedPositions(geo: THREE.BufferGeometry, m: THREE.Matrix4): THREE.BufferGeometry {
  const out = new THREE.BufferGeometry();
  const pos = geo.getAttribute('position');
  out.setAttribute('position', pos.clone());
  const src = geo.index, n = src ? src.count : pos.count;
  const idx = new Uint32Array(n * 2);
  for (let i = 0; i + 2 < n; i += 3) {
    const a = src ? src.getX(i) : i, b = src ? src.getX(i + 1) : i + 1, c = src ? src.getX(i + 2) : i + 2;
    idx[i] = a; idx[i + 1] = b; idx[i + 2] = c;
    idx[n + i] = a; idx[n + i + 1] = c; idx[n + i + 2] = b;
  }
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out.applyMatrix4(m);
}
/** `geo`'s positions only (non-indexed, sharing the attribute when it already is): a caster for a front-sided proxy */
function flatPositions(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const out = new THREE.BufferGeometry(); out.setAttribute('position', g.getAttribute('position'));
  return out;
}

/**
 * Desktop (TIER_CONFIG.cabinDetailShadows): the casters of a building's near shadow proxies, position-only in its root's
 * frame, merged into ONE proxy drawn while the detail LOD is on: `front`, the front-sided sets (the core, far and detail
 * merges: it stands in for the core + far proxies and the four detail meshes); `double`, the double-sided glTF casters
 * (fire pit, props), each triangle both ways round (twoSidedPositions).
 */
interface NearCasters { front: THREE.BufferGeometry[]; double: THREE.BufferGeometry[] }
/** a non-indexed position-only geometry with the plain index 0 … n−1 (its position attribute shared) */
function sequentialIndex(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const pos = geo.getAttribute('position'), idx = new Uint32Array(pos.count);
  for (let i = 0; i < idx.length; i++) idx[i] = i;
  const out = new THREE.BufferGeometry(); out.setAttribute('position', pos); out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}
/** merged parts that go too past 2× cabinDetailDist (log ends, woodpile bark, door frame) */
const FAR_KEYS = new Set<MatKey>(['endGrain', 'bark', 'door']);

/**
 * PH-B3: a cluster of buildings (the mill hamlet) whose static parts merge into ONE set of per-material meshes under
 * `root` — five buildings cost about one cabin's draws. Each member's builder writes its parts here in `root`'s frame.
 */
interface ClusterSink { root: THREE.Group; parts: Map<MatKey, THREE.BufferGeometry[]>; glass: THREE.BufferGeometry[] }
/** a sub-frame inside a building (the mill's wing): local (x, z) turned by `yaw` about +Y, then moved to (x, y, z) */
interface SubFrame { x: number; y: number; z: number; yaw: number }

class CabinBuilder {
  root = new THREE.Group();
  /** small parts hidden beyond TIER_CONFIG.cabinDetailDist */
  detail: THREE.Object3D[] = [];
  /** mid parts hidden beyond 2× cabinDetailDist */
  far: THREE.Object3D[] = [];
  /** desktop: the near proxies' casters (see NearCasters; null on the phone, whose detail casts no shadow) */
  readonly casters: NearCasters | null = TIER_CONFIG.cabinDetailShadows ? { front: [], double: [] } : null;
  /** casters whose shadow a near proxy draws while the detail LOD is on: they cast only while it is off (Cabins.update) */
  swap: THREE.Object3D[] = [];
  /** the never-hidden per-material meshes (finishParts' core set) — Cabins.batchCores merges them across the cabins */
  core: CoreMesh[] = [];
  /** phone tier: where this cabin's point lights would be (see Cabins.sharedLights) */
  anchors: LightAnchor[] = [];
  /** the rooms' floor rectangles and the door, in the building's frame (Cabins.update's indoor lamp ranking) */
  rooms: Room[] = [];
  doorAt: [number, number];
  private parts = new Map<MatKey, THREE.BufferGeometry[]>();
  private rng: Rng;
  private wallTop: number;
  private ridgeY: number;
  private tanP: number;
  private m = new THREE.Matrix4();
  /** the active sub-frame (withFrame) and its matrix */
  private frame: SubFrame | null = null;
  private frameM = new THREE.Matrix4();
  /** building frame → the cluster root's frame (a cluster member only) */
  private toSink = new THREE.Matrix4();
  /** a cluster member's lights are anchors only (the phone's pooled pair may visit them; never a light of their own) */
  private anchorLights: boolean;

  constructor(
    private owner: Cabins, private spec: CabinSpec, private index: number,
    private cx: number, private cy: number, private cz: number, private rot: number,
    private mats: Mats, private sky: Sky, private propInstances: Record<PropKind, THREE.Matrix4[]>,
    private sink?: ClusterSink,
  ) {
    this.rng = new Rng(SEED + 500 + index * 17);
    this.root.position.set(cx, cy, cz);
    this.root.rotation.y = rot;
    this.root.updateMatrixWorld(true);
    this.anchorLights = sink !== undefined;
    this.doorAt = [spec.W / 2, spec.doorZ];
    this.rooms.push({ x: 0, z: 0, hw: spec.W / 2, hd: spec.L / 2 });
    if (spec.wing) this.rooms.push({ x: -(spec.W / 2) - spec.wing.L / 2, z: 0, hw: spec.wing.L / 2, hd: spec.wing.W / 2 });
    if (sink) { sink.root.updateMatrixWorld(true); this.toSink.copy(sink.root.matrixWorld).invert().multiply(this.root.matrixWorld); }
    this.wallTop = PLINTH + spec.rows * LOG;                // top of the eave (Z) walls
    this.tanP = Math.tan(spec.pitch);
    this.ridgeY = this.wallTop + (spec.W / 2) * this.tanP;
  }

  // ── helpers ──
  private add(key: MatKey, geo: THREE.BufferGeometry, matrix?: THREE.Matrix4) {
    if (matrix) geo.applyMatrix4(matrix);
    if (this.frame) geo.applyMatrix4(this.frameM);
    const g = geo.index ? geo.toNonIndexed() : geo;
    if ((key === 'roof' || key === 'stone') && !g.hasAttribute('moss')) {
      // moss density hint: stone = near the ground, roof default = mid-slope
      const pos = g.getAttribute('position'), moss = new Float32Array(pos.count);
      for (let i = 0; i < pos.count; i++) moss[i] = key === 'stone' ? clamp01((0.9 - pos.getY(i)) / 1.1) : 0.35;
      g.setAttribute('moss', new THREE.BufferAttribute(moss, 1));
    }
    if (this.sink) g.applyMatrix4(this.toSink);
    const parts = this.sink ? this.sink.parts : this.parts;
    const list = parts.get(key);
    if (list === undefined) parts.set(key, [g]); else list.push(g);
  }
  /** build `fn`'s geometry, colliders and floors in a sub-frame of the building (the mill's wing) */
  private withFrame(f: SubFrame, fn: () => void) {
    this.frame = f;
    this.frameM.makeRotationY(f.yaw).setPosition(f.x, f.y, f.z);
    try { fn(); } finally { this.frame = null; }
  }
  /** a sub-frame point / turn → the building frame */
  private fr(lx: number, lz: number): [number, number] {
    const f = this.frame;
    if (f === null) return [lx, lz];
    const c = Math.cos(f.yaw), s = Math.sin(f.yaw);
    return [f.x + lx * c + lz * s, f.z - lx * s + lz * c];
  }
  private get frYaw(): number { return this.frame?.yaw ?? 0; }
  private get frY(): number { return this.frame?.y ?? 0; }
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
  private collider(lx0: number, lz0: number, hw: number, hd: number, yBottom0: number, yTop0: number, localRot0 = 0): Collider {
    const [lx, lz] = this.fr(lx0, lz0), localRot = localRot0 + this.frYaw, yBottom = yBottom0 + this.frY, yTop = yTop0 + this.frY;
    const c = Math.cos(this.rot), s = Math.sin(this.rot);
    const col: Collider = {
      x: this.cx + lx * c + lz * s, z: this.cz - lx * s + lz * c,
      hw, hd, rot: -(this.rot + localRot), yTop: this.cy + yTop, yBottom: this.cy + yBottom,
    };
    this.owner.colliders.push(col);
    return col;
  }
  /**
   * PHYSICS P3: a static box for `Cabins.colliderDescs()` only (not a legacy `Collider`), in the cabin's local frame:
   * centre (lx, lz), half-extents hw × hd turned by `localRot`, from yBottom to yTop above the cabin base.
   */
  private solid(lx0: number, lz0: number, hw: number, hd: number, yBottom0: number, yTop0: number, localRot0 = 0, surface?: 'stone' | 'wood') {
    const [lx, lz] = this.fr(lx0, lz0), localRot = localRot0 + this.frYaw, yBottom = yBottom0 + this.frY, yTop = yTop0 + this.frY;
    const c = Math.cos(this.rot), s = Math.sin(this.rot);
    this.owner._solid({
      kind: 'box', x: this.cx + lx * c + lz * s, y: this.cy + (yTop + yBottom) / 2, z: this.cz - lx * s + lz * c,
      hx: hw, hy: (yTop - yBottom) / 2, hz: hd, yaw: this.rot + localRot, ...(surface === undefined ? {} : { surface }),
    });
  }
  private worldPos(lx: number, ly: number, lz: number) {
    const v = new THREE.Vector3(lx, ly, lz);
    if (this.frame) v.applyMatrix4(this.frameM);
    return v.applyMatrix4(this.root.matrixWorld);
  }
  /** a flickering point light under `parent` — a real light on desktop, an anchor for the shared set on the phone (`rank`:
   *  the phone lights the lowest ranks of the nearest cabin: the fire pit, then the porch lantern, the room, the hearth) */
  private pointLight(parent: THREE.Object3D, color: number, intensity: number, distance: number, decay: number, x: number, y: number, z: number, seed: number, kind: LightKind, rank: number) {
    if (TIER_CONFIG.sharedCabinLights || this.anchorLights) {
      const anchor = new THREE.Object3D(); anchor.position.set(x, y, z); parent.add(anchor);
      this.anchors.push({ anchor, color, intensity, distance, decay, seed, kind, rank });
      this.anchors.sort((a, b) => a.rank - b.rank);
      return;
    }
    const light = new THREE.PointLight(color, intensity, distance, decay);
    light.position.set(x, y, z); parent.add(light);
    this.owner._fire({ light, base: intensity, seed, kind });
  }
  private placeProp(kind: PropKind, x: number, y: number, z: number, ry: number, scale = 1) {
    const local = new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z).scale(new THREE.Vector3(scale, scale, scale));
    if (this.frame) local.premultiply(this.frameM);
    this.propInstances[kind].push(new THREE.Matrix4().multiplyMatrices(this.root.matrixWorld, local));
    // PHYSICS P3: the glTF props' bounds (wooden_crate_02 0.53 × 0.45 × 1.17, wine_barrel_01 ⌀0.74 × 0.87,
    // wooden_bucket_01 ⌀0.35 × 0.35); the hatchet sits in its chopping block's collider
    const dims = { crate: { hw: 0.265, hd: 0.583, h: 0.455 }, barrel: { hw: 0.34, hd: 0.34, h: 0.872 }, bucket: { hw: 0.17, hd: 0.17, h: 0.35 }, hatchet: null }[kind];
    if (dims) this.solid(x, z, dims.hw * scale, dims.hd * scale, y, y + dims.h * scale, ry, 'wood');
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
      this.rooms.push({ x: ox, z: oz, hw: a.W / 2, hd: a.L / 2 });
      ext.back = annexSide > 0 ? { to: hz + a.L } : { from: -(hz + a.L) };
      (openings[annexSide > 0 ? 'zpos' : 'zneg'] ??= []).push({ a0: ox - 0.5, a1: ox + 0.5, y0: PLINTH - 0.05, y1: FLOOR + 2.0 });
    }
    if (this.spec.wing) (openings.back ??= []).push({ a0: -0.5, a1: 0.5, y0: PLINTH - 0.05, y1: snapRow(FLOOR + 2.1 + 0.1, false) });
    this.foundation(W, L, 0, 0, this.spec.plinthDrop);
    this.floorPlanks(W, L, 0, 0);
    this.logBox(W, L, 0, 0, this.spec.rows, this.spec.pitch, { gables: { zpos: true, zneg: true }, ext, openings });
    this.roof(W, L, 0, 0, this.spec.pitch, this.wallTop, 0.12, 0.55, 0.5, 0.5);
    this.door();
    this.windows();
    if (!this.spec.noChimney) this.chimney();
    if (this.spec.porchDepth > 0) this.porch();
    const inside = this.spec.interior ?? 'home';
    if (inside === 'home') this.interior();
    else if (inside !== 'none') this.furnish(inside);
    if (annexBox && a) this.annex(annexBox.ox, annexBox.oz, annexSide, a);
    if (this.spec.leanTo) this.leanTo(annexSide);
    else if (!this.spec.wing) this.woodpile(-(W / 2) - 0.32, -annexSide * (L / 2 - 1.6), 0, 4, 1.8, { x: -(W / 2) - 0.25, z: -annexSide * (L / 2 + 0.9) });
    if (this.spec.firePit) this.firePit(firePit);
    if (this.spec.lantern) this.lantern(lantern);
    this.outdoorProps();
    this.rubble();
    if (!this.spec.noChimney) this.smoke();
    if (this.spec.wing) this.wing(this.spec.wing);
    this.finish();
  }

  // ── stone plinth: one course above ground, deep enough to hide any slope ──
  private foundation(W: number, L: number, ox: number, oz: number, drop = 0.9) {
    this.box('stone', W + 0.3, PLINTH + drop, L + 0.3, ox, (PLINTH - drop) / 2, oz, 2.0);
    this.box('stone', W + 0.44, 0.1, L + 0.44, ox, 0.05, oz, 2.0); // proud footing course at grade
    this.solid(ox, oz, W / 2 + 0.15, L / 2 + 0.15, -drop, PLINTH, 0, 'stone');   // PHYSICS P3: the plinth's top
  }

  private floorPlanks(W: number, L: number, ox: number, oz: number) {
    const g = new THREE.BoxGeometry(W - 0.2, FLOOR - PLINTH + 0.02, L - 0.2);
    boxUV(g, 1.3, this.rng.next(), this.rng.next());
    this.m.makeTranslation(ox, (FLOOR + PLINTH) / 2, oz);
    this.add('deck', g, this.m);
    const w = this.worldPos(ox, FLOOR, oz);
    this.owner._floor({ x: w.x, z: w.z, rot: this.rot + this.frYaw, hw: W / 2, hd: L / 2, y: w.y });
    this.solid(ox, oz, W / 2, L / 2, PLINTH - 0.15, FLOOR, 0, 'wood');   // PHYSICS P3: the floor, its top = floorHeightAt
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
    const leaf = new THREE.BoxGeometry(0.06, H, DW);
    {
      const uv = leaf.getAttribute('uv'), pos = leaf.getAttribute('position'), nor = leaf.getAttribute('normal');
      for (let i = 0; i < uv.count; i++) {
        if (Math.abs(nor.getX(i)) > 0.5) uv.setXY(i, 0.02 + (pos.getZ(i) / DW + 0.5) * 0.46, (pos.getY(i) / H + 0.5) * 1.05);
        else uv.setXY(i, 0.5 + pos.getY(i) * 0.5, 0.05 + pos.getZ(i) * 0.3);
      }
    }
    leaf.translate(0, H / 2, DW / 2);
    if (this.spec.door === 'fixed') {
      // shut for good: the leaf, its battens and strap hinges go into the merged mesh, one box keeps you out
      this.m.makeTranslation(x - 0.02, FLOOR + 0.02, dz - DW / 2);
      this.add('door', leaf, this.m);
      for (const by of [0.35, H / 2, H - 0.35]) this.add('beam', boxUV(new THREE.BoxGeometry(0.03, 0.12, DW - 0.1), 1).translate(-0.045, by, DW / 2), this.m);
      for (const hy of [0.32, H - 0.32]) this.add('iron', new THREE.BoxGeometry(0.015, 0.06, 0.42).translate(0.04, hy, 0.19), this.m);
      this.collider(x, dz, 0.08, DW / 2, 0, FLOOR + H);
      return;
    }
    const pivot = new THREE.Group();
    pivot.position.set(x - 0.02, FLOOR + 0.02, dz - DW / 2);
    const doorMesh = new THREE.Mesh(leaf, this.mats.door);
    doorMesh.castShadow = this.casters === null; doorMesh.receiveShadow = true;
    pivot.add(doorMesh);
    const iron: THREE.BufferGeometry[] = [];
    for (const hy of [0.32, H - 0.32]) {
      iron.push(new THREE.BoxGeometry(0.015, 0.06, 0.42).translate(0.04, hy, 0.19));
      iron.push(new THREE.CylinderGeometry(0.018, 0.018, 0.12, 8).translate(0.045, hy, -0.005));
    }
    iron.push(new THREE.TorusGeometry(0.045, 0.008, 6, 14).rotateY(Math.PI / 2).translate(0.045, 1.0, DW - 0.13));
    iron.push(new THREE.CylinderGeometry(0.012, 0.012, 0.09, 6).rotateZ(Math.PI / 2).translate(0.01, 1.0, DW - 0.13));
    const ironMesh = new THREE.Mesh(mergeGeometries(iron.map((g) => g.toNonIndexed())), this.mats.iron);
    ironMesh.castShadow = this.casters === null;
    pivot.add(ironMesh); this.detail.push(ironMesh);
    const battens: THREE.BufferGeometry[] = [];
    for (const by of [0.35, H / 2, H - 0.35]) battens.push(boxUV(new THREE.BoxGeometry(0.03, 0.12, DW - 0.1), 1).translate(-0.045, by, DW / 2));
    battens.push(boxUV(new THREE.BoxGeometry(0.03, 0.12, Math.hypot(H - 0.7, DW - 0.1) - 0.1), 1).rotateX(Math.atan2(H - 0.7, DW - 0.1)).translate(-0.045, H / 2, DW / 2));
    const battenMesh = new THREE.Mesh(mergeGeometries(battens.map((g) => g.toNonIndexed())), this.mats.beam);
    battenMesh.castShadow = this.casters === null;
    pivot.add(battenMesh); this.detail.push(battenMesh);
    this.root.add(pivot); this.far.push(doorMesh);
    if (this.casters !== null) {
      // desktop: the leaf, its strap hinges and its battens cast as ONE proxy in the pivot (it swings with the door) while
      // the detail LOD is on (3 → 1 shadow draw per cascade); past it the leaf casts alone again, as before (this.swap)
      const proxy = shadowProxy([doorMesh, ironMesh, battenMesh].map((m) => flatPositions(m.geometry)));
      if (proxy !== null) { pivot.add(proxy); this.detail.push(proxy); this.swap.push(doorMesh); }
      else doorMesh.castShadow = true;
    }

    const col = this.collider(x, dz, 0.08, DW / 2, 0, FLOOR + H);
    const d: Door = {
      id: `cabin-${this.index + 1}-door`, pivot, open: false, t: 0, collider: col,
      // the leaf (±0.03) with its battens (−0.06) and strap hinges (+0.05), pivot frame: hinge edge at z 0, floor at y 0
      slab: { kind: 'box', x: 0, y: H / 2, z: DW / 2, hx: 0.06, hy: H / 2, hz: DW / 2, surface: 'wood' },
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
  private windowFrame(o: Opening, alongZ: boolean, at: number, glass: THREE.BufferGeometry[] | null) {
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
    if (glass === null) return;
    const pane = new THREE.PlaneGeometry(ww, hh).applyMatrix4(m);
    glass.push(this.frame ? pane.applyMatrix4(this.frameM) : pane);
  }
  private windows() {
    const { W, L } = this.spec;
    const glass: THREE.BufferGeometry[] = [];
    for (const w of this.spec.windows) {
      const alongZ = w.wall === 'front' || w.wall === 'back';
      const at = w.wall === 'front' ? W / 2 - LOG_R : w.wall === 'back' ? -(W / 2 - LOG_R) : w.wall === 'zpos' ? L / 2 - LOG_R : -(L / 2 - LOG_R);
      const o = this.windowOpening(w);
      this.windowFrame(o, alongZ, at, w.open ? null : glass);
      if (w.open && w.wall === 'front') this.counter(o);
    }
    this.glassMesh(glass);
  }
  /** the trader's serving hatch: a plank counter on brackets under it, a shingle awning over it on two raked struts */
  private counter(o: Opening) {
    const { W } = this.spec;
    const x0 = W / 2 - LOG_R, ww = o.a1 - o.a0 + 0.3, ac = (o.a0 + o.a1) / 2, cd = 0.55;
    this.box('deck', cd, 0.06, ww, x0 + cd / 2, o.y0 - 0.03, ac, 1.3);
    for (const z of [o.a0 + 0.05, o.a1 - 0.05]) {
      this.box('beam', cd - 0.1, 0.08, 0.06, x0 + (cd - 0.1) / 2, o.y0 - 0.1, z, 1);
      this.box('beam', 0.06, 0.4, 0.06, x0 + 0.08, o.y0 - 0.3, z, 1);
    }
    this.solid(x0 + cd / 2, ac, cd / 2, ww / 2, o.y0 - 0.4, o.y0, 0, 'wood');
    const ad = 1.1, lean = 0.42, ay = o.y1 + 0.18;
    const sheet = boxUV(new THREE.BoxGeometry(ad, SHEET, ww + 0.3), 1.5, this.rng.next(), 0);
    const pos = sheet.getAttribute('position'), moss = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) moss[i] = clamp01(0.3 + pos.getX(i) / ad);
    sheet.setAttribute('moss', new THREE.BufferAttribute(moss, 1));
    this.m.makeRotationZ(-lean).setPosition(x0 + ad / 2 * Math.cos(lean), ay - (ad / 2) * Math.sin(lean), ac);
    this.add('roof', sheet, this.m);
    for (const z of [o.a0 - 0.05, o.a1 + 0.05]) {
      const len = 0.8;
      this.m.makeRotationZ(0.75).setPosition(x0 + 0.28, ay - 0.42, z);
      this.add('beam', boxUV(new THREE.BoxGeometry(0.06, len, 0.06), 1), this.m);
    }
  }
  private glassMesh(glass: THREE.BufferGeometry[]) {
    if (glass.length === 0) return;
    if (this.sink) { for (const g of glass) this.sink.glass.push(g.applyMatrix4(this.toSink)); return; }
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
    this.solid(cx, bz - side * 0.1, 0.95, 0.45, PLINTH, FLOOR + 0.08, 0, 'stone');   // PHYSICS P3
    this.box('stone', 1.7, 0.1, 0.7, cx, PLINTH + 1.55, bz, 2.0);              // mantel
    this.box('iron', 0.8, 0.7, 0.32, cx, FLOOR + 0.4, bz - side * 0.15, 1);    // firebox
    for (let i = 0; i < 3; i++) this.box('char', 0.45, 0.08, 0.08, cx + this.rng.range(-0.15, 0.15), FLOOR + 0.12 + i * 0.05, bz - side * (0.42 + i * 0.03), 1, this.rng.range(-0.4, 0.4));
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.6), this.mats.glow);
    glow.position.set(cx, FLOOR + 0.35, bz - side * 0.5); glow.rotation.y = side > 0 ? Math.PI : 0;
    this.root.add(glow); this.detail.push(glow);
    this.pointLight(this.root, 0xffa050, 14, 10, 2, cx, FLOOR + 0.6, bz - side * 0.7, this.index * 3.1, 'fire', 3);
    // room light so the windows glow at dusk
    this.pointLight(this.root, 0xffb070, 16, 11, 2, 0.2, FLOOR + 1.9, 0, this.index * 1.7 + 0.5, 'lamp', 2);
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
    // PHYSICS P3: the deck as a block down into the pad, from the wall line (closing the 5 cm to the floor's edge) out
    this.solid((W / 2 + x0 + D) / 2, 0, (x0 + D - W / 2) / 2, len / 2, -0.4, FLOOR, 0, 'wood');
    // step in front of the door
    const dz = this.spec.doorZ, sw = 1.4;
    this.box('deck', 0.36, 0.05, sw, x0 + D + 0.18, FLOOR - 0.12, dz, 1.3);
    this.box('beam', 0.36, 0.07, sw, x0 + D + 0.18, FLOOR - 0.18, dz, 1.0);
    this.box('stone', 0.5, 0.1, sw + 0.2, x0 + D + 0.55, 0.05, dz, 2);
    // PHYSICS P3: the step (a 0.36 m tread, 0.1 m below the deck) and its stone (0.1 m): rises 0.1 / 0.03 / 0.1
    this.solid(x0 + D + 0.18, dz, 0.18, sw / 2, -0.4, FLOOR - 0.095, 0, 'wood');
    this.solid(x0 + D + 0.55, dz, 0.25, sw / 2 + 0.1, -0.4, 0.1, 0, 'stone');
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
    this.solid(sx, sz, 0.7, 0.14, FLOOR + 1.12, FLOOR + 1.77, 0, 'wood');   // PHYSICS P3: both shelves + brackets
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
    this.solid(x, z, 0.21, 0.21, FLOOR, FLOOR + 0.87, yaw, 'wood');   // PHYSICS P3: seat, legs and back
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
    const casters = this.casters;
    if (casters !== null) {
      // desktop: its depth goes into the building's double-sided near proxy (addNearProxies), in the root's frame
      pit.updateMatrixWorld(true);
      const toRoot = this.root.matrixWorld.clone().invert(), m = new THREE.Matrix4();
      pit.traverse((mesh) => {
        if (!isMesh(mesh)) return;
        mesh.castShadow = false;
        casters.double.push(twoSidedPositions(mesh.geometry, m.multiplyMatrices(toRoot, mesh.matrixWorld)));
      });
    }
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
    this.pointLight(this.root, 0xff9a3c, 28, 22, 2, fx, 0.9, fz, 7.7, 'fire', 0);
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
        const glassMat = new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: new THREE.Color(1.0, 0.72, 0.4), emissiveIntensity: 3.0, roughness: 0.2, metalness: 0, transparent: true, opacity: 0.85 });
        mesh.material = glassMat;
        this.sky.setupMaterial(glassMat); // lit like everything else: one shared program instead of its own non-CSM one
        this.owner._lamp(glassMat, 3.0);
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
    this.pointLight(pivot, 0xffb060, 9, 11, 2, 0, -0.3, 0, 2.2 + this.index, 'lamp', 1);
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
    if (D === 0) {
      // no porch: a barrel at the front corner, a crate beside it, the rain barrel under the back eave
      this.placeProp('barrel', x0 + 0.45, 0, far * (L / 2 - 0.4), this.rng.range(0, 6));
      this.placeProp('crate', x0 + 0.4, 0, far * (L / 2 - 1.3), Math.PI / 2 + this.rng.range(-0.15, 0.15), 0.9);
      if (!this.spec.wing) this.placeProp('barrel', -(this.spec.W / 2) - 0.5, 0, -far * (L / 2 - 0.4), this.rng.range(0, 6));
      return;
    }
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

  // ── the hamlet's other interiors (PH-B3): the lodge's hall, a store of crates, the mill's stones ──
  private furnish(kind: 'hall' | 'store' | 'mill') {
    const { W, L } = this.spec;
    const chimSide = this.spec.chimney === 'zpos' ? 1 : -1;
    const inX = W / 2 - LOG_R - 0.12, inZ = L / 2 - LOG_R - 0.12;   // the walls' inside faces, a hand's width off
    if (kind === 'hall') {
      // a long trestle table down the hall with a bench each side, a sideboard + shelves on the back wall, hides hung up
      const tl = Math.min(L - 4.4, 5.6), tx = -0.35, tz = -chimSide * 0.7;
      this.box('beam', 0.95, 0.07, tl, tx, FLOOR + 0.76, tz, 1);
      for (const dz of [-tl / 2 + 0.45, tl / 2 - 0.45]) {
        this.box('beam', 0.72, 0.7, 0.08, tx, FLOOR + 0.37, tz + dz, 1);
        this.box('beam', 0.85, 0.08, 0.14, tx, FLOOR + 0.04, tz + dz, 1);
      }
      this.box('beam', 0.1, 0.1, tl - 1.0, tx, FLOOR + 0.3, tz, 1);
      this.collider(tx, tz, 0.5, tl / 2, 0, FLOOR + 0.8);
      for (const s of [-1, 1]) {
        const bx = tx + s * 0.78;
        this.box('deck', 0.3, 0.05, tl - 0.4, bx, FLOOR + 0.45, tz, 1.3);
        for (const dz of [-tl / 2 + 0.6, 0, tl / 2 - 0.6]) this.box('beam', 0.24, 0.43, 0.07, bx, FLOOR + 0.215, tz + dz, 1);
        this.collider(bx, tz, 0.16, (tl - 0.4) / 2, 0, FLOOR + 0.48);
      }
      const sz = chimSide * (inZ - 1.6);
      this.box('beam', 0.5, 0.9, 2.2, -inX + 0.25, FLOOR + 0.45, sz, 1);
      this.box('deck', 0.56, 0.05, 2.3, -inX + 0.28, FLOOR + 0.92, sz, 1.3);
      this.solid(-inX + 0.28, sz, 0.28, 1.15, FLOOR, FLOOR + 0.95, 0, 'wood');
      for (const y of [1.45, 1.9]) this.box('beam', 0.3, 0.035, 2.0, -inX + 0.15, FLOOR + y, -sz, 1);
      this.solid(-inX + 0.15, -sz, 0.15, 1.0, FLOOR + 1.3, FLOOR + 1.95, 0, 'wood');
      this.placeProp('bucket', -inX + 0.3, FLOOR + 0.945, sz + 0.6, this.rng.range(0, 6), 0.8);
      this.placeProp('bucket', -inX + 0.15, FLOOR + 1.47, -sz - 0.5, this.rng.range(0, 6), 0.7);
      for (const z of [-sz + 0.6, -sz - 0.6]) this.hide(-inX + 0.06, FLOOR + 2.35, z, Math.PI / 2);
      this.placeProp('barrel', inX - 0.45, FLOOR, -chimSide * (inZ - 0.45), this.rng.range(0, 6));
      this.placeProp('barrel', inX - 0.45, FLOOR, -chimSide * (inZ - 1.25), this.rng.range(0, 6), 0.9);
      this.placeProp('crate', -inX + 0.4, FLOOR, -chimSide * (inZ - 0.5), this.rng.range(-0.2, 0.2), 0.9);
      for (const s of [-1, 1]) this.chair(tx + this.rng.range(-0.1, 0.1), tz + s * (tl / 2 + 0.45), (s > 0 ? Math.PI : 0) + this.rng.range(-0.2, 0.2));
      return;
    }
    if (kind === 'store') {
      // crates stacked two high along the back wall, barrels in the corners, a shelf over the door side
      for (let i = 0; i < 3; i++) {
        const z = -inZ + 0.7 + i * 0.95;
        if (z > inZ - 0.5) break;
        this.placeProp('crate', -inX + 0.35, FLOOR, z, Math.PI / 2 + this.rng.range(-0.15, 0.15), 0.95);
        if (i !== 1) this.placeProp('crate', -inX + 0.35, FLOOR + 0.43, z + this.rng.range(-0.05, 0.05), Math.PI / 2 + this.rng.range(-0.2, 0.2), 0.85);
      }
      this.placeProp('barrel', inX - 0.45, FLOOR, inZ - 0.45, this.rng.range(0, 6), 0.9);
      this.placeProp('barrel', 0.1, FLOOR, inZ - 0.45, this.rng.range(0, 6), 0.9);
      this.box('beam', 1.3, 0.035, 0.3, 0.2, FLOOR + 1.6, -inZ + 0.15, 1);
      this.solid(0.2, -inZ + 0.15, 0.65, 0.15, FLOOR + 1.5, FLOOR + 1.64, 0, 'wood');
      return;
    }
    // the mill: a pair of millstones on a timber hurst with the hopper over them, the shaft in from the wheel, flour sacks
    const mx = 0.7, mz = -chimSide * 1.3;
    this.box('beam', 1.7, 0.5, 1.7, mx, FLOOR + 0.25, mz, 1);
    for (const [y, h] of [[FLOOR + 0.62, 0.24], [FLOOR + 0.87, 0.22]] as const) {
      const g = boxUV(new THREE.CylinderGeometry(0.66, 0.68, h, 20), 1.6, this.rng.next(), this.rng.next());
      this.m.makeTranslation(mx, y, mz); this.add('stone', g, this.m);
    }
    const hop = new THREE.CylinderGeometry(0.5, 0.12, 0.6, 4, 1, true).rotateY(Math.PI / 4);
    boxUV(hop, 1);
    this.m.makeTranslation(mx, FLOOR + 1.55, mz); this.add('beam', hop, this.m);
    for (const s of [-1, 1]) this.box('beam', 0.07, 0.75, 0.07, mx + s * 0.42, FLOOR + 1.35, mz, 1);
    this.solid(mx, mz, 0.85, 0.85, FLOOR, FLOOR + 1.0, 0, 'wood');
    // the drive shaft from the wing's doorway line to the stones (under the floor's joists would hide it: run it low)
    this.log(W / 2 - 0.3, -W / 4 + mx / 2, FLOOR + 0.25, mz, false, 0.09, 'bark');
    for (let i = 0; i < 5; i++) this.cloth(0.42, 0.55, 0.3, inX - 0.4 - (i % 3) * 0.45, FLOOR + 0.275 + (i > 2 ? 0.5 : 0), chimSide * (inZ - 0.4), 0xd8ceb4, this.rng.range(-0.3, 0.3));
    this.solid(inX - 0.85, chimSide * (inZ - 0.4), 0.7, 0.2, FLOOR, FLOOR + 1.0, 0, 'wood');
    this.placeProp('barrel', -inX + 0.45, FLOOR, chimSide * (inZ - 0.45), this.rng.range(0, 6), 0.85);
  }

  /** a log from `a` to `b` (building-local, or the sub-frame's) */
  private logBetween(a: THREE.Vector3, b: THREE.Vector3, r: number, key: MatKey = 'bark') {
    const d = new THREE.Vector3().subVectors(b, a), len = d.length();
    const { side, caps } = logGeo(len, r, this.rng.int(0, BOARDS - 1), this.rng.range(0, 2), 10, key === 'bark');
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), d.normalize());
    const m = new THREE.Matrix4().makeRotationFromQuaternion(q).setPosition(a.clone().lerp(b, 0.5));
    this.add(key, side, m.clone());
    this.add('endGrain', caps, m);
  }

  // ── the watermill's wheel wing: a log room on stilts off the back wall, out over the bank, the wheel beside its far end ──
  private wing(w: NonNullable<CabinSpec['wing']>) {
    const { W } = this.spec;
    // the doorway through the back wall into the wing
    const xW = -(W / 2 - LOG_R);
    for (const z of [-0.5, 0.5]) this.box('beam', 0.34, 2.0, 0.1, xW, FLOOR + 1.0, z, 1);
    this.box('beam', 0.34, 0.12, 1.1, xW, FLOOR + 2.06, 0, 1);
    const hz = w.L / 2;
    // wing frame: its local +Z runs out along the building's −X (over the bank), its local +X along the building's +Z
    this.withFrame({ x: -(W / 2) - hz, y: 0, z: 0, yaw: -Math.PI / 2 }, () => {
      this.floorPlanks(w.W, w.L, 0, 0);
      for (const s of [-1, 1]) this.box('beam', 0.22, 0.24, w.L, s * (w.W / 2 - 0.11), PLINTH - 0.12, 0, 1);
      this.box('beam', w.W, 0.24, 0.22, 0, PLINTH - 0.12, hz - 0.11, 1);
      const win: Opening = { a0: -0.4, a1: 0.4, y0: FLOOR + 1.0, y1: FLOOR + 1.7 };
      const sideWin: Opening = { a0: hz - 3.6, a1: hz - 2.8, y0: FLOOR + 1.0, y1: FLOOR + 1.7 };
      this.logBox(w.W, w.L, 0, 0, w.rows, w.pitch, {
        gables: { zpos: true, zneg: false }, skip: ['zneg'],
        ext: { front: { from: -hz + 0.02, overhangFrom: false }, back: { from: -hz + 0.02, overhangFrom: false } },
        openings: { zpos: [roughOpening(win, true)], back: [roughOpening(sideWin, false)] },
      });
      this.roof(w.W, w.L, 0, 0, w.pitch, PLINTH + w.rows * LOG, 0.35, 0.35, 0.45, -0.08);
      const glass: THREE.BufferGeometry[] = [];
      this.windowFrame(win, false, hz - LOG_R, glass);
      this.windowFrame(sideWin, true, -(w.W / 2 - LOG_R), glass);
      this.glassMesh(glass);
      // stilts: log posts from the bank up to the sill beams, every ~2.4 m down both sides, X-braced between
      const n = Math.max(2, Math.round((w.L - 0.6) / 2.4));
      const feet: { x: number; z: number; g: number }[][] = [[], []];
      for (let i = 0; i <= n; i++) {
        const z = -hz + 0.35 + (w.L - 0.7) * (i / n);
        [-1, 1].forEach((s, k) => {
          const x = s * (w.W / 2 - 0.12);
          const wp = this.worldPos(x, 0, z);
          const g = heightAt(wp.x, wp.z) - this.cy - 0.3;   // the posts sink 0.3 m into the bank
          if (PLINTH - 0.24 - g < 0.25) return;
          this.logBetween(new THREE.Vector3(x, g, z), new THREE.Vector3(x, PLINTH - 0.2, z), 0.13);
          this.collider(x, z, 0.14, 0.14, g, PLINTH - 0.24);
          feet[k]?.push({ x, z, g });
        });
      }
      for (const side of feet) for (let i = 0; i + 1 < side.length; i++) {
        const a = side[i], b = side[i + 1];
        if (!a || !b) continue;
        const lo = Math.max(a.g, b.g) + 0.6, hi = PLINTH - 0.35;
        if (hi - lo < 0.8) continue;
        this.logBetween(new THREE.Vector3(a.x, lo, a.z), new THREE.Vector3(b.x, hi, b.z), 0.07);
        this.logBetween(new THREE.Vector3(a.x, hi, a.z), new THREE.Vector3(b.x, lo, b.z), 0.07);
      }
      // the wheel past the wing's far gable, out over the creek (its axle runs on along the wing's line, so the wheel turns
      // in the plane of the flow), carried by a bearing beam across the last pair of stilts and an outer post in the bed
      const half = 0.55, wz = hz + 0.3 + half;
      const outZ = wz + half + 0.5, inZ = hz - 0.35;
      const wpOut = this.worldPos(0, 0, outZ);
      const gOut = heightAt(wpOut.x, wpOut.z) - this.cy - 0.3;
      this.logBetween(new THREE.Vector3(0, gOut, outZ), new THREE.Vector3(0, w.axleY + 0.25, outZ), 0.16);
      this.box('beam', 0.7, 0.22, 0.3, 0, w.axleY + 0.3, outZ, 1);
      this.box('beam', w.W - 0.1, 0.24, 0.24, 0, w.axleY + 0.3, inZ, 1);
      this.collider(0, outZ, 0.18, 0.18, gOut, w.axleY + 0.4);
      this.solid(0, wz, w.r, half + 0.05, w.axleY - w.r, w.axleY + w.r, 0, 'wood');
      const [bx, bz] = this.fr(0, wz);
      const pivot = new THREE.Group();
      pivot.position.set(bx, w.axleY, bz);
      pivot.rotation.y = this.frYaw - Math.PI / 2;   // the wheel's own axle (local X) along the wing (its local +Z)
      const wheel = new THREE.Mesh(this.wheelGeo(w.r, half, wz - inZ + 0.2, outZ - wz + 0.2), this.mats.beam);
      wheel.castShadow = true; wheel.receiveShadow = true;
      pivot.add(wheel);
      this.root.add(pivot);
      this.owner._wheel(wheel);
    });
  }

  /** an undershot wheel about local X: hub, axle (`inner` m into the wall side, `outer` m out to the bearing), two rims, spokes, 20 paddles */
  private wheelGeo(r: number, half: number, inner: number, outer: number) {
    const g: THREE.BufferGeometry[] = [];
    const push = (geo: THREE.BufferGeometry, m: THREE.Matrix4) => { g.push(boxUV(geo, 1, this.rng.next(), this.rng.next()).applyMatrix4(m).toNonIndexed()); };
    const m = new THREE.Matrix4();
    push(new THREE.CylinderGeometry(0.34, 0.34, half * 2 + 0.3, 12).rotateZ(Math.PI / 2), m.identity());
    const axle = new THREE.CylinderGeometry(0.13, 0.13, inner + outer, 10).rotateZ(Math.PI / 2);
    push(axle, m.makeTranslation((outer - inner) / 2, 0, 0));
    const seg = 20, chord = 2 * r * Math.sin(Math.PI / seg) + 0.04;
    for (const x of [-half + 0.06, half - 0.06]) {
      for (let i = 0; i < seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        m.makeRotationX(a).setPosition(x, Math.cos(a) * (r - 0.12), Math.sin(a) * (r - 0.12));
        push(new THREE.BoxGeometry(0.1, 0.2, chord), m);
      }
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.2;
        const len = r - 0.4;
        m.makeRotationX(a).setPosition(x, Math.cos(a) * (0.3 + len / 2), Math.sin(a) * (0.3 + len / 2));
        push(new THREE.BoxGeometry(0.09, len, 0.13), m);
      }
    }
    for (let i = 0; i < seg; i++) {
      const a = ((i + 0.5) / seg) * Math.PI * 2;
      m.makeRotationX(a).setPosition(0, Math.cos(a) * (r - 0.3), Math.sin(a) * (r - 0.3));
      push(new THREE.BoxGeometry(half * 2 - 0.1, 0.6, 0.05), m);
    }
    const merged = mergeGeometries(g);
    merged.computeBoundingSphere();
    return merged;
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
    if (this.sink) return; // a cluster member: Cabins merges the whole cluster once (finishParts on the sink)
    this.core = finishParts(this.parts, this.mats, this.root, this.detail, this.far, this.casters === null ? undefined : { front: this.casters.front, swap: this.swap });
  }

  /**
   * Desktop: the building's near shadow proxy from `casters` (after `build`, and after Cabins baked its props into
   * `casters.double`), hidden with the detail LOD — it stands in for the core + far proxies (`swap`), the iron / cloth /
   * char / chink meshes, the fire pit and the props: the same triangles, the same depth, one shadow draw per cascade.
   * A cluster member has only its fire pit here (the cluster's merged hardware and props cast no shadow).
   */
  addNearProxies(): void {
    const c = this.casters;
    if (c === null) return;
    // one proxy: mergeGeometries takes all-indexed or none, so with glTF casters the flat sets get a plain index
    const proxy = shadowProxy(c.double.length === 0 ? c.front : [...c.front.map(sequentialIndex), ...c.double]);
    if (proxy !== null) { this.root.add(proxy); this.detail.push(proxy); }
    c.front.length = 0; c.double.length = 0;
  }
}

/**
 * Merge a builder's (or a cluster's) parts per material under `root`: one mesh per material, the small hardware in
 * `detail`, the mid parts in `far`, and the static shadow casters as two position-only proxies.
 *
 * `near` (a cabin on desktop): every set's positions also go to `near.front` for the builder's one near proxy
 * (CabinBuilder.addNearProxies); the detail meshes then cast no shadow of their own, and the core + far proxies go to
 * `near.swap` — they cast only while the detail LOD is off (Cabins.update), so the depth is the same at every distance.
 */
export function finishParts(parts: Map<MatKey, THREE.BufferGeometry[]>, mats: Mats, root: THREE.Object3D, detailList: THREE.Object3D[], farList: THREE.Object3D[], near?: { front: THREE.BufferGeometry[]; swap: THREE.Object3D[] }): CoreMesh[] {
  const coreMeshes: CoreMesh[] = [];
  {
    // the static shadow casters go into the shadow map as two position-only proxies (the silhouette set, and the far
    // set that hides with the far LOD) on SHADOW_LAYER, which only the sun's shadow cameras see: 2 shadow draws per
    // cabin instead of 7, the same depth (same triangles, all front-sided materials)
    const core: THREE.BufferGeometry[] = [], farSet: THREE.BufferGeometry[] = [];
    for (const [key, list] of parts) {
      const merged = mergeOrNull(list);
      if (merged === null) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, mats[key]);
      mesh.receiveShadow = true;
      root.add(mesh);
      const pos = new THREE.BufferGeometry(); pos.setAttribute('position', merged.getAttribute('position'));
      near?.front.push(pos);
      if (DETAIL_KEYS.has(key)) { mesh.castShadow = near === undefined; detailList.push(mesh); continue; }
      if (FAR_KEYS.has(key)) { farList.push(mesh); farSet.push(pos); } else { core.push(pos); coreMeshes.push({ key, mesh }); }
    }
    for (const [list, far] of [[core, false], [farSet, true]] as const) {
      const proxy = shadowProxy(list);
      if (proxy === null) continue;
      root.add(proxy);
      if (far) farList.push(proxy);
      if (near) { proxy.castShadow = false; near.swap.push(proxy); }
    }
    parts.clear();
  }
  return coreMeshes;
}

/** one never-hidden per-material mesh of a building (finishParts' core set: log, roof, beam, deck, stone), in its root */
interface CoreMesh { key: MatKey; mesh: THREE.Mesh }

/**
 * PERF-2: the cabins' core meshes of one material merged into ONE draw (Cabins.batchCores), in the cabins' group frame.
 * Culled per cabin: it is drawn in a pass when any cabin's own mesh (`views`) would have been — never where none would.
 */
class CoreBatch extends THREE.Mesh {
  readonly views: CoreView[] = [];
  override intersectsFrustum(frustum: THREE.Frustum | THREE.FrustumArray): boolean {
    return this.views.some((v) => v.inFrustum(frustum));
  }
}

/**
 * A cabin's own core mesh of one material, still in its root (Explore isolates one cabin root; its selection box, ray
 * hits and tri count): its buffers are views (subarrays) into its batch's, no copy. It never draws while its batch is
 * shown — only when the batch is hidden (Explore's isolation hides the root's siblings, the batch among them).
 */
class CoreView extends THREE.Mesh {
  constructor(geometry: THREE.BufferGeometry, material: THREE.Material | THREE.Material[], private readonly batch: CoreBatch) {
    super(geometry, material);
  }
  /** the renderer's own test for this cabin's part (the batch's culling asks it) */
  inFrustum(frustum: THREE.Frustum | THREE.FrustumArray): boolean { return super.intersectsFrustum(frustum); }
  override intersectsFrustum(frustum: THREE.Frustum | THREE.FrustumArray): boolean { return !this.batch.visible && super.intersectsFrustum(frustum); }
}

/** vertices [start, start + count) of a non-indexed geometry: every attribute a subarray of `geo`'s (shared memory) */
function geometrySlice(geo: THREE.BufferGeometry, start: number, count: number): THREE.BufferGeometry | null {
  const out = new THREE.BufferGeometry();
  for (const [name, a] of Object.entries(geo.attributes)) {
    if (!(a instanceof THREE.BufferAttribute)) return null;
    out.setAttribute(name, new THREE.BufferAttribute(a.array.subarray(start * a.itemSize, (start + count) * a.itemSize), a.itemSize, a.normalized));
  }
  out.computeBoundingSphere(); out.computeBoundingBox();
  return out;
}

// ───────────────────────────── the chunk's cabins ─────────────────────────────

/**
 * PH-B3: a building beyond the three cabins (Pine Hollow's mill hamlet), built with the same kit. All of them form one
 * cluster: their static parts merge into one mesh per material (`Cabins.cluster`), their lights are anchors only (the
 * phone's pooled pair visits the nearest; no light of their own on any tier). `rot` is the kit's frame: the door faces
 * local +X, so a layout yaw `y` (facing (−sin y, −cos y)) is `rot = y + π/2`.
 */
export interface ExtraBuilding { id: string; x: number; z: number; rot: number; spec: CabinSpec }

export class Cabins {
  group = new THREE.Group();
  /** the merged cluster of the extra buildings (null without any) */
  cluster: THREE.Group | null = null;
  /** radians per second of every mill wheel (the miller's errand can stop it: 0) */
  wheelSpeed = 0.55;
  private wheels: THREE.Object3D[] = [];
  colliders: Collider[] = [];
  interactables: Interactable[] = [];
  firePits: { x: number; y: number; z: number }[] = [];
  private doors: Door[] = [];
  private fires: Fire[] = [];
  private swings: Swing[] = [];
  private particleMats = new Set<THREE.ShaderMaterial>();
  private floors: Floor[] = [];
  /** PHYSICS P3: static boxes that are only in colliderDescs() (floors, porch, step, plinth, furniture, props) */
  private solids: ColliderDesc[] = [];
  private lods: CabinLod[] = [];
  /**
   * the three cabins' props: ONE InstancedMesh per prop part across the cabins (was one per cabin), holding only the
   * instances of the cabins within cabinDetailDist (refreshProps, when one crosses it) — the same props drawn as before,
   * a draw per part instead of one per part per cabin. Their shadow is the cabins' double-sided near proxies (desktop).
   */
  private sharedProps: { im: THREE.InstancedMesh; lists: { lod: CabinLod; matrices: THREE.Matrix4[] }[] }[] = [];
  /** phone tier: the one shared set of point lights, taken from the scene's LightPool at boot (a constant NUM_POINT_LIGHTS
   *  keeps every shader from recompiling); they follow the nearest cabin's top-ranked anchors */
  private sharedLights: THREE.PointLight[] = [];
  /** emissive materials lit by the clock (window glass, lantern glass) and their full-night intensity (PH-L3) */
  private lampMats: { mat: THREE.MeshStandardMaterial; full: number }[] = [];
  private nearestCabin = -1;
  /** the eye is inside the nearest building (or at its door): its room lamp + hearth take the pooled pair */
  private indoors = false;
  /** the nearest building's anchors in the order the pooled pair takes them */
  private order: LightAnchor[] = [];
  private tmpL = new THREE.Vector3();
  private cabinCount = 0;
  private tmpV = new THREE.Vector3();

  constructor(private sky: Sky, private extra: readonly ExtraBuilding[] = []) {}

  async build(): Promise<{ group: THREE.Group; colliders: Collider[]; interactables: Interactable[] }> {
    // the seven PBR sets and the six models in one round of fetches (they were two, back to back)
    const [mats, [firePitGltf, lanternGltf, crate, barrel, bucket, hatchet]] = await Promise.all([cabinMats(this.sky), Promise.all([
      loadGLTF('stone_fire_pit'), loadLod('Lantern_01'), loadGLTF('wooden_crate_02'), loadGLTF('wine_barrel_01'), loadGLTF('wooden_bucket_01'), loadGLTF('hatchet'),
    ])]);
    // each model's parts share one material: merged into one part, a cabin's crates / barrels / buckets are one draw each (9 → 4)
    const props = { crate: mergeParts(prepModel(crate.scene, this.sky)), barrel: mergeParts(prepModel(barrel.scene, this.sky)), bucket: mergeParts(prepModel(bucket.scene, this.sky)), hatchet: mergeParts(prepModel(hatchet.scene, this.sky)) };
    this._lamp(mats.glass, mats.glass.emissiveIntensity);
    // the phone's shared cabin lights (PH-L3): TWO pooled lights, not one per anchor — every point light is per-fragment
    // cost on every lit surface, grass included; the nearest cabin's fire pit and porch lantern (else its room / hearth)
    if (TIER_CONFIG.sharedCabinLights) for (let k = 0; k < SHARED_CABIN_LIGHTS; k++) this.sharedLights.push(LightPool.for(this.sky.sceneRoot).acquire(0xffa050, 0, 10, 2));
    const cabinProps: { lod: CabinLod; inst: Record<PropKind, THREE.Matrix4[]> }[] = [];
    const cores: { root: THREE.Object3D; core: CoreMesh[] }[] = [];
    for (const [i, site] of CABIN_SITES.entries()) {
      if (i > 0) await macrotask(); // one cabin per task: the whole homestead in one go was a 180 ms long task at 4x CPU
      const spec = SPECS[i];
      if (spec === undefined) throw new Error(`Cabins: no spec for site ${i}`);
      const y = heightAt(site.x, site.z);
      // per-cabin prop instances: a cabin's crates / barrels / buckets / hatchet show only within cabinDetailDist (with
      // the rest of its hardware), drawn by the shared per-part instanced meshes (sharedProps)
      const propInstances: Record<PropKind, THREE.Matrix4[]> = { crate: [], barrel: [], bucket: [], hatchet: [] };
      const b = new CabinBuilder(this, spec, i, site.x, y, site.z, site.rot, mats, this.sky, propInstances);
      b.build(firePitGltf.scene, lanternGltf.scene);
      this.group.add(b.root);
      if (b.casters !== null) {
        // desktop: the props' depth goes into this cabin's double-sided near proxy (they cast no shadow of their own)
        const toRoot = b.root.matrixWorld.clone().invert(), m = new THREE.Matrix4();
        for (const k of PROP_KINDS) for (const part of props[k]) for (const mat of propInstances[k]) b.casters.double.push(twoSidedPositions(part.geometry, m.multiplyMatrices(toRoot, mat).multiply(part.matrix)));
      }
      b.addNearProxies();
      if (!TIER_CONFIG.cabinDetailShadows) for (const o of b.detail) o.traverse((c) => { c.castShadow = false; });
      const lod: CabinLod = { root: b.root, detail: b.detail, far: b.far, anchors: b.anchors, detailOn: true, farOn: false, pad: 0, rooms: b.rooms, door: b.doorAt, swap: b.swap };
      this.lods.push(lod);
      cabinProps.push({ lod, inst: propInstances });
      cores.push({ root: b.root, core: b.core });
    }
    this.cabinCount = this.lods.length;
    for (const k of PROP_KINDS) for (const part of props[k]) {
      const lists = cabinProps.map(({ lod, inst }) => ({ lod, matrices: inst[k].map((mat) => mat.clone().multiply(part.matrix)) })).filter((l) => l.matrices.length > 0);
      const total = lists.reduce((n, l) => n + l.matrices.length, 0);
      if (total === 0) continue;
      const im = new THREE.InstancedMesh(part.geometry, part.material, total);
      im.castShadow = false; im.receiveShadow = true;   // desktop: the near proxies cast for them; the phone: no prop shadow
      this.group.add(im);
      this.sharedProps.push({ im, lists });
    }
    this.refreshProps();
    await macrotask();
    this.batchCores(cores);
    if (this.extra.length > 0) await this.buildCluster(mats, props, firePitGltf.scene, lanternGltf.scene);
    return { group: this.group, colliders: this.colliders, interactables: this.interactables };
  }

  /**
   * PERF-2: the cabins' never-hidden per-material meshes (log, roof, beam, deck, stone — no LOD on any tier) merged across
   * the cabins into one CoreBatch per material: 1 draw instead of 1 per cabin in view. The same triangles and attributes,
   * baked into the group's frame (the hamlet cluster's way). Each cabin keeps a CoreView of its part in its root (never
   * drawn beside the batch); its shadow proxies (per cabin, by distance) are untouched.
   */
  private batchCores(cabins: { root: THREE.Object3D; core: CoreMesh[] }[]): void {
    const byKey = new Map<MatKey, { root: THREE.Object3D; mesh: THREE.Mesh }[]>();
    for (const { root, core } of cabins) for (const { key, mesh } of core) {
      const list = byKey.get(key);
      if (list === undefined) byKey.set(key, [{ root, mesh }]); else list.push({ root, mesh });
    }
    for (const list of byKey.values()) {
      const first = list[0];
      if (list.length < 2 || first === undefined) continue;
      const merged = mergeOrNull(list.map(({ root, mesh }) => mesh.geometry.clone().applyMatrix4(root.matrix)));   // root → group frame
      if (merged === null) continue;
      merged.computeBoundingSphere();
      const batch = new CoreBatch(merged, first.mesh.material);
      batch.receiveShadow = true;
      const views: { root: THREE.Object3D; mesh: THREE.Mesh; view: CoreView }[] = [];
      let start = 0;
      for (const { root, mesh } of list) {
        const n = mesh.geometry.getAttribute('position').count;
        const g = geometrySlice(merged, start, n);
        start += n;
        if (g === null) break;
        const view = new CoreView(g, mesh.material, batch);
        view.receiveShadow = true;
        view.matrixAutoUpdate = false;
        view.matrix.copy(root.matrix).invert();   // its buffers are in the group's frame: undo the root's placement
        view.matrixWorldNeedsUpdate = true;
        views.push({ root, mesh, view });
      }
      if (views.length !== list.length) continue;   // never half a batch: the cabins keep their own meshes
      for (const { root, mesh, view } of views) { root.remove(mesh); root.add(view); batch.views.push(view); }
      this.group.add(batch);
    }
  }

  /** the extra buildings as one merged cluster (PH-B3): per building only its doors, lantern, smoke and wheel draw alone */
  private async buildCluster(mats: Mats, props: Record<PropKind, PropPart[]>, firePit: THREE.Object3D, lantern: THREE.Object3D): Promise<void> {
    let sx = 0, sz = 0;
    for (const e of this.extra) { sx += e.x; sz += e.z; }
    const cx = sx / this.extra.length, cz = sz / this.extra.length;
    const root = new THREE.Group();
    root.name = 'cabin-cluster';
    root.position.set(cx, heightAt(cx, cz), cz);
    root.updateMatrixWorld(true);
    const sink: ClusterSink = { root, parts: new Map(), glass: [] };
    const propInstances: Record<PropKind, THREE.Matrix4[]> = { crate: [], barrel: [], bucket: [], hatchet: [] };
    let pad = 0;
    for (const [j, e] of this.extra.entries()) {
      await macrotask(); // one building per task, as the cabins
      const b = new CabinBuilder(this, e.spec, this.cabinCount + j, e.x, heightAt(e.x, e.z), e.z, e.rot, mats, this.sky, propInstances, sink);
      b.root.name = e.id;
      b.build(firePit, lantern);
      this.group.add(b.root);
      b.addNearProxies();
      if (!TIER_CONFIG.cabinDetailShadows) for (const o of b.detail) o.traverse((c) => { c.castShadow = false; });
      this.lods.push({ root: b.root, detail: b.detail, far: b.far, anchors: b.anchors, detailOn: true, farOn: false, pad: 0, rooms: b.rooms, door: b.doorAt, swap: b.swap });
      pad = Math.max(pad, Math.hypot(e.x - cx, e.z - cz) + Math.max(e.spec.W, e.spec.L));
    }
    await macrotask();
    const detail: THREE.Object3D[] = [], far: THREE.Object3D[] = [];
    finishParts(sink.parts, mats, root, detail, far);
    if (sink.glass.length > 0) {
      const gm = new THREE.Mesh(mergeGeometries(sink.glass), mats.glass);
      gm.receiveShadow = true; gm.renderOrder = 2;
      root.add(gm); detail.push(gm);
    }
    for (const k of Object.keys(propInstances) as PropKind[]) {
      const list = propInstances[k];
      if (list.length === 0) continue;
      for (const m of props[k]) {
        const im = new THREE.InstancedMesh(m.geometry, m.material, list.length);
        im.castShadow = true; im.receiveShadow = true;
        const tmp = new THREE.Matrix4();
        list.forEach((mat, i) => { im.setMatrixAt(i, tmp.copy(mat).multiply(m.matrix)); });
        im.instanceMatrix.needsUpdate = true;
        im.computeBoundingSphere();
        this.group.add(im);
        detail.push(im);
      }
    }
    // the cluster's small merged hardware (iron, cloth, char, the chinking behind the logs, glass, the crates and barrels)
    // casts no shadow on any tier: a cluster spans a pad, so its casters land in every cascade for a few pixels of shadow
    for (const o of detail) o.traverse((c) => { c.castShadow = false; });
    this.group.add(root);
    this.cluster = root;
    this.lods.push({ root, detail, far, anchors: [], detailOn: true, farOn: false, pad });
  }

  /** each cabin's own root, in CABIN_SITES order (Explore's catalog shows one at a time) — not the cluster's buildings */
  get roots(): readonly THREE.Object3D[] { return this.lods.slice(0, this.cabinCount).map((l) => l.root); }

  /**
   * PHYSICS P3: every cabin's static collision in world space — the legacy boxes (walls, chimney, porch posts and rails,
   * bed, table, woodpiles, fire pit, benches) minus the door boxes, plus the floors / porch decks / porch steps whose tops
   * are `floorHeightAt`, the stone plinths, and the furniture drawn without a legacy box (chairs, shelves, hearth, the
   * crates / barrels / buckets). src/physics/pieces.ts turns it into Rapier colliders.
   */
  colliderDescs(): ColliderDesc[] {
    const doorBoxes = new Set(this.doors.map((d) => d.collider));
    return [...this.colliders.filter((c) => !doorBoxes.has(c)).map((c) => boxDesc(c)), ...this.solids];
  }

  /**
   * PHYSICS P3: one piece per door — the leaf as a box in its pivot's local frame (the pivot turns about +Y as the door
   * swings inward), for a kinematic body that follows the pivot. `swinging()` is true from the moment the door is
   * toggled until it is fully shut or fully open (`active: () => !swinging()` lets the player through mid-swing).
   */
  doorPieces(): { id: string; pivot: THREE.Object3D; colliders: ColliderDesc[]; swinging: () => boolean }[] {
    return this.doors.map((d) => ({ id: d.id, pivot: d.pivot, colliders: [d.slab], swinging: () => d.t !== (d.open ? 1 : 0) }));
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
    const dd = TIER_CONFIG.cabinDetailDist;
    let propsDirty = false;
    for (const [i, l] of this.lods.entries()) {
      const d2 = l.root.position.distanceToSquared(this.tmpV);
      if (l.anchors.length > 0 && d2 < nearestD2 && (l.lit?.() ?? true)) { nearestD2 = d2; nearest = i; }
      const d = Math.sqrt(d2) - l.pad;
      const on = d < dd;
      if (on !== l.detailOn) {
        l.detailOn = on; propsDirty = true;
        for (const o of l.detail) o.visible = on;
        if (l.swap) for (const o of l.swap) o.castShadow = !on;
      }
      // past 2× the detail distance only the silhouette parts stay (log walls, roof, stone, deck, beams, smoke)
      const far = d > dd * 2;
      if (far !== l.farOn) { l.farOn = far; for (const o of l.far) o.visible = !far; }
    }
    if (propsDirty) this.refreshProps();
    for (const w of this.wheels) w.rotation.x += dt * this.wheelSpeed;
    const l = this.lods[nearest];
    if (this.sharedLights.length > 0 && nearest >= 0 && l !== undefined) {
      // indoors (the eye over one of its rooms' floors, or within 3 m of its door) the room light and the hearth take the
      // pair, so the room is lit at night; outdoors the fire pit and the porch lantern keep it (intensity only either way)
      let indoors = false;
      if (l.rooms && l.door) {
        const p = l.root.worldToLocal(this.tmpL.copy(this.tmpV));
        indoors = l.rooms.some((r) => Math.abs(p.x - r.x) <= r.hw && Math.abs(p.z - r.z) <= r.hd) || Math.hypot(p.x - l.door[0], p.z - l.door[1]) < 3;
      }
      if (nearest !== this.nearestCabin || indoors !== this.indoors) {
        this.nearestCabin = nearest; this.indoors = indoors;
        const indoorRank = (a: LightAnchor): number => (a.rank === 2 ? 0 : a.rank === 3 ? 1 : a.rank + 2);
        this.order = indoors ? [...l.anchors].sort((a, b) => indoorRank(a) - indoorRank(b)) : l.anchors;
        this.fires = this.fires.filter((f) => !this.sharedLights.includes(f.light));
        this.sharedLights.forEach((light, i) => {
          const a = this.order[i];
          if (!a) { light.intensity = 0; return; }
          light.color.set(a.color); light.distance = a.distance; light.decay = a.decay;
          this.fires.push({ light, base: a.intensity, seed: a.seed, kind: a.kind });
        });
      }
      this.sharedLights.forEach((light, i) => { const a = this.order[i]; if (a) a.anchor.getWorldPosition(light.position); });
    }
    for (const d of this.doors) {
      const target = d.open ? 1 : 0;
      if (d.t === target) continue;
      d.t = Math.max(0, Math.min(1, d.t + Math.sign(target - d.t) * dt / 0.6));
      const e = d.t < 0.5 ? 2 * d.t * d.t : 1 - (-2 * d.t + 2) ** 2 / 2; // ease in-out
      d.pivot.rotation.y = -e * 1.85;
    }
    // the night lights on the clock (PH-L3): by intensity only — the light count never changes. `sky.lamps` is 0 by day …
    // 1 by night (the fixed sunset keeps 1: every light as before). A fire burns all day; lanterns and rooms are lit at dusk
    const lamps = this.sky.lamps, fireK = 0.7 + 0.3 * lamps, lampK = 0.1 + 0.9 * lamps;
    for (const f of this.fires) {
      const n = Math.sin(t * 11 + f.seed) * 0.5 + Math.sin(t * 23.7 + f.seed * 2.3) * 0.3 + Math.sin(t * 3.1 + f.seed) * 0.2;
      f.light.intensity = f.base * (1 + 0.28 * n) * (f.kind === 'fire' ? fireK : lampK);
    }
    for (const m of this.lampMats) m.mat.emissiveIntensity = m.full * (0.2 + 0.8 * lamps);
    cabinNight.uLamps.value = lamps; cabinNight.uShade.value = 1 - 0.8 * this.sky.night;
    for (const sw of this.swings) { sw.pivot.rotation.z = Math.sin(t * 1.35 + sw.seed) * 0.05 + Math.sin(t * 2.9 + sw.seed * 1.7) * 0.015; sw.pivot.rotation.x = Math.cos(t * 1.1 + sw.seed) * 0.03; }
    for (const m of this.particleMats) { const u = m.uniforms['uTime']; if (u !== undefined) u.value = t; }
  }

  /** the shared prop meshes hold the instances of the cabins whose detail LOD is on (and hide when none is) */
  private refreshProps(): void {
    for (const { im, lists } of this.sharedProps) {
      let n = 0;
      for (const { lod, matrices } of lists) if (lod.detailOn) for (const m of matrices) im.setMatrixAt(n++, m);
      im.count = n; im.visible = n > 0;
      if (n === 0) continue;
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
    }
  }

  /** @internal */ _door(d: Door): void { this.doors.push(d); this.colliders.push(d.collider); this.interactables.push(d.interactable); }
  /** @internal */ _fire(f: Fire): void { this.fires.push(f); }
  /** @internal */ _lamp(mat: THREE.MeshStandardMaterial, full: number): void { this.lampMats.push({ mat, full }); }
  /** @internal */ _swing(sw: Swing): void { this.swings.push(sw); }
  /** @internal */ _particles(m: THREE.ShaderMaterial): void { this.particleMats.add(m); }
  /** @internal */ _floor(f: Floor): void { this.floors.push(f); }
  /** @internal */ _solid(d: ColliderDesc): void { this.solids.push(d); }
  /** @internal */ _wheel(o: THREE.Object3D): void { this.wheels.push(o); }

  /**
   * PH-B3: a lamp the phone's pooled pair may visit when it is the nearest lit site (a waystone lantern): `anchor` sits in
   * world space (a child of a group at the origin). No light of its own on any tier; `lit()` false keeps the pair away.
   */
  addLampSite(anchor: THREE.Object3D, color: number, intensity: number, distance: number, lit: () => boolean = () => true): void {
    const a: LightAnchor = { anchor, color, intensity, distance, decay: 2, seed: anchor.position.x * 0.37, kind: 'lamp', rank: 0 };
    this.lods.push({ root: anchor, detail: [], far: [], anchors: [a], detailOn: true, farOn: false, pad: 0, lit });
  }
}

// ───────────────────────────── glTF helpers ─────────────────────────────

const lodLoader = new GLTFLoader();
export function loadLod(id: string): Promise<{ scene: THREE.Group }> {
  return new Promise<{ scene: THREE.Group }>((resolve, reject) => { lodLoader.load(`/assets/models/${id}/${id}_lod.glb`, resolve, undefined, reject); });
}

/**
 * Collapse the parts that share a material into one part (their matrices baked into the geometry) — the same pixels, one
 * draw instead of one per glTF mesh. Parts whose attributes do not line up for a merge stay as they are.
 */
export function mergeParts(parts: PropPart[]): PropPart[] {
  const byMat = new Map<THREE.Material, PropPart[]>();
  for (const p of parts) { const l = byMat.get(p.material); if (l === undefined) byMat.set(p.material, [p]); else l.push(p); }
  const out: PropPart[] = [];
  for (const [material, list] of byMat) {
    const first = list[0];
    if (list.length === 1 && first !== undefined) { out.push(first); continue; }
    const merged = mergeOrNull(list.map((p) => p.geometry.clone().applyMatrix4(p.matrix)));
    if (merged === null) { out.push(...list); continue; }
    merged.computeBoundingSphere();
    out.push({ geometry: merged, material, matrix: new THREE.Matrix4() });
  }
  return out;
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

// E155 (src/core/shardState.ts): the running shard's cabin night
stateSlot('cabin.night', cabinNight);

/**
 * glbPaint — the generated Nalati models (image-to-3D GLBs in `public/assets/nalati/models/`, README in
 * `art/nalati-grasslands/round-5-models/`) loaded onto the shared painterly look.
 *
 *   const m = await loadNalatiModel(sky, 'yurt');                 // geometry + painterly material, cached per name
 *   group.add(instanceModel(m, [{ x, y, z, rot, scale }, …]));    // one draw call for every copy
 *   addModelInstances(group, sky, 'balbal', placements);          // the same, fire-and-forget (adds when loaded)
 *
 * Every GLB is one mesh / one base-colour atlas (metres, +Y up, pivot = centre of the base on y = 0, front +Z). The
 * loader decodes meshopt, bakes the node transform into a plain Float32 geometry (the quantised attributes are
 * de-quantised, so the geometry can be transformed / merged freely) and swaps the glTF material for
 * `painterlyMaterial({ map })` — the same cel bands, painted shade tint, rim, warm terminator, wetness and fog as
 * every other painterly mesh, plus `sky.setupMaterial` for the CSM shadows. The phone tier loads `<name>.phone.glb`
 * (the 512² atlas). `rot` in a placement is the yaw about +y (0 = the model's front faces +Z).
 *
 * `modelsOn(part)` is the adoption flag the POI builders read (`?models=0|1`, `?yurts=0|1`; see below).
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { TIER } from '../../core/tier';
import { painterlyMaterial } from '../painterly';
import type { Sky } from '../Sky';

export type NalatiModelName =
  | 'yurt' | 'horse-saddled' | 'horse-wild' | 'wolf' | 'sheep' | 'snow-leopard' | 'eagle' | 'golden-king' | 'spruce'
  | 'balbal' | 'boulder-1' | 'boulder-2' | 'boulder-3' | 'kumis-churn' | 'cauldron' | 'saddle' | 'firewood' | 'chest'
  | 'watchtower' | 'snow-lotus' | 'kokpar-rider';
/** the models that also ship a far LOD (`<name>.far.glb`: ~10 % of the triangles, vertex colours, no texture) */
export type FarModelName = 'horse-wild' | 'horse-saddled' | 'kokpar-rider';
export type ModelLod = 'near' | 'far';

export interface NalatiModel {
  name: NalatiModelName;
  geometry: THREE.BufferGeometry;
  material: THREE.MeshLambertMaterial;
  /** the model's bounding box in its own space (metres; min.y = 0) */
  box: THREE.Box3;
}

export interface ModelPlacement {
  x: number; y: number; z: number;
  /** yaw about +y (0 = front faces +Z) */
  rot?: number;
  /** uniform scale, or a per-axis one */
  scale?: number;
  sx?: number; sy?: number; sz?: number;
  /** a small lean (radians about x / z) — a tilted stone */
  pitch?: number; roll?: number;
}

export interface ModelLook {
  /** rim-light strength (default 0.35, the POI default) */
  rim?: number;
  /** cel strength (default 0.8) */
  bands?: number;
  /** wind sway (foliage), see painterly.ts */
  sway?: number;
  /** a colour multiplier on the atlas (default white) */
  color?: THREE.ColorRepresentation;
}

/**
 * The adoption flags. By default the balbals, the rocks and the camp props are the generated models; the yurts stay
 * procedural (the camp orbit, 2026-09-23: the GLB yurt's felt reads stained and its ornament soft up close, the
 * procedural yurt is cleaner). `?models=0` → every POI procedural, `?models=1` → every model on (yurts included),
 * `?yurts=1` / `?yurts=0` → the yurts alone, `?creatures=glb` / `?creatures=proc` → the rigged creature GLBs
 * (src/entities/glbCreatures.ts, on by default since 2026-09-23; `proc` = the procedural creatures) alone.
 */
export type ModelPart = 'yurt' | 'props' | 'rocks' | 'balbal' | 'creatures';
const PART_DEFAULT: Readonly<Record<ModelPart, boolean>> = { yurt: false, props: true, rocks: true, balbal: true, creatures: true };

export function modelsOn(part: ModelPart): boolean {
  if (typeof location === 'undefined') return PART_DEFAULT[part];
  const q = new URLSearchParams(location.search);
  const all = q.get('models');
  if (all === '0') return false;
  if (part === 'yurt') { const y = q.get('yurts'); if (y === '0' || y === '1') return y === '1'; }
  if (part === 'creatures') { const c = q.get('creatures'); if (c === 'glb' || c === 'proc') return c === 'glb'; }
  if (all === '1') return true;
  return PART_DEFAULT[part];
}

const DIR = '/assets/nalati/models/';
let loader: GLTFLoader | null = null;
function gltfLoader(): GLTFLoader {
  if (!loader) { loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder); }
  return loader;
}

/** a float copy of an attribute (de-quantises normalized ints) */
function floatAttr(a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute): THREE.BufferAttribute {
  const n = a.count, k = a.itemSize, out = new Float32Array(n * k);
  for (let i = 0; i < n; i++) for (let c = 0; c < k; c++) out[i * k + c] = a.getComponent(i, c);
  return new THREE.BufferAttribute(out, k);
}

const isMesh = (o: THREE.Object3D): o is THREE.Mesh => (o as Partial<THREE.Mesh>).isMesh === true;

export interface RawModel { geometry: THREE.BufferGeometry; map: THREE.Texture | null; box: THREE.Box3 }
const raw = new Map<string, Promise<RawModel>>();
const ready = new Map<string, RawModel>();

/** a model's float geometry + atlas (no material), loading it if needed — for code that builds its own mesh (creatures) */
export function loadModelRaw(name: NalatiModelName): Promise<RawModel> { return loadRaw(name, 'near'); }
/** the same, synchronously: the loaded model, or null while it is still loading (or failed) */
export function modelRawIfLoaded(name: NalatiModelName): RawModel | null { return ready.get(`${name}|near`) ?? null; }

function loadRaw(name: NalatiModelName, lod: ModelLod): Promise<RawModel> {
  const rkey = `${name}|${lod}`;
  let p = raw.get(rkey);
  if (!p) {
    const url = lod === 'far' ? `${DIR}${name}.far.glb` : `${DIR}${name}${TIER === 'phone' ? '.phone' : ''}.glb`;
    p = gltfLoader().loadAsync(url).then((gltf) => {
      gltf.scene.updateMatrixWorld(true);
      const meshes: THREE.Mesh[] = [];
      gltf.scene.traverse((o) => { if (isMesh(o)) meshes.push(o); });
      const found = meshes[0];
      if (!found) throw new Error(`nalati model ${name}: no mesh`);
      const src = found.geometry;
      const geometry = new THREE.BufferGeometry();
      for (const key of ['position', 'normal', 'uv'] as const) {
        if (src.hasAttribute(key)) geometry.setAttribute(key, floatAttr(src.getAttribute(key)));
      }
      const index = src.getIndex();
      if (index) geometry.setIndex(Array.from(index.array));
      geometry.applyMatrix4(found.matrixWorld);
      if (!geometry.hasAttribute('normal')) geometry.computeVertexNormals();
      // painterly materials always read vertex colours: the far LOD's own (its coat), else a white one (the atlas carries it)
      if (src.hasAttribute('color')) geometry.setAttribute('color', floatAttr(src.getAttribute('color')));
      else geometry.setAttribute('color', new THREE.BufferAttribute(new Uint8Array(geometry.getAttribute('position').count * 3).fill(255), 3, true));
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      const srcMat = found.material;
      const first = Array.isArray(srcMat) ? srcMat[0] : srcMat;
      const map = first instanceof THREE.MeshStandardMaterial && first.map ? first.map : null;
      if (map) { map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4; }
      const box = geometry.boundingBox?.clone() ?? new THREE.Box3();
      const out = { geometry, map, box };
      ready.set(rkey, out);
      return out;
    });
    raw.set(rkey, p);
  }
  return p;
}

const models = new WeakMap<Sky, Map<string, Promise<NalatiModel>>>();
/** one model on the painterly look (cached per sky × name × look) */
export function loadNalatiModel(sky: Sky, name: NalatiModelName, look: ModelLook = {}, lod: ModelLod = 'near'): Promise<NalatiModel> {
  let bySky = models.get(sky);
  if (!bySky) { bySky = new Map(); models.set(sky, bySky); }
  const key = `${name}|${lod}|${look.rim ?? ''}|${look.bands ?? ''}|${look.sway ?? ''}|${new THREE.Color(look.color ?? 0xffffff).getHexString()}`;
  let p = bySky.get(key);
  if (!p) {
    p = loadRaw(name, lod).then((r) => ({
      name,
      geometry: r.geometry,
      box: r.box,
      material: painterlyMaterial(sky, { map: r.map, rim: look.rim ?? 0.35, bands: look.bands ?? 0.8, sway: look.sway ?? 0, color: look.color ?? 0xffffff }),
    }));
    bySky.set(key, p);
  }
  return p;
}

const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
export function placementMatrix(p: ModelPlacement, out = new THREE.Matrix4()): THREE.Matrix4 {
  const k = p.scale ?? 1;
  _e.set(p.pitch ?? 0, p.rot ?? 0, p.roll ?? 0, 'YXZ');
  return out.compose(_p.set(p.x, p.y, p.z), _q.setFromEuler(_e), _s.set(p.sx ?? k, p.sy ?? k, p.sz ?? k));
}

/** every placement of one model as ONE InstancedMesh (one draw call), shadows on */
export function instanceModel(m: NalatiModel, placements: readonly ModelPlacement[], o: { castShadow?: boolean; receiveShadow?: boolean } = {}): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(m.geometry, m.material, Math.max(1, placements.length));
  const mat = new THREE.Matrix4();
  for (let i = 0; i < placements.length; i++) { const p = placements[i]; if (p) mesh.setMatrixAt(i, placementMatrix(p, mat)); }
  mesh.count = placements.length;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  mesh.castShadow = o.castShadow ?? true;
  mesh.receiveShadow = o.receiveShadow ?? true;
  mesh.name = `nalati-model-${m.name}`;
  return mesh;
}

/** load + instance + add to `parent` when ready (a failed load leaves nothing and logs once) */
export function addModelInstances(parent: THREE.Object3D, sky: Sky, name: NalatiModelName, placements: readonly ModelPlacement[], look: ModelLook = {}): Promise<THREE.InstancedMesh | null> {
  if (placements.length === 0) return Promise.resolve(null);
  return loadNalatiModel(sky, name, look).then((m) => {
    const mesh = instanceModel(m, placements);
    parent.add(mesh);
    return mesh;
  }).catch((e: unknown) => { console.warn(`[nalati] model ${name} failed`, e); return null; });
}

/** each model's size in its own space, W × H × D (m) — the finished GLBs' measured boxes (Blender post), for scaling a
 *  placement to a wanted size before the file has loaded */
export const MODEL_SIZE: Readonly<Record<NalatiModelName, readonly [number, number, number]>> = {
  yurt: [4.52, 3.2, 4.46], 'horse-saddled': [0.71, 1.9, 2.31], 'horse-wild': [0.78, 1.75, 2.16], spruce: [5.96, 15.69, 5.58],
  wolf: [0.48, 0.85, 0.94], sheep: [0.5, 0.95, 1.19], 'snow-leopard': [0.48, 0.8, 1.33], eagle: [0.43, 0.85, 0.57],
  'golden-king': [1.19, 2.1, 0.69], balbal: [0.68, 1.6, 0.59], 'boulder-1': [1.65, 1.4, 1.66], 'boulder-2': [2.15, 2.0, 2.14],
  'boulder-3': [3.11, 0.8, 2.58], 'kumis-churn': [0.6, 1.1, 0.66], cauldron: [1.57, 1.7, 1.32], saddle: [0.54, 0.6, 0.46],
  firewood: [0.58, 0.6, 0.68], chest: [0.87, 0.6, 0.69],
  watchtower: [8.68, 12.01, 7.19], 'snow-lotus': [0.55, 0.5, 0.56], 'kokpar-rider': [1.19, 2.5, 3.25],
};

/** triangles per model (desktop GLB; the phone GLB is the same mesh) — for the POIs' tri counts */
export const MODEL_TRIS: Readonly<Record<NalatiModelName, number>> = {
  yurt: 6000, 'horse-saddled': 8000, 'horse-wild': 8000, spruce: 2999, wolf: 7523, sheep: 4802, 'snow-leopard': 7997,
  eagle: 5903, 'golden-king': 6543, balbal: 1473, 'boulder-1': 800, 'boulder-2': 800, 'boulder-3': 800, 'kumis-churn': 1334,
  cauldron: 1406, saddle: 1456, firewood: 1492, chest: 1417, watchtower: 4000, 'snow-lotus': 2233, 'kokpar-rider': 9000,
};
/** triangles of the far LODs */
export const FAR_TRIS: Readonly<Record<FarModelName, number>> = { 'horse-wild': 790, 'horse-saddled': 798, 'kokpar-rider': 1066 };

/**
 * Collects model placements while a POI is built (synchronously, like its PaintKit), then adds ONE InstancedMesh per
 * model to the POI's group when the GLBs have loaded:
 *   const sink = new ModelSink();  sink.add('chest', { x, y, z, rot });  …  sink.flush(group, sky);
 */
export class ModelSink {
  private readonly lists = new Map<NalatiModelName, ModelPlacement[]>();
  add(name: NalatiModelName, p: ModelPlacement): void {
    let l = this.lists.get(name);
    if (!l) { l = []; this.lists.set(name, l); }
    l.push(p);
  }
  get size(): number { let n = 0; for (const l of this.lists.values()) n += l.length; return n; }
  /** the triangles these placements will draw */
  tris(): number { let n = 0; for (const [k, l] of this.lists) n += MODEL_TRIS[k] * l.length; return n; }
  flush(parent: THREE.Object3D, sky: Sky, look: Partial<Record<NalatiModelName, ModelLook>> = {}): Promise<unknown> {
    return Promise.all([...this.lists].map(([name, l]) => addModelInstances(parent, sky, name, l, look[name] ?? {})));
  }
}

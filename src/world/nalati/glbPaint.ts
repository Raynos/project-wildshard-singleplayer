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
 *
 * `setModelShade(on)` — the Look Lab's "Driftwood's shading for generated models" (NALATI-MERGE L3; Settings
 * `modelShade`, src/nalati/look/lab.ts): the low-poly kit's AO bake (src/world/lowpolyKit.ts bakeAO — hemisphere rays
 * through a voxel grid of the model's own triangles, plus the ground under it) run per VERTEX on every loaded static model,
 * written into its vertex colours (which the atlas multiplies): the undersides, the cracks and the foot of a boulder, a
 * balbal, a cauldron go dark in a warm umber instead of taking the painted sky's cool blue shade on a smooth, AO-less
 * surface — the "blue plastic" of N14 — and their shade keeps its hue: the painted floor's cool lift of dark paint drops to
 * a fifth on them (MODEL_FLOOR). Live: colours swapped in place, one uniform per material (no new program, no reload).
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { TIER } from '../../core/tier';
import { painterlyMaterial, painterlyKnobs } from '../painterly';
import type { Sky } from '../Sky';
import { setting } from '../../ui/Settings';

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
 * procedural (the camp orbit, 2026-09-23: the generated yurt's felt read stained up close); the yurt model is now the
 * Blender one (NALATI-MERGE D1, scripts/blender/nalati_yurt.py), a Look Lab pick (Settings `yurts`, on the next load).
 * `?models=0` → every POI procedural, `?models=1` → every model on (yurts included), `?yurts=1` / `?yurts=0` → the
 * yurts alone, `?creatures=glb` / `?creatures=proc` → the rigged creature GLBs
 * (src/entities/glbCreatures.ts, on by default since 2026-09-23; `proc` = the procedural creatures) alone.
 */
export type ModelPart = 'yurt' | 'props' | 'rocks' | 'balbal' | 'creatures';
const PART_DEFAULT: Readonly<Record<ModelPart, boolean>> = { yurt: false, props: true, rocks: true, balbal: true, creatures: true };

export function modelsOn(part: ModelPart): boolean {
  if (typeof location === 'undefined') return PART_DEFAULT[part];
  const q = new URLSearchParams(location.search);
  const all = q.get('models');
  if (all === '0') return false;
  if (part === 'yurt' && all !== '1') return setting('yurts') === 'model';   // the Look Lab pick (the URL's ?yurts= overrides it)
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

// ── the model shading variant (see the header) ──
/** per loaded static model: its colours as loaded, and with the AO baked in (made the first time the variant is on) */
const shades = new Map<THREE.BufferGeometry, { plain: Float32Array; ao: Float32Array | null }>();
/** each model material → the model's own geometry (a builder may draw a fitted clone of it: the dressing's rocks) */
let modelShadeOn = false;
const modelMats = new WeakMap<THREE.Material, THREE.BufferGeometry>();
const modelMatList = new Set<THREE.Material>();
/**
 * the other half of Driftwood's shading: its shade keeps the albedo's hue (hemisphere × albedo + a lift × albedo). The
 * painterly floor (painterly.ts uPFloor) instead ADDS the cool sky tint to every dark channel — on a dark granite atlas
 * with smooth normals that is exactly the blue plastic. The generated models take a fifth of it under the variant.
 */
const MODEL_FLOOR = 0.2;
function applyFloor(mat: THREE.Material): void { const k = painterlyKnobs(mat); if (k) k.uPFloorAmt.value = modelShadeOn ? MODEL_FLOOR : 1; }
/**
 * the variant: bake (once per geometry) and show the AO'd colours, or put the plain ones back. `root` (the scene): the
 * clones a builder made of a model (same vertices, other positions: fitRock) are found by their model material and
 * baked in their own shape. Turned on before the world builds (the URL / the saved pick), the models are baked as they
 * load, so a clone copies the baked colours and needs nothing more.
 */
export function setModelShade(on: boolean, root?: THREE.Object3D): void {
  const changed = on !== modelShadeOn;
  modelShadeOn = on;
  root?.traverse((o) => {
    if (!isMesh(o)) return;
    const geo: THREE.BufferGeometry = o.geometry;
    const mat: THREE.Material | THREE.Material[] = o.material;
    if (shades.has(geo) || Array.isArray(mat)) return;
    const orig = modelMats.get(mat);
    const base = orig ? shades.get(orig) : undefined;
    const col = geo.getAttribute('color');
    if (!base || !(col instanceof THREE.BufferAttribute) || col.array.length !== base.plain.length) return;
    shades.set(geo, { plain: base.plain, ao: null });
    applyShade(geo);
  });
  if (changed) { for (const geo of shades.keys()) applyShade(geo); for (const m of modelMatList) applyFloor(m); }
}
function applyShade(geo: THREE.BufferGeometry): void {
  const s = shades.get(geo);
  const col = geo.getAttribute('color');
  if (!s || !(col instanceof THREE.BufferAttribute) || !(col.array instanceof Float32Array)) return;
  if (modelShadeOn && s.ao === null) s.ao = bakeVertexAO(geo, s.plain);
  col.array.set(modelShadeOn && s.ao ? s.ao : s.plain);
  col.needsUpdate = true;
}

// 14 hemisphere directions (+z up in a tangent frame; lowpolyKit's set, so the two bakes weigh alike)
const HEMI: readonly (readonly [number, number, number])[] = (() => {
  const out: [number, number, number][] = [];
  for (const [cz, n] of [[0.95, 1], [0.72, 5], [0.38, 8]] as const) {
    const sn = Math.sqrt(1 - cz * cz);
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + cz * 1.7; out.push([Math.cos(a) * sn, Math.sin(a) * sn, cz]); }
  }
  return out;
})();
/** a warm umber, not the kit's violet: the painted world's shade is already cool, the crevices should read as earth */
const AO_TINT = new THREE.Color('#5b4636');
const AO_STRENGTH = 0.7, AO_DOWN = 0.22;

/**
 * lowpolyKit's voxel AO, per vertex for a smooth indexed mesh in its own space (the ground is the plane under its
 * bounding box): the triangles are rasterised into an occupancy grid, each vertex marches
 * 14 hemisphere rays from just off its surface, and the occluded fraction (+ a little for facing down) pulls its
 * colour toward AO_TINT. ~5–40 ms per model, once.
 */
function bakeVertexAO(geo: THREE.BufferGeometry, plain: Float32Array): Float32Array {
  const out = plain.slice();
  const pos = geo.getAttribute('position'), nrm = geo.getAttribute('normal');
  if (!geo.boundingBox) geo.computeBoundingBox();
  const box = geo.boundingBox ?? new THREE.Box3();
  const y0 = box.min.y;   // the ground: the model's base (0 for a GLB as loaded; a fitted clone's own bottom)
  const ext = new THREE.Vector3(box.max.x - box.min.x, box.max.y - y0, box.max.z - box.min.z);
  const cell = Math.max(0.03, Math.max(ext.x, ext.y, ext.z) / 64);
  const pad = 3;
  const ox = box.min.x - pad * cell, oy = y0 - pad * cell, oz = box.min.z - pad * cell;
  const nx = Math.ceil(ext.x / cell) + pad * 2 + 1, ny = Math.ceil(ext.y / cell) + pad * 2 + 1, nz = Math.ceil(ext.z / cell) + pad * 2 + 1;
  const grid = new Uint8Array(nx * ny * nz);
  const cellOf = (x: number, y: number, z: number): number => {
    const ix = Math.floor((x - ox) / cell), iy = Math.floor((y - oy) / cell), iz = Math.floor((z - oz) / cell);
    return ix < 0 || iy < 0 || iz < 0 || ix >= nx || iy >= ny || iz >= nz ? -1 : (iz * ny + iy) * nx + ix;
  };
  const index = geo.getIndex();
  const tri = index ? index.count / 3 : pos.count / 3;
  const vi = (t: number, k: number): number => (index ? index.getX(t * 3 + k) : t * 3 + k);
  for (let t = 0; t < tri; t++) {
    const a = vi(t, 0), b = vi(t, 1), c = vi(t, 2);
    const ax = pos.getX(a), ay = pos.getY(a), az = pos.getZ(a);
    const bx = pos.getX(b) - ax, by = pos.getY(b) - ay, bz = pos.getZ(b) - az;
    const cx = pos.getX(c) - ax, cy = pos.getY(c) - ay, cz = pos.getZ(c) - az;
    const e = Math.max(Math.hypot(bx, by, bz), Math.hypot(cx, cy, cz), Math.hypot(cx - bx, cy - by, cz - bz));
    const n = Math.min(200, Math.max(1, Math.ceil(e / (cell * 0.7))));
    for (let u = 0; u <= n; u++) for (let v = 0; u + v <= n; v++) {
      const s = u / n, w = v / n;
      const k = cellOf(ax + bx * s + cx * w, ay + by * s + cy * w, az + bz * s + cz * w);
      if (k >= 0) grid[k] = 1;
    }
  }
  const solid = (x: number, y: number, z: number): boolean => {
    if (y < y0) return true;                                  // the ground the model stands on
    const k = cellOf(x, y, z);
    return k >= 0 && grid[k] === 1;
  };
  const steps = 10, dist = cell * 10;
  const N = new THREE.Vector3(), T = new THREE.Vector3(), B = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    N.set(nrm.getX(i), nrm.getY(i), nrm.getZ(i));
    if (N.lengthSq() < 0.5) continue;
    N.normalize();
    T.set(Math.abs(N.y) < 0.9 ? 0 : 1, Math.abs(N.y) < 0.9 ? 1 : 0, 0).cross(N).normalize(); B.crossVectors(N, T);
    const px = pos.getX(i) + N.x * cell * 1.5, py = pos.getY(i) + N.y * cell * 1.5, pz = pos.getZ(i) + N.z * cell * 1.5;
    let occ = 0, wsum = 0;
    for (const [hx, hy, hz] of HEMI) {
      const dx = T.x * hx + B.x * hy + N.x * hz, dy = T.y * hx + B.y * hy + N.y * hz, dz = T.z * hx + B.z * hy + N.z * hz;
      wsum += hz;
      for (let st = 0; st < steps; st++) {
        const d = (st + 0.5) * (dist / steps);
        if (solid(px + dx * d, py + dy * d, pz + dz * d)) { occ += hz * (1 - (st / steps) * 0.5); break; }
      }
    }
    const k = Math.min(1, (occ / wsum) * AO_STRENGTH + Math.max(0, -N.y) * AO_DOWN);
    out[i * 3] = (plain[i * 3] ?? 1) * (1 - k + AO_TINT.r * k);
    out[i * 3 + 1] = (plain[i * 3 + 1] ?? 1) * (1 - k + AO_TINT.g * k);
    out[i * 3 + 2] = (plain[i * 3 + 2] ?? 1) * (1 - k + AO_TINT.b * k);
  }
  return out;
}

/** a model's float geometry + atlas (no material), loading it if needed — for code that builds its own mesh (creatures) */
export function loadModelRaw(name: NalatiModelName): Promise<RawModel> { return loadRaw(name, 'near'); }
/** the same, synchronously: the loaded model, or null while it is still loading (or failed) */
export function modelRawIfLoaded(name: NalatiModelName): RawModel | null { return ready.get(`${name}|near`) ?? null; }

/**
 * A loaded GLB's first mesh as the float geometry + atlas every Nalati model is drawn from (the node transform baked in,
 * meshopt's quantised attributes de-quantised, a float rgb `color` always present). The Blender pipeline's models
 * (scripts/blender/*, img2mesh/driftwood_post.py: no texture, COLOR_0 rgb = albedo, a = Cycles AO 0.35..1) bring their
 * colours; the AO in the alpha darkens them (0.4 + 0.6 × AO). Exported for the dev pages that load a candidate file
 * through the game's own path (scripts/nalati-models-merge-compare.mjs).
 */
export function rawFromGltf(scene: THREE.Object3D, label: string): RawModel {
  scene.updateMatrixWorld(true);
  const meshes: THREE.Mesh[] = [];
  scene.traverse((o) => { if (isMesh(o)) meshes.push(o); });
  const found = meshes[0];
  if (!found) throw new Error(`nalati model ${label}: no mesh`);
  const src = found.geometry;
  const geometry = new THREE.BufferGeometry();
  for (const key of ['position', 'normal', 'uv'] as const) {
    if (src.hasAttribute(key)) geometry.setAttribute(key, floatAttr(src.getAttribute(key)));
  }
  const index = src.getIndex();
  if (index) geometry.setIndex(Array.from(index.array));
  geometry.applyMatrix4(found.matrixWorld);
  if (!geometry.hasAttribute('normal')) geometry.computeVertexNormals();
  // painterly materials always read vertex colours: the model's own (a far LOD's coat, a Blender model's albedo), else a
  // white one (the atlas carries it). Float rgb, so the model-shading variant can swap its baked colours in place
  const nv = geometry.getAttribute('position').count;
  const rgb = new Float32Array(nv * 3).fill(1);
  if (src.hasAttribute('color')) {
    const c = src.getAttribute('color');
    const ao = c.itemSize === 4;
    for (let i = 0; i < nv; i++) {
      const k = ao ? 0.4 + 0.6 * c.getW(i) : 1;
      rgb[i * 3] = c.getX(i) * k; rgb[i * 3 + 1] = c.getY(i) * k; rgb[i * 3 + 2] = c.getZ(i) * k;
    }
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const srcMat = found.material;
  const first = Array.isArray(srcMat) ? srcMat[0] : srcMat;
  const map = first instanceof THREE.MeshStandardMaterial && first.map ? first.map : null;
  if (map) { map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4; }
  const box = geometry.boundingBox?.clone() ?? new THREE.Box3();
  return { geometry, map, box };
}

function loadRaw(name: NalatiModelName, lod: ModelLod): Promise<RawModel> {
  const rkey = `${name}|${lod}`;
  let p = raw.get(rkey);
  if (!p) {
    const url = lod === 'far' ? `${DIR}${name}.far.glb` : `${DIR}${name}${TIER === 'phone' ? '.phone' : ''}.glb`;
    p = gltfLoader().loadAsync(url).then((gltf) => {
      const out = rawFromGltf(gltf.scene, name);
      const { geometry } = out;
      ready.set(rkey, out);
      const rgb = geometry.getAttribute('color').array;
      shades.set(geometry, { plain: rgb instanceof Float32Array ? rgb.slice() : new Float32Array(rgb), ao: null });
      if (modelShadeOn) applyShade(geometry);
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
    p = loadRaw(name, lod).then((r) => {
      const material = painterlyMaterial(sky, { map: r.map, rim: look.rim ?? 0.35, bands: look.bands ?? 0.8, sway: look.sway ?? 0, color: look.color ?? 0xffffff });
      modelMats.set(material, r.geometry);
      modelMatList.add(material);
      applyFloor(material);
      return { name, geometry: r.geometry, box: r.box, material };
    });
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
  yurt: [4.72, 2.9, 4.76], 'horse-saddled': [0.71, 1.9, 2.31], 'horse-wild': [0.78, 1.75, 2.16], spruce: [5.96, 15.69, 5.58],
  wolf: [0.48, 0.85, 0.94], sheep: [0.5, 0.95, 1.19], 'snow-leopard': [0.48, 0.8, 1.33], eagle: [0.43, 0.85, 0.57],
  'golden-king': [0.88, 2.1, 0.68], balbal: [0.68, 1.6, 0.59], 'boulder-1': [1.65, 1.4, 1.66], 'boulder-2': [2.15, 2.0, 2.14],
  'boulder-3': [3.11, 0.8, 2.58], 'kumis-churn': [0.6, 1.1, 0.66], cauldron: [1.57, 1.7, 1.32], saddle: [0.54, 0.6, 0.46],
  firewood: [0.58, 0.6, 0.68], chest: [0.87, 0.6, 0.69],
  watchtower: [8.68, 12.01, 7.19], 'snow-lotus': [0.55, 0.5, 0.56], 'kokpar-rider': [1.19, 2.5, 3.25],
};

/** triangles per model (desktop GLB; the phone GLB is the same mesh) — for the POIs' tri counts */
export const MODEL_TRIS: Readonly<Record<NalatiModelName, number>> = {
  yurt: 4272, 'horse-saddled': 8000, 'horse-wild': 8000, spruce: 2999, wolf: 7523, sheep: 4802, 'snow-leopard': 7997,
  eagle: 5903, 'golden-king': 8000, balbal: 1473, 'boulder-1': 800, 'boulder-2': 800, 'boulder-3': 800, 'kumis-churn': 1334,
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

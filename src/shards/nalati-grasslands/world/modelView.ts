import { awaitSpecimenAssets, loadBoundSpecimen, type SpecimenAssetRow } from '@wildshard/sdk/kit/specimenCatalogue';
import * as THREE from 'three';
import { cacheUntilDisposed } from '@wildshard/engine/app/cachedAssets';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';


/** Prepared model loading, painterly material binding and instancing. Painting runs only in generators/modelPainting.ts. */

export type NalatiModelName =
  | 'horse-saddled' | 'horse-wild' | 'wolf' | 'sheep' | 'snow-leopard' | 'eagle' | 'golden-king' | 'spruce'
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

export type ModelPart = 'rocks' | 'balbal' | 'creatures';
export function modelsOn(_part: ModelPart): boolean { return true; }

const DIR = '/assets/nalati/baked/painted-models/';

/** a float copy of an attribute (de-quantises normalized ints) */
function floatAttr(a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute): THREE.BufferAttribute {
  const n = a.count, k = a.itemSize, out = new Float32Array(n * k);
  for (let i = 0; i < n; i++) for (let c = 0; c < k; c++) out[i * k + c] = a.getComponent(i, c);
  return new THREE.BufferAttribute(out, k);
}

const isMesh = (o: THREE.Object3D): o is THREE.Mesh => o instanceof THREE.Mesh;

export interface RawModel { geometry: THREE.BufferGeometry; map: THREE.Texture | null; box: THREE.Box3 }
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

const models = new WeakMap<Sky, Map<string, Promise<NalatiModel>>>();
const modelMats = new WeakMap<THREE.Material, THREE.BufferGeometry>();
const clonePaint = new WeakMap<THREE.BufferGeometry, THREE.BufferAttribute>();

/** Apply the fixed fitted-rock/balbal colours at the original look-wiring boundary. */
export function setModelShade(_on: true, root?: THREE.Object3D): void {
  root?.traverse((o) => {
    if (!isMesh(o) || Array.isArray(o.material)) return;
    const original = modelMats.get(o.material);
    if (original === undefined || original === o.geometry) return;
    const paint = clonePaint.get(original);
    const color = o.geometry.getAttribute('color');
    if (paint !== undefined && color instanceof THREE.BufferAttribute && color.array instanceof Float32Array) {
      color.array.set(paint.array); color.needsUpdate = true;
    }
  });
}

/** Await models already requested by the owned world before a bake snapshots its roots.
 * Recheck after producer callbacks: a completed model may request another model. This never
 * starts a load, rebuilds geometry or swallows a failed asset, unlike a timed capture delay.
 */
export async function awaitNalatiModelLoads(sky: Sky): Promise<void> {
  const observed = new Set<Promise<unknown>>();
  for (;;) {
    await awaitSpecimenAssets(sky);
    const pending = [...models.get(sky)?.values() ?? []].filter(promise => !observed.has(promise));
    if (pending.length === 0) return;
    for (const promise of pending) observed.add(promise);
    await Promise.all(pending);
  }
}

/** one model on the painterly look (cached per sky × name × look) */
export function loadNalatiModel(sky: Sky, name: NalatiModelName, look: ModelLook = {}, lod: ModelLod = 'near'): Promise<NalatiModel> {
  let bySky = models.get(sky);
  if (!bySky) { bySky = new Map(); models.set(sky, bySky); }
  const key = `${name}|${lod}|${look.rim ?? ''}|${look.bands ?? ''}|${look.sway ?? ''}|${new THREE.Color(look.color ?? 0xffffff).getHexString()}`;
  let p = bySky.get(key);
  if (!p) {
    const color = look.color instanceof THREE.Color ? [look.color.r, look.color.g, look.color.b] as const : look.color ?? 0xffffff;
    const row: SpecimenAssetRow = { url: lod === 'far' ? `${DIR}${name}.far.glb` : `${DIR}${name}.glb`,
      ...(lod === 'far' ? {} : { phoneUrl: `${DIR}${name}.phone.glb` }), geometrySlot: 0, materialSlot: 0, retainedAttribute: '_paint_clone',
      material: { id: `nalati-model:${key}`, family: 'painterly', rim: look.rim ?? 0.35, bands: look.bands ?? 0.8, sway: look.sway ?? 0, color, floor: 0.2 } };
    p = loadBoundSpecimen(sky, row).then((r) => {
      const material = r.material;
      if (!(material instanceof THREE.MeshLambertMaterial)) throw new Error('Prepared painted model needs a Lambert material');
      if (r.retainedAttribute !== undefined) clonePaint.set(r.geometry, r.retainedAttribute);
      modelMats.set(material, r.geometry);
      const model = { name, geometry: r.geometry, box: r.box, material };
      const cache = bySky;
      cacheUntilDisposed(model, () => { cache.delete(key); });
      return model;
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

/** each model's size in its own space, W × H × D (m) — the finished GLBs' measured boxes (Blender post), for scaling a
 *  placement to a wanted size before the file has loaded */
export const MODEL_SIZE: Readonly<Record<NalatiModelName, readonly [number, number, number]>> = {
  'horse-saddled': [0.71, 1.9, 2.31], 'horse-wild': [0.78, 1.75, 2.16], spruce: [5.96, 15.69, 5.58],
  wolf: [0.48, 0.85, 0.94], sheep: [0.5, 0.95, 1.19], 'snow-leopard': [0.48, 0.8, 1.33], eagle: [0.43, 0.85, 0.57],
  'golden-king': [0.88, 2.1, 0.68], balbal: [0.68, 1.6, 0.59], 'boulder-1': [1.65, 1.4, 1.66], 'boulder-2': [2.15, 2.0, 2.14],
  'boulder-3': [3.11, 0.8, 2.58], 'kumis-churn': [0.6, 1.1, 0.66], cauldron: [1.57, 1.7, 1.32], saddle: [0.54, 0.6, 0.46],
  firewood: [0.58, 0.6, 0.68], chest: [0.87, 0.6, 0.69],
  watchtower: [8.68, 12.01, 7.19], 'snow-lotus': [0.55, 0.5, 0.56], 'kokpar-rider': [1.19, 2.5, 3.25],
};

/** triangles per model (desktop GLB; the phone GLB is the same mesh) — for the POIs' tri counts */
export const MODEL_TRIS: Readonly<Record<NalatiModelName, number>> = {
  'horse-saddled': 8000, 'horse-wild': 8000, spruce: 2999, wolf: 7523, sheep: 4802, 'snow-leopard': 7997,
  eagle: 5903, 'golden-king': 8000, balbal: 1473, 'boulder-1': 800, 'boulder-2': 800, 'boulder-3': 800, 'kumis-churn': 1334,
  cauldron: 1406, saddle: 1456, firewood: 1492, chest: 1417, watchtower: 4000, 'snow-lotus': 2233, 'kokpar-rider': 9000,
};
/** triangles of the far LODs */
export const FAR_TRIS: Readonly<Record<FarModelName, number>> = { 'horse-wild': 790, 'horse-saddled': 798, 'kokpar-rider': 1066 };


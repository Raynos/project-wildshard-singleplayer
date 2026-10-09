import { loadRigFile } from '@wildshard/engine/anim/rig';
import { cacheUntilDisposed, retainCachedResources } from '@wildshard/engine/app/cachedAssets';
import { applySurfaceLooks, type SurfaceLook } from '@wildshard/sdk/looks/surfaceLooks';
import { FIRE_LIGHTS } from './fireFx';
import { DUSK } from '../look/dusk';
import { BRAZIER_SURFACE, CAMP_SURFACE, GLOVE_SURFACE } from '../data/surfaces';
import { DUNE_HD, DUNE_MESHES, DUNE_RIGS, DUNE_HD_URLS, DUNE_MESH_URLS, DUNE_RIG_URLS, type DuneHdName, type DuneMeshName, type DuneRigName } from '../data/files';
import { Box3, BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, Uint16BufferAttribute, Vector3, type BufferAttribute, type Object3D } from 'three';

/**
 * Signal Dunes' generated models (C6, E374): codex refs → Hunyuan3D-2 → faceted, vertex-coloured GLBs
 * (`art/sunscar-dunes/round-7-models/props.json`, built into `public/assets/sunscar-dunes/models/<name>/<name>.glb`).
 * Each is loaded once behind the loading screen (`preloadDuneMeshes`, the plugin's `world` hook) and kept as one flat
 * non-indexed geometry: position, the facet colour (rgb × the baked AO in COLOR_0's alpha) and flat normals. A model
 * that fails to load is a page fault (`console.error`: the boot smoke and the tests fail on it, SF72), never a silent
 * stand-in: the places and the tower stand undrawn without it.
 */

const ready = new Map<DuneMeshName, BufferGeometry>();
/** How much of the baked AO survives: a facet in full occlusion keeps this share of its colour. */
const AO_FLOOR = 0.55;
let loading: Promise<void> | null = null;
const isMesh = (o: Object3D): o is Mesh => o instanceof Mesh;

/** One mesh's triangles in world space, de-indexed, as plain float32 (meshopt quantizes the attributes). */
function flatten(mesh: Mesh): { pos: number[]; col: number[] } {
  const g = mesh.geometry, p = g.getAttribute('position'), c = g.hasAttribute('color') ? g.getAttribute('color') : null;
  const index = g.getIndex(), n = index ? index.count : p.count, pos: number[] = [], col: number[] = [], v = new Vector3();
  for (let k = 0; k < n; k++) {
    const i = index ? index.getX(k) : k;
    v.fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld); pos.push(v.x, v.y, v.z);
    const ao = c?.itemSize === 4 ? AO_FLOOR + (1 - AO_FLOOR) * c.getW(i) : 1;
    col.push((c ? c.getX(i) : 1) * ao, (c ? c.getY(i) : 1) * ao, (c ? c.getZ(i) : 1) * ao);
  }
  return { pos, col };
}

async function load(name: DuneMeshName): Promise<void> {
  try {
    const gltf = await loadRigFile(DUNE_MESH_URLS[name]);
    gltf.scene.updateMatrixWorld(true);
    const pos: number[] = [], col: number[] = [];
    gltf.scene.traverse((o) => { if (isMesh(o)) { const f = flatten(o); pos.push(...f.pos); col.push(...f.col); } });
    if (pos.length === 0) throw new Error(`${name}: no mesh`);
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('color', new Float32BufferAttribute(col, 3));
    g.computeVertexNormals(); g.computeBoundingBox(); retainCachedResources(g); ready.set(name, g);
    cacheUntilDisposed(g, () => { if (ready.get(name) === g) { ready.delete(name); loading = null; } });
  } catch (e: unknown) { console.error(`[sunscar-dunes] the generated model ${name} did not load:`, e); }
}

const rigs = new Map<DuneRigName, BufferGeometry>();
/**
 * A baked creature body (SF72, `generators/species.ts`): one skinned geometry, its bone indices and weights in the
 * `_JOINTS` / `_WEIGHTS` attributes; each copy's flat normals are recomputed from the same positions the code built.
 */
async function loadRig(name: DuneRigName): Promise<void> {
  try {
    const gltf = await loadRigFile(DUNE_RIG_URLS[name]), meshes: Mesh[] = [];
    gltf.scene.traverse((o) => { if (isMesh(o)) meshes.push(o); });
    const loaded = meshes[0]?.geometry;
    if (meshes.length !== 1 || loaded === undefined) throw new Error(`${name}: ${String(meshes.length)} meshes, one baked`);
    const source = loaded.index === null ? loaded : loaded.toNonIndexed();
    for (const key of ['position', 'color', '_joints', '_weights']) if (!source.hasAttribute(key)) throw new Error(`${name}: no ${key}`);
    const p = source.getAttribute('position'), c = source.getAttribute('color'), j = source.getAttribute('_joints'), w = source.getAttribute('_weights');
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(p.array, 3)); g.setAttribute('color', new Float32BufferAttribute(c.array, 3));
    g.setAttribute('skinIndex', new Uint16BufferAttribute(Uint16Array.from(j.array), 4)); g.setAttribute('skinWeight', new Float32BufferAttribute(w.array, 4));
    retainCachedResources(g); rigs.set(name, g); source.dispose(); loaded.dispose();
    cacheUntilDisposed(g, () => { if (rigs.get(name) === g) { rigs.delete(name); loading = null; } });
  } catch (e: unknown) { console.error(`[sunscar-dunes] the baked rig ${name} did not load:`, e); }
}
/** A copy of a baked creature body, or null (not loaded: its load was faulted). */
export function duneRig(name: DuneRigName): BufferGeometry | null {
  const g = rigs.get(name)?.clone() ?? null; g?.computeVertexNormals(); return g;
}
/** A creature that did not load stands undrawn: one zero-area triangle on bone 0 (a species needs a geometry part). */
export function undrawnRig(): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(new Float32Array(9), 3)); g.setAttribute('color', new Float32BufferAttribute(new Float32Array(9), 3));
  g.setAttribute('normal', new Float32BufferAttribute(new Float32Array(9), 3));
  g.setAttribute('skinIndex', new Uint16BufferAttribute(new Uint16Array(12), 4)); g.setAttribute('skinWeight', new Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
  return g;
}

const hd = new Map<DuneHdName, Object3D>();
/** The live inputs Signal's surface rows read: the fires' light slots and the dusk. */
const SURFACE_INPUTS = { lights: FIRE_LIGHTS, dusk: DUSK };
/** A camp material warmed by each burning fire within ~4.5 m (`data/surfaces.ts` FIRELIGHT): its own fire lights it. */
export const warmByFire = (m: MeshStandardMaterial): void => { applySurfaceLooks(m, CAMP_SURFACE, SURFACE_INPUTS); };
/** A code-built held part's surface rows (the coil's viewer light and sheen) over the shared inputs. */
export const heldSurface = (m: MeshStandardMaterial, looks: readonly SurfaceLook[]): void => { applySurfaceLooks(m, looks, SURFACE_INPUTS); };
/** A textured hero model: its scene as loaded (its own map on its own UVs), normals smoothed, matte. */
async function loadHd(name: DuneHdName): Promise<void> {
  try {
    const gltf = await loadRigFile(DUNE_HD_URLS[name]);
    gltf.scene.traverse((o) => {
      if (!isMesh(o)) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (m instanceof MeshStandardMaterial) {
          m.metalness = 0; m.roughness = 0.85; m.flatShading = false;
          // E399 / E407 row 4 / round 16 (mockup D): the glove keeps its own painted leather, matte with a soft sheen, the
          // viewer-side light and the leather grain (data/surfaces.ts)
          if (name === 'glove-hd4') { m.color.setRGB(0.92, 0.84, 0.76); m.roughness = 0.34; m.fog = false; m.userData['sunscarNoRim'] = true; applySurfaceLooks(m, GLOVE_SURFACE, SURFACE_INPUTS); }
          // round 8-10 (mockup C: soot-dark iron and weathered stone, warm only where the fire lights it; R9B-7: the post still red copper)
          if (name === 'brazier-hd') { m.color.setRGB(0.5, 0.46, 0.44); applySurfaceLooks(m, BRAZIER_SURFACE, SURFACE_INPUTS); }
          if (name === 'wagon-hd2' || name === 'crates-hd' || name === 'sacks-hd') warmByFire(m); // the camp: the lantern and the cookfire light it
          m.needsUpdate = true;
        }
      }
    });
    retainCachedResources(gltf.scene); hd.set(name, gltf.scene);
    cacheUntilDisposed(gltf.scene, () => { if (hd.get(name) === gltf.scene) { hd.delete(name); loading = null; } });
  } catch (e: unknown) { console.error(`[sunscar-dunes] the generated model ${name} did not load:`, e); }
}

/** Load every generated model and baked rig once (a failed one is skipped and faulted). */
export function preloadDuneMeshes(): Promise<void> {
  loading ??= Promise.all([...DUNE_MESHES.filter(name => !ready.has(name)).map(load), ...DUNE_HD.filter(name => !hd.has(name)).map(loadHd),
    ...DUNE_RIGS.filter(name => !rigs.has(name)).map(loadRig)]).then(() => undefined);
  return loading;
}

/**
 * A textured hero model, fitted like `fit` (turned `yaw`, centred on x / z, its lowest point at `floor`, `size` metres
 * by span or height), as a group sharing the loaded geometry and maps; null when it did not load.
 */
export function duneHd(name: DuneHdName, o: { size: number; by: 'span' | 'height'; floor?: number; yaw?: number }): Group | null {
  const src = hd.get(name); if (!src) return null;
  const inner = src.clone(true), holder = new Group(), turn = new Group();
  turn.rotation.y = o.yaw ?? 0; turn.add(inner); holder.add(turn); holder.updateMatrixWorld(true);
  const b = new Box3().setFromObject(holder);
  const span = o.by === 'height' ? b.max.y - b.min.y : Math.max(b.max.x - b.min.x, b.max.z - b.min.z), k = o.size / Math.max(1e-6, span);
  turn.position.set(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
  const out = new Group(); out.add(holder); holder.scale.setScalar(k); holder.position.y = o.floor ?? 0;
  return out;
}

/** A copy of a loaded model's geometry, or null (not loaded: use the code model). */
export function duneMesh(name: DuneMeshName): BufferGeometry | null { return ready.get(name)?.clone() ?? null; }

/** The generated models' material: the facet colours, matte (one per model: the level scope owns and disposes it). */
export const duneMaterial = (): MeshStandardMaterial => new MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, flatShading: true });

/**
 * Fit a loaded model into a frame (turned `yaw` radians about +Y first): centred on x / z, its lowest point at `floor`,
 * scaled so its largest horizontal extent (or its height) is `size` metres.
 */
export function fit(g: BufferGeometry, o: { size: number; by: 'span' | 'height'; floor?: number; yaw?: number }): BufferGeometry {
  if (o.yaw !== undefined) g.rotateY(o.yaw);
  const b = new Box3().setFromBufferAttribute(g.getAttribute('position') as BufferAttribute);
  const span = o.by === 'height' ? b.max.y - b.min.y : Math.max(b.max.x - b.min.x, b.max.z - b.min.z), k = o.size / Math.max(1e-6, span);
  g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
  g.scale(k, k, k); g.translate(0, o.floor ?? 0, 0); g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}

/** Drop the triangles whose centroid `cut` says to remove (a part the code model animates instead). */
export function without(g: BufferGeometry, cut: (x: number, y: number, z: number) => boolean): BufferGeometry {
  const p = g.getAttribute('position'), c = g.getAttribute('color'), pos: number[] = [], col: number[] = [];
  for (let t = 0; t + 2 < p.count; t += 3) {
    if (cut((p.getX(t) + p.getX(t + 1) + p.getX(t + 2)) / 3, (p.getY(t) + p.getY(t + 1) + p.getY(t + 2)) / 3, (p.getZ(t) + p.getZ(t + 1) + p.getZ(t + 2)) / 3)) continue;
    for (let v = t; v < t + 3; v++) { pos.push(p.getX(v), p.getY(v), p.getZ(v)); col.push(c.getX(v), c.getY(v), c.getZ(v)); }
  }
  const r = new BufferGeometry(); r.setAttribute('position', new Float32BufferAttribute(pos, 3)); r.setAttribute('color', new Float32BufferAttribute(col, 3));
  r.computeVertexNormals(); r.computeBoundingBox(); r.computeBoundingSphere(); g.dispose(); return r;
}

/** Bind every triangle rigidly to the bone `boneOf` names for its centroid (bone indices in `build().bones` order). */
export function bindRigid(g: BufferGeometry, boneOf: (x: number, y: number, z: number) => number): BufferGeometry {
  const p = g.getAttribute('position'), n = p.count, index = new Uint16Array(n * 4), weight = new Float32Array(n * 4);
  for (let t = 0; t + 2 < n; t += 3) {
    const bone = boneOf((p.getX(t) + p.getX(t + 1) + p.getX(t + 2)) / 3, (p.getY(t) + p.getY(t + 1) + p.getY(t + 2)) / 3, (p.getZ(t) + p.getZ(t + 1) + p.getZ(t + 2)) / 3);
    for (let v = t; v < t + 3; v++) { index[v * 4] = bone; weight[v * 4] = 1; }
  }
  g.setAttribute('skinIndex', new Uint16BufferAttribute(index, 4)); g.setAttribute('skinWeight', new Float32BufferAttribute(weight, 4));
  return g;
}

/**
 * Averages a generated model's painted colour per vertex position (round 2, R1A-2 / R1A-5): each facet painted its own
 * shade, so the triangles showed as patches; averaged, the paint reads as continuous leather, cloth and timber.
 */
export function smoothColors(g: BufferGeometry, amount = 1): void {
  if (!g.hasAttribute('color')) return;
  const p = g.getAttribute('position'), c = g.getAttribute('color'), sum = new Map<string, [number, number, number, number]>();
  const key = (i: number): string => `${p.getX(i).toFixed(4)},${p.getY(i).toFixed(4)},${p.getZ(i).toFixed(4)}`;
  for (let i = 0; i < p.count; i++) { const k = key(i), v = sum.get(k) ?? [0, 0, 0, 0]; v[0] += c.getX(i); v[1] += c.getY(i); v[2] += c.getZ(i); v[3]++; sum.set(k, v); }
  for (let i = 0; i < p.count; i++) {
    const v = sum.get(key(i)); if (!v) continue;
    c.setXYZ(i, c.getX(i) + (v[0] / v[3] - c.getX(i)) * amount, c.getY(i) + (v[1] / v[3] - c.getY(i)) * amount, c.getZ(i) + (v[2] / v[3] - c.getZ(i)) * amount);
  }
  c.needsUpdate = true;
}

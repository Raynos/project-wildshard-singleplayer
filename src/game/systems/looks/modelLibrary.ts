/**
 * A model library (SHARD-PLATFORM M3; ex a dune shard's generated models): the GLBs a level loads once behind its loading
 * screen and then copies synchronously while it builds, each list driven by rows. Nothing here knows a shard.
 *
 * - facet models: every mesh of the file flattened into one non-indexed geometry in world space: position, the facet
 *   colour (rgb × the baked AO in COLOR_0's alpha, kept down to the row's `aoFloor`) and flat normals;
 * - hero models: the scene as loaded (its own maps on its own UVs), matte and smooth, each material then dressed by the
 *   model's `HdLookRow` (tint, roughness, fog, user flags, surface-look rows);
 * - baked rigs: one skinned geometry whose bone indices and weights ride in `_JOINTS` / `_WEIGHTS`.
 *
 * A file that fails to load is a page fault (`console.error`; the boot smoke and the tests fail on it), never a silent
 * stand-in: the caller's copy is null and the thing it would draw stands undrawn. The helpers below (`fitGeometry`,
 * `withoutTriangles`, `bindRigid`, `smoothColors`, `undrawnRig`, `facetMaterial`) shape the copies.
 */
import { loadRigFile } from '@wildshard/engine/anim/rig';
import { cacheUntilDisposed, retainCachedResources } from '@wildshard/engine/app/cachedAssets';
import { Box3, BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, Uint16BufferAttribute, Vector3, type BufferAttribute, type Object3D } from 'three';
import { applySurfaceLooks, type SurfaceInputs, type SurfaceLook } from './surfaceLooks';

/** How a hero model's materials are dressed after the matte base: each field optional, applied in this order. */
export interface HdLookRow {
  /** the material colour, linear RGB */
  readonly color?: readonly [number, number, number];
  readonly roughness?: number;
  readonly fog?: boolean;
  /** flags the caller's own passes read off the material's userData */
  readonly userData?: Readonly<Record<string, boolean>>;
  /** surface-look rows installed over the library's surface inputs */
  readonly surface?: readonly SurfaceLook[];
}

/** A model library's files and looks, as data. */
export interface ModelLibraryRows<M extends string, H extends string, R extends string> {
  /** the facet models preloaded, and every facet model's file */
  readonly meshes: readonly M[];
  readonly meshUrls: Readonly<Record<M, string>>;
  /** the hero models preloaded, and every hero model's file */
  readonly hd: readonly H[];
  readonly hdUrls: Readonly<Record<H, string>>;
  /** the baked rigs preloaded, and every rig's file */
  readonly rigs: readonly R[];
  readonly rigUrls: Readonly<Record<R, string>>;
  /** a facet in full occlusion keeps this share of its colour */
  readonly aoFloor: number;
  /** the hero models' dressing, by name */
  readonly hdLooks: Readonly<Partial<Record<H, HdLookRow>>>;
}

/** How a copy is framed: turned `yaw` about +Y, centred on x / z, its lowest point at `floor`, `size` metres by span or height. */
export interface ModelFit { readonly size: number; readonly by: 'span' | 'height'; readonly floor?: number; readonly yaw?: number }

/** A loaded model library: preload once, then take copies. */
export interface ModelLibrary<M extends string, H extends string, R extends string> {
  /** Load every listed model and rig once (a failed one is skipped and faulted). */
  preload: () => Promise<void>;
  /** A copy of a loaded facet model's geometry, or null (not loaded: the caller's code model stands in). */
  mesh: (name: M) => BufferGeometry | null;
  /** A copy of a baked rig with its flat normals recomputed, or null (not loaded: its load was faulted). */
  rig: (name: R) => BufferGeometry | null;
  /** A hero model fitted as `fit`, as a group sharing the loaded geometry and maps; null when it did not load. */
  hd: (name: H, fit: ModelFit) => Group | null;
}

const isMesh = (o: Object3D): o is Mesh => o instanceof Mesh;

/** One mesh's triangles in world space, de-indexed, as plain float32 (meshopt quantizes the attributes). */
function flatten(mesh: Mesh, aoFloor: number): { pos: number[]; col: number[] } {
  const g = mesh.geometry, p = g.getAttribute('position'), c = g.hasAttribute('color') ? g.getAttribute('color') : null;
  const index = g.getIndex(), n = index ? index.count : p.count, pos: number[] = [], col: number[] = [], v = new Vector3();
  for (let k = 0; k < n; k++) {
    const i = index ? index.getX(k) : k;
    v.fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld); pos.push(v.x, v.y, v.z);
    const ao = c?.itemSize === 4 ? aoFloor + (1 - aoFloor) * c.getW(i) : 1;
    col.push((c ? c.getX(i) : 1) * ao, (c ? c.getY(i) : 1) * ao, (c ? c.getZ(i) : 1) * ao);
  }
  return { pos, col };
}

/** A hero material's matte base, then its look row. */
function dressHd(m: MeshStandardMaterial, look: HdLookRow | undefined, inputs: SurfaceInputs): void {
  m.metalness = 0; m.roughness = 0.85; m.flatShading = false;
  if (look !== undefined) {
    if (look.color !== undefined) m.color.setRGB(look.color[0], look.color[1], look.color[2]);
    if (look.roughness !== undefined) m.roughness = look.roughness;
    if (look.fog !== undefined) m.fog = look.fog;
    if (look.userData !== undefined) for (const [key, value] of Object.entries(look.userData)) m.userData[key] = value;
    if (look.surface !== undefined) applySurfaceLooks(m, look.surface, inputs);
  }
  m.needsUpdate = true;
}

/**
 * A model library over `rows`. `fault` opens every page fault a failed file logs (e.g. the shard's name in brackets);
 * `surfaceInputs` are the live uniforms the hero models' surface rows read.
 */
export function createModelLibrary<M extends string, H extends string, R extends string>(rows: ModelLibraryRows<M, H, R>, fault: string, surfaceInputs: SurfaceInputs = {}): ModelLibrary<M, H, R> {
  const ready = new Map<M, BufferGeometry>(), rigs = new Map<R, BufferGeometry>(), hd = new Map<H, Object3D>();
  let loading: Promise<void> | null = null;

  async function load(name: M): Promise<void> {
    try {
      const gltf = await loadRigFile(rows.meshUrls[name]);
      gltf.scene.updateMatrixWorld(true);
      const pos: number[] = [], col: number[] = [];
      gltf.scene.traverse((o) => { if (isMesh(o)) { const f = flatten(o, rows.aoFloor); pos.push(...f.pos); col.push(...f.col); } });
      if (pos.length === 0) throw new Error(`${name}: no mesh`);
      const g = new BufferGeometry();
      g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('color', new Float32BufferAttribute(col, 3));
      g.computeVertexNormals(); g.computeBoundingBox(); retainCachedResources(g); ready.set(name, g);
      cacheUntilDisposed(g, () => { if (ready.get(name) === g) { ready.delete(name); loading = null; } });
    } catch (e: unknown) { console.error(`${fault} the generated model ${name} did not load:`, e); }
  }

  async function loadRig(name: R): Promise<void> {
    try {
      const gltf = await loadRigFile(rows.rigUrls[name]), meshes: Mesh[] = [];
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
    } catch (e: unknown) { console.error(`${fault} the baked rig ${name} did not load:`, e); }
  }

  async function loadHd(name: H): Promise<void> {
    try {
      const gltf = await loadRigFile(rows.hdUrls[name]), look = rows.hdLooks[name];
      gltf.scene.traverse((o) => {
        if (!isMesh(o)) return;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m instanceof MeshStandardMaterial) dressHd(m, look, surfaceInputs);
      });
      retainCachedResources(gltf.scene); hd.set(name, gltf.scene);
      cacheUntilDisposed(gltf.scene, () => { if (hd.get(name) === gltf.scene) { hd.delete(name); loading = null; } });
    } catch (e: unknown) { console.error(`${fault} the generated model ${name} did not load:`, e); }
  }

  return {
    preload: () => {
      loading ??= Promise.all([...rows.meshes.filter(name => !ready.has(name)).map(load), ...rows.hd.filter(name => !hd.has(name)).map(loadHd),
        ...rows.rigs.filter(name => !rigs.has(name)).map(loadRig)]).then(() => undefined);
      return loading;
    },
    mesh: name => ready.get(name)?.clone() ?? null,
    rig: (name) => { const g = rigs.get(name)?.clone() ?? null; g?.computeVertexNormals(); return g; },
    hd: (name, o) => {
      const src = hd.get(name); if (!src) return null;
      const inner = src.clone(true), holder = new Group(), turn = new Group();
      turn.rotation.y = o.yaw ?? 0; turn.add(inner); holder.add(turn); holder.updateMatrixWorld(true);
      const b = new Box3().setFromObject(holder);
      const span = o.by === 'height' ? b.max.y - b.min.y : Math.max(b.max.x - b.min.x, b.max.z - b.min.z), k = o.size / Math.max(1e-6, span);
      turn.position.set(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
      const out = new Group(); out.add(holder); holder.scale.setScalar(k); holder.position.y = o.floor ?? 0;
      return out;
    },
  };
}

/** A creature that did not load stands undrawn: one zero-area triangle on bone 0 (a species needs a geometry part). */
export function undrawnRig(): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(new Float32Array(9), 3)); g.setAttribute('color', new Float32BufferAttribute(new Float32Array(9), 3));
  g.setAttribute('normal', new Float32BufferAttribute(new Float32Array(9), 3));
  g.setAttribute('skinIndex', new Uint16BufferAttribute(new Uint16Array(12), 4)); g.setAttribute('skinWeight', new Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
  return g;
}

/** The facet models' material: the facet colours, matte (one per model: the caller's scope owns and disposes it). */
export const facetMaterial = (): MeshStandardMaterial => new MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, flatShading: true });

/** Fit a geometry into a frame (turned `yaw` radians about +Y first): centred on x / z, its lowest point at `floor`, scaled to `size`. */
export function fitGeometry(g: BufferGeometry, o: ModelFit): BufferGeometry {
  if (o.yaw !== undefined) g.rotateY(o.yaw);
  const b = new Box3().setFromBufferAttribute(g.getAttribute('position') as BufferAttribute);
  const span = o.by === 'height' ? b.max.y - b.min.y : Math.max(b.max.x - b.min.x, b.max.z - b.min.z), k = o.size / Math.max(1e-6, span);
  g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
  g.scale(k, k, k); g.translate(0, o.floor ?? 0, 0); g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}

/** Drop the triangles whose centroid `cut` says to remove (a part the code model animates instead); disposes the input. */
export function withoutTriangles(g: BufferGeometry, cut: (x: number, y: number, z: number) => boolean): BufferGeometry {
  const p = g.getAttribute('position'), c = g.getAttribute('color'), pos: number[] = [], col: number[] = [];
  for (let t = 0; t + 2 < p.count; t += 3) {
    if (cut((p.getX(t) + p.getX(t + 1) + p.getX(t + 2)) / 3, (p.getY(t) + p.getY(t + 1) + p.getY(t + 2)) / 3, (p.getZ(t) + p.getZ(t + 1) + p.getZ(t + 2)) / 3)) continue;
    for (let v = t; v < t + 3; v++) { pos.push(p.getX(v), p.getY(v), p.getZ(v)); col.push(c.getX(v), c.getY(v), c.getZ(v)); }
  }
  const r = new BufferGeometry(); r.setAttribute('position', new Float32BufferAttribute(pos, 3)); r.setAttribute('color', new Float32BufferAttribute(col, 3));
  r.computeVertexNormals(); r.computeBoundingBox(); r.computeBoundingSphere(); g.dispose(); return r;
}

/** Bind every triangle rigidly to the bone `boneOf` names for its centroid (bone indices in the caller's skeleton order). */
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
 * Averages a facet model's painted colour per vertex position, by `amount` (0 keeps each facet's own shade, 1 the
 * average): facet-painted triangles read as patches; averaged, the paint reads continuous.
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

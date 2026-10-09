import { loadRigFile } from '@wildshard/engine/anim/rig';
import { cacheUntilDisposed, retainCachedResources } from '@wildshard/engine/app/cachedAssets';
import { releaseDecodedOnUpload } from '../look/image';
import { SKY_HD, SKY_MESHES, skyHdUrl, skyMeshUrl, type SkyHdName, type SkyMeshName } from '../boot/files';
import { Box3, BufferGeometry, Float32BufferAttribute, Mesh, MeshStandardMaterial, Uint16BufferAttribute, Uint32BufferAttribute, Vector3, type BufferAttribute, type InterleavedBufferAttribute, type Object3D, type Texture } from 'three';

/**
 * Sky Reach's generated models (C6, E374): codex refs → Hunyuan3D-2 → faceted, vertex-coloured GLBs
 * (`art/far-reach/round-7-models/props.json`, built into `public/assets/far-reach/models/<name>/<name>.glb`). Each is
 * loaded once behind the loading screen (`preloadSkyMeshes`, the plugin's `world` hook) and kept as one flat
 * non-indexed geometry: position, the facet colour (rgb × the baked AO in COLOR_0's alpha) and flat normals. A model
 * that fails to load leaves its code model in place.
 */

const ready = new Map<SkyMeshName, BufferGeometry>();
/** How much of the baked AO survives: a facet in full occlusion keeps this share of its colour. */
const AO_FLOOR = 0.6;
let loading: Promise<void> | null = null;
const isMesh = (o: Object3D): o is Mesh => o instanceof Mesh;

/** One mesh's triangles in world space, de-indexed, as plain float32 (meshopt quantizes the attributes). */
function flatten(mesh: Mesh): { pos: number[]; col: number[] } {
  const g = mesh.geometry, p = g.getAttribute('position'), c = g.hasAttribute('color') ? g.getAttribute('color') : null;
  const index = g.getIndex(), n = index ? index.count : p.count, pos: number[] = [], col: number[] = [], v = new Vector3();
  for (let k = 0; k < n; k++) {
    const i = index ? index.getX(k) : k;
    v.fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld); pos.push(v.x, v.y, v.z);
    // the baked AO (0.35–1) only softly: at full strength the golden-hour toon light turns the cream coats mauve
    const ao = c?.itemSize === 4 ? AO_FLOOR + (1 - AO_FLOOR) * c.getW(i) : 1;
    col.push((c ? c.getX(i) : 1) * ao, (c ? c.getY(i) : 1) * ao, (c ? c.getZ(i) : 1) * ao);
  }
  return { pos, col };
}

async function load(name: SkyMeshName): Promise<void> {
  try {
    const gltf = await loadRigFile(skyMeshUrl(name));
    gltf.scene.updateMatrixWorld(true);
    const pos: number[] = [], col: number[] = [];
    gltf.scene.traverse((o) => { if (isMesh(o)) { const f = flatten(o); pos.push(...f.pos); col.push(...f.col); } });
    if (pos.length === 0) throw new Error(`${name}: no mesh`);
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('color', new Float32BufferAttribute(col, 3));
    g.computeVertexNormals(); g.computeBoundingBox(); retainCachedResources(g); ready.set(name, g);
    cacheUntilDisposed(g, () => { if (ready.get(name) === g) { ready.delete(name); loading = null; } });
  } catch (e: unknown) { console.warn(`[far-reach] ${name} not loaded, the code model stands in:`, e); }
}

/** A textured hero model: one indexed geometry (float position, normal, uv in the file's frame) and its painted map. */
export interface SkyHd { readonly geometry: BufferGeometry; readonly map: Texture }
const hd = new Map<SkyHdName, SkyHd>();
/** A (possibly meshopt-quantized) attribute as plain float32. */
function floats(a: BufferAttribute | InterleavedBufferAttribute): Float32BufferAttribute {
  const out = new Float32Array(a.count * a.itemSize);
  for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = a.getComponent(i, k);
  return new Float32BufferAttribute(out, a.itemSize);
}
async function loadHd(name: SkyHdName): Promise<void> {
  try {
    const gltf = await loadRigFile(skyHdUrl(name));
    gltf.scene.updateMatrixWorld(true);
    const found: SkyHd[] = [];
    gltf.scene.traverse((o) => {
      if (found.length > 0 || !isMesh(o)) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material, src = o.geometry, index = src.getIndex();
      if (!(m instanceof MeshStandardMaterial) || m.map === null || !src.hasAttribute('uv') || index === null) return;
      const g = new BufferGeometry();
      g.setAttribute('position', floats(src.getAttribute('position'))); g.setAttribute('uv', floats(src.getAttribute('uv')));
      g.setIndex(new Uint32BufferAttribute(Uint32Array.from({ length: index.count }, (_, i) => index.getX(i)), 1));
      g.applyMatrix4(o.matrixWorld); g.computeVertexNormals(); g.computeBoundingBox();
      found.push({ geometry: g, map: m.map });
    });
    const one = found[0]; if (one === undefined) throw new Error(`${name}: no textured mesh`);
    // Memory saver: the GLB's decoded atlas goes at its upload. Sky Reach never reads these maps on the CPU, every user
    // shares this one texture (no other sampler key), and the GLB is parsed afresh per visit (no cache keeps the source).
    const atlas: unknown = one.map.image;
    if (typeof ImageBitmap !== 'undefined' && atlas instanceof ImageBitmap) releaseDecodedOnUpload(one.map, () => { atlas.close(); });
    retainCachedResources(one); hd.set(name, one);
    cacheUntilDisposed(one, () => { if (hd.get(name) === one) { hd.delete(name); loading = null; } });
  } catch (e: unknown) { console.warn(`[far-reach] ${name} not loaded, the faceted model stands in:`, e); }
}

/** Load every generated model once (a failed one is skipped). */
export function preloadSkyMeshes(): Promise<void> {
  loading ??= Promise.all([...SKY_MESHES.filter(name => !ready.has(name)).map(load), ...SKY_HD.filter(name => !hd.has(name)).map(loadHd)]).then(() => undefined);
  return loading;
}

/** A textured hero model (a copy of its geometry, its shared map), or null (not loaded: use the faceted model). */
export function skyHd(name: SkyHdName): SkyHd | null { const m = hd.get(name); return m ? { geometry: m.geometry.clone(), map: m.map } : null; }

/** A hero model's matte painted material (no metal, soft roughness, smooth normals). */
export const hdMaterial = (map: Texture): MeshStandardMaterial => new MeshStandardMaterial({ map, roughness: 0.85, metalness: 0 });

/**
 * Split a geometry by triangle centroid, keeping every attribute (position, normal, uv, colour …): [the rest, the
 * triangles `pick` claims]. Indexed input is de-indexed.
 */
export function splitTriangles(source: BufferGeometry, pick: (x: number, y: number, z: number) => boolean): [BufferGeometry, BufferGeometry] {
  const g = source.index === null ? source : source.toNonIndexed(), p = g.getAttribute('position'), names = Object.keys(g.attributes);
  const keep: boolean[] = [];
  for (let t = 0; t + 2 < p.count; t += 3) keep.push(pick((p.getX(t) + p.getX(t + 1) + p.getX(t + 2)) / 3, (p.getY(t) + p.getY(t + 1) + p.getY(t + 2)) / 3, (p.getZ(t) + p.getZ(t + 1) + p.getZ(t + 2)) / 3));
  const make = (side: boolean): BufferGeometry => {
    const r = new BufferGeometry();
    for (const n of names) {
      const a = g.getAttribute(n), out: number[] = [];
      keep.forEach((k, t) => { if (k === side) for (let v = t * 3; v < t * 3 + 3; v++) for (let c = 0; c < a.itemSize; c++) out.push(a.getComponent(v, c)); });
      r.setAttribute(n, new Float32BufferAttribute(out, a.itemSize));
    }
    return r;
  };
  const out: [BufferGeometry, BufferGeometry] = [make(false), make(true)];
  if (g !== source) g.dispose();
  source.dispose(); return out;
}

/** A copy of a loaded model's geometry, or null (not loaded: use the code model). */
export function skyMesh(name: SkyMeshName): BufferGeometry | null { return ready.get(name)?.clone() ?? null; }

/**
 * Fit a loaded model into a frame (turned `pitch` radians about +X first): centred on x / z, its lowest point at `floor` (or its middle at `middle`), scaled so
 * its largest horizontal extent (or its height) is `size` metres. `centre: 'base'` centres it on its footing instead.
 */
export function fit(g: BufferGeometry, o: { size: number; by: 'span' | 'height'; floor?: number; middle?: number; pitch?: number; centre?: 'box' | 'base' }): BufferGeometry {
  if (o.pitch !== undefined) g.rotateX(o.pitch);
  const p = g.getAttribute('position'), b = new Box3().setFromBufferAttribute(p as BufferAttribute);
  if (o.centre === 'base') {
    // a building or a post: centre on its footing (the lowest tenth), not on whatever sticks out above it
    let x = 0, z = 0, n = 0; const top = b.min.y + (b.max.y - b.min.y) * 0.1;
    for (let i = 0; i < p.count; i++) if (p.getY(i) <= top) { x += p.getX(i); z += p.getZ(i); n++; }
    if (n > 0) { const cx = x / n, cz = z / n, hx = Math.max(b.max.x - cx, cx - b.min.x), hz = Math.max(b.max.z - cz, cz - b.min.z); b.min.x = cx - hx; b.max.x = cx + hx; b.min.z = cz - hz; b.max.z = cz + hz; }
  }
  const span = o.by === 'height' ? b.max.y - b.min.y : Math.max(b.max.x - b.min.x, b.max.z - b.min.z), k = o.size / Math.max(1e-6, span);
  g.translate(-(b.min.x + b.max.x) / 2, -(o.middle === undefined ? b.min.y : (b.min.y + b.max.y) / 2), -(b.min.z + b.max.z) / 2);
  g.scale(k, k, k); g.translate(0, o.middle ?? o.floor ?? 0, 0); g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
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

/** Split a flat geometry by triangle centroid: [below `y`, above `y`]. */
export function splitAbove(g: BufferGeometry, y: number): [BufferGeometry, BufferGeometry] {
  const p = g.getAttribute('position'), c = g.getAttribute('color'), out = [{ pos: [] as number[], col: [] as number[] }, { pos: [] as number[], col: [] as number[] }];
  for (let t = 0; t + 2 < p.count; t += 3) {
    const side = out[(p.getY(t) + p.getY(t + 1) + p.getY(t + 2)) / 3 > y ? 1 : 0];
    if (side) for (let v = t; v < t + 3; v++) { side.pos.push(p.getX(v), p.getY(v), p.getZ(v)); side.col.push(c.getX(v), c.getY(v), c.getZ(v)); }
  }
  const make = (part: { pos: number[]; col: number[] } | undefined): BufferGeometry => {
    const r = new BufferGeometry(); r.setAttribute('position', new Float32BufferAttribute(part?.pos ?? [], 3)); r.setAttribute('color', new Float32BufferAttribute(part?.col ?? [], 3));
    r.computeVertexNormals(); return r;
  };
  g.dispose(); return [make(out[0]), make(out[1])];
}

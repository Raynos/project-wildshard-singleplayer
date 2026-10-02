import { loadRigFile } from '#engine';
import { SKY_MESHES, skyMeshUrl, type SkyMeshName } from '../boot/files';
import { Box3, BufferGeometry, Float32BufferAttribute, Mesh, Uint16BufferAttribute, Vector3, type BufferAttribute, type Object3D } from 'three';

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
    g.computeVertexNormals(); g.computeBoundingBox(); ready.set(name, g);
  } catch (e: unknown) { console.warn(`[far-reach] ${name} not loaded, the code model stands in:`, e); }
}

/** Load every generated model once (a failed one is skipped). */
export function preloadSkyMeshes(): Promise<void> {
  loading ??= Promise.all(SKY_MESHES.map(load)).then(() => undefined);
  return loading;
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

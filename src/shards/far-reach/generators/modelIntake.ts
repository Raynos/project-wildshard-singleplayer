import { Box3, BufferGeometry, Float32BufferAttribute, Mesh, MeshStandardMaterial, Uint32BufferAttribute, Vector3, type BufferAttribute, type InterleavedBufferAttribute, type Object3D } from 'three';

/**
 * The offline half of Sky Reach's model intake (SHARD-PLATFORM M3): the bakes (`generators/bridges.ts`, `creatures.ts`,
 * `millModel.ts`) turn loaded GLBs into plain geometry and fit it here. The page loads its facet models through the SDK
 * model library (`world/meshes.ts`); hero normalization and static fitting are emitted as plain GLB accessors.
 * Only the moving vane split remains native.
 *
 * - `facetedGeometry`: every mesh of a scene as one flat non-indexed geometry in world space: position, the facet colour
 *   (rgb × the baked AO in COLOR_0's alpha, kept down to `aoFloor`) and flat normals (the SDK library's facet intake).
 * - `fitModel`: a geometry fitted into a frame (centred, floored or middled, scaled by span or height).
 */

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

/**
 * The faceted intake: every mesh of a loaded scene as one flat geometry (position, the AO-softened facet colour, flat
 * normals), or null with no mesh. `aoFloor`: the share of its colour a facet in full baked occlusion keeps.
 */
export function facetedGeometry(scene: Object3D, aoFloor: number): BufferGeometry | null {
  scene.updateMatrixWorld(true);
  const pos: number[] = [], col: number[] = [];
  scene.traverse((o) => { if (isMesh(o)) { const f = flatten(o, aoFloor); pos.push(...f.pos); col.push(...f.col); } });
  if (pos.length === 0) return null;
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.computeVertexNormals(); g.computeBoundingBox(); return g;
}

/** How `fitModel` frames a geometry (see there). */
export interface ModelFrame {
  readonly size: number;
  readonly by: 'span' | 'height';
  readonly floor?: number;
  readonly middle?: number;
  readonly pitch?: number;
  readonly centre?: 'box' | 'base';
}

/**
 * Fit a loaded model into a frame (turned `pitch` radians about +X first): centred on x / z, its lowest point at `floor` (or
 * its middle at `middle`), scaled so its largest horizontal extent (or its height) is `size` metres. `centre: 'base'`
 * centres it on its footing (the lowest tenth) instead. Moves the geometry in place and returns it. Without `pitch` and
 * `middle` it is the SDK's `fitGeometry` (`@wildshard/sdk/looks/modelLibrary`), which the page uses.
 */
export function fitModel(g: BufferGeometry, o: ModelFrame): BufferGeometry {
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

/** A (possibly meshopt-quantized) attribute as plain float32. */
function floats(a: BufferAttribute | InterleavedBufferAttribute): Float32BufferAttribute {
  const out = new Float32Array(a.count * a.itemSize);
  for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = a.getComponent(i, k);
  return new Float32BufferAttribute(out, a.itemSize);
}

/**
 * The textured intake: the first indexed, UV-mapped mesh whose material `painted` accepts, as float position + uv in the
 * file's frame with smooth normals, and its material; or null.
 */
export function hdGeometry(scene: Object3D, painted: (material: MeshStandardMaterial) => boolean): { geometry: BufferGeometry; material: MeshStandardMaterial } | null {
  scene.updateMatrixWorld(true);
  let found: { geometry: BufferGeometry; material: MeshStandardMaterial } | null = null;
  scene.traverse((o) => {
    if (found !== null || !isMesh(o)) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material, src = o.geometry, index = src.getIndex();
    if (!(m instanceof MeshStandardMaterial) || !painted(m) || !src.hasAttribute('uv') || index === null) return;
    const g = new BufferGeometry();
    g.setAttribute('position', floats(src.getAttribute('position'))); g.setAttribute('uv', floats(src.getAttribute('uv')));
    g.setIndex(new Uint32BufferAttribute(Uint32Array.from({ length: index.count }, (_, i) => index.getX(i)), 1));
    g.applyMatrix4(o.matrixWorld); g.computeVertexNormals(); g.computeBoundingBox();
    found = { geometry: g, material: m };
  });
  return found;
}


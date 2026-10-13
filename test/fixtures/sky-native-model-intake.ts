// Frozen C1 oracle: native intake at 0522ccf58; never used by shipping code.
import { BufferGeometry, Float32BufferAttribute, Mesh, MeshStandardMaterial, Uint32BufferAttribute, type BufferAttribute, type InterleavedBufferAttribute, type Object3D } from 'three';

/**
 * The page's half of Sky Reach's model intake (SHARD-PLATFORM M3; ex world/meshes.ts helpers): the textured hero models
 * as one plain indexed geometry each, and the vane's split. The facet models load through the SDK model library
 * (`world/meshes.ts`), the copies are fitted with the SDK's `fitGeometry`, and the bakes' faceted intake and fitting live in
 * `generators/modelIntake.ts`. Nothing here knows a shard or a file.
 *
 * - `hdGeometry`: the first indexed, UV-mapped mesh a predicate accepts, as float position + uv with smooth normals.
 * - `splitAbove`: a flat vertex-coloured geometry split by triangle centroid.
 */

const isMesh = (o: Object3D): o is Mesh => o instanceof Mesh;

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



/** Split a flat vertex-coloured geometry by triangle centroid: [below `y`, above `y`], each with flat normals; disposes the input. */
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

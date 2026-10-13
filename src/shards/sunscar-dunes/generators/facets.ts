import { Box3, BufferGeometry, Float32BufferAttribute, Mesh, Uint16BufferAttribute, Vector3, type BufferAttribute, type Object3D } from 'three';
import { readSourceModel } from '@wildshard/sdk/bake/skinned';
import type { ModelFit } from '../data/hulls';

/**
 * Build-time only (G320): the model library's facet intake, authored for the rig bake (`bake-signal-rigs.mjs`), so the bake
 * reads its generated models from the retained authoring copies (`assets/models/`) with no game module and no public/
 * file. `facetModel` is the library's `mesh` (every mesh of the GLB, through three's GLTFLoader and the meshopt decoder,
 * as one flat world-space soup: position, the facet colour times its baked AO kept down to `aoFloor`, flat normals);
 * `fitGeometry` and `bindRigid` are the library's own. test/signal-rigs-authoring.test.ts keeps each bit-equal to the
 * library (`@wildshard/sdk/looks/modelLibrary`) over the public copies.
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

/** A generated facet model's GLB bytes as the model library takes it in: one flat geometry (position, colour, normal). */
export async function facetModel(bytes: Uint8Array, aoFloor: number): Promise<BufferGeometry> {
  const { gltf } = await readSourceModel(bytes);
  gltf.scene.updateMatrixWorld(true);
  const pos: number[] = [], col: number[] = [];
  gltf.scene.traverse((o) => { if (isMesh(o)) { const f = flatten(o, aoFloor); pos.push(...f.pos); col.push(...f.col); } });
  if (pos.length === 0) throw new Error('facet model: no mesh');
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.computeVertexNormals(); g.computeBoundingBox();
  return g;
}

/** Fit a geometry into a frame (turned `yaw` radians about +Y first): centred on x / z, its lowest point at `floor`, scaled to `size`. */
export function fitGeometry(g: BufferGeometry, o: ModelFit): BufferGeometry {
  if (o.yaw !== undefined) g.rotateY(o.yaw);
  const p = g.getAttribute('position'), b = new Box3().setFromBufferAttribute(p as BufferAttribute);
  if (o.centre === 'base') {
    let x = 0, z = 0, n = 0; const top = b.min.y + (b.max.y - b.min.y) * 0.1;
    for (let i = 0; i < p.count; i++) if (p.getY(i) <= top) { x += p.getX(i); z += p.getZ(i); n++; }
    if (n > 0) { const cx = x / n, cz = z / n, hx = Math.max(b.max.x - cx, cx - b.min.x), hz = Math.max(b.max.z - cz, cz - b.min.z); b.min.x = cx - hx; b.max.x = cx + hx; b.min.z = cz - hz; b.max.z = cz + hz; }
  }
  const span = o.by === 'height' ? b.max.y - b.min.y : Math.max(b.max.x - b.min.x, b.max.z - b.min.z), k = o.size / Math.max(1e-6, span);
  g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
  g.scale(k, k, k); g.translate(0, o.floor ?? 0, 0); g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
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


/** The dry well's retained triangles: same centroid cut and float32 normal reconstruction as the released native builder. */
export function wellShell(source: BufferGeometry): BufferGeometry {
  const fitted = fitGeometry(source, { size: 3.4, by: 'span' }), maxX = fitted.boundingBox?.max.x ?? 2;
  const p = fitted.getAttribute('position'), c = fitted.getAttribute('color'), pos: number[] = [], col: number[] = [];
  for (let t = 0; t + 2 < p.count; t += 3) {
    const x = (p.getX(t) + p.getX(t + 1) + p.getX(t + 2)) / 3, y = (p.getY(t) + p.getY(t + 1) + p.getY(t + 2)) / 3, z = (p.getZ(t) + p.getZ(t + 1) + p.getZ(t + 2)) / 3;
    if (x > maxX - 0.3 || (Math.hypot(x, z) < 0.5 && y > 0.75 && y < 1.95)) continue;
    for (let v = t; v < t + 3; v++) { pos.push(p.getX(v), p.getY(v), p.getZ(v)); col.push(c.getX(v), c.getY(v), c.getZ(v)); }
  }
  const result = new BufferGeometry().setAttribute('position', new Float32BufferAttribute(pos, 3)).setAttribute('color', new Float32BufferAttribute(col, 3));
  result.computeVertexNormals(); result.computeBoundingBox(); result.computeBoundingSphere(); fitted.dispose(); return result;
}

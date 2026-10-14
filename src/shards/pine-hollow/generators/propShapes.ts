/** Original scan rest shapes and native contact facts, authored once into the Pine Scene. */
import * as THREE from 'three';
import { deinterleaveGeometry } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BakedPiece } from '@wildshard/sdk/bake';

export interface PineScanPart { geometry: THREE.BufferGeometry; matrix: THREE.Matrix4 }
interface ShapeRow { name: string; hull: number[]; sphere: [number, number, number, number] }
interface CapsuleRow { kind: 'capsule'; x: number; y: number; z: number; halfHeight: number; radius: number; rot: { x: number; y: number; z: number; w: number } }
export interface PinePropShapes { piece: BakedPiece; rows: { rocks: ShapeRow[]; stumps: ShapeRow[]; log: { parts: ShapeRow[]; capsule: CapsuleRow } } }

const DIRS: number[] = (() => {
  const p = new THREE.IcosahedronGeometry(1, 2).getAttribute('position'), seen = new Set<string>(), out: number[] = [];
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(4)},${p.getY(i).toFixed(4)},${p.getZ(i).toFixed(4)}`;
    if (!seen.has(key)) { seen.add(key); out.push(p.getX(i), p.getY(i), p.getZ(i)); }
  }
  return out;
})();

/** the support points of `g` under `m` (x, y, z each) */
function supportPoints(g: THREE.BufferGeometry, m: THREE.Matrix4): Float32Array {
  const pos = g.getAttribute('position'), v = new THREE.Vector3(), pts: number[] = [];
  for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(m); pts.push(v.x, v.y, v.z); }
  const picked = new Set<number>();
  for (let d = 0; d < DIRS.length; d += 3) {
    const dx = DIRS[d] ?? 0, dy = DIRS[d + 1] ?? 0, dz = DIRS[d + 2] ?? 0;
    let best = -Infinity, at = 0;
    for (let i = 0; i < pts.length; i += 3) { const s = (pts[i] ?? 0) * dx + (pts[i + 1] ?? 0) * dy + (pts[i + 2] ?? 0) * dz; if (s > best) { best = s; at = i; } }
    picked.add(at);
  }
  const out = new Float32Array(picked.size * 3);
  let k = 0;
  for (const i of picked) { out[k++] = pts[i] ?? 0; out[k++] = pts[i + 1] ?? 0; out[k++] = pts[i + 2] ?? 0; }
  return out;
}

/**
 * Bake a part's transform into its geometry (its own space), keeping the bounding sphere the old per-instance culling
 * used: the raw geometry's sphere under the same transform (three would re-fit it to the moved vertices).
 */
function bakePart(g: THREE.BufferGeometry, m: THREE.Matrix4): THREE.BufferGeometry {
  g.computeBoundingSphere(); // from the vertices (a glTF's own bounds are its accessors' min / max)
  const sphere = (g.boundingSphere ?? new THREE.Sphere()).clone().applyMatrix4(m);
  g.applyMatrix4(m);
  g.boundingSphere = sphere;
  return g;
}

/** One library shape per original scan part; materials stay on their native loader. */
export function pinePropShapes(scans: { rocks: readonly PineScanPart[]; stumps: readonly PineScanPart[]; logs: readonly PineScanPart[] }): PinePropShapes {
  const piece = new BakedPiece('pine.props', [], [], { nativeAttributes: true, compactIndex: true,
    nodeExtras: (kind, mesh) => {
      const geometry = mesh.geometry, count = geometry.getAttribute('position').count, index = geometry.getIndex();
      return { wholePartition: { id: kind, vertexCount: count, indexCount: index?.count ?? 0,
        index: index === null ? 'none' : index.array instanceof Uint16Array ? 'u16' : 'u32',
        vertices: { runs: [0, count] }, triangles: { runs: [0, (index?.count ?? count) / 3] } } };
    } });
  const material = new THREE.MeshStandardMaterial({ roughness: 1 }); material.name = 'pine.props';
  const rest = (part: PineScanPart, matrix: THREE.Matrix4, name: string): ShapeRow => {
    const hull = [...supportPoints(part.geometry, matrix)], geometry = bakePart(part.geometry, matrix);
    deinterleaveGeometry(geometry);
    const sphere = geometry.boundingSphere;
    if (sphere === null) throw new Error('Authored scan omitted native sphere');
    const mesh = new THREE.InstancedMesh(geometry, material, 1); mesh.setMatrixAt(0, new THREE.Matrix4()); mesh.name = name; piece.add(mesh);
    return { name, hull, sphere: [sphere.center.x, sphere.center.y, sphere.center.z, sphere.radius] };
  };
  const rocks = scans.rocks.map((part, i) => {
    part.geometry.computeBoundingBox(); const box = part.geometry.boundingBox;
    if (box === null) throw new Error('Authored rock omitted bounds');
    const centre = box.getCenter(new THREE.Vector3());
    return rest(part, new THREE.Matrix4().makeTranslation(-centre.x, -box.min.y, -centre.z), `pine.props.rock.${i}`);
  });
  const stumps = scans.stumps.map((part, i) => rest(part, part.matrix, `pine.props.stump.${i}`));
  const first = scans.logs[0]; if (first === undefined) throw new Error('Authored log omitted original part');
  first.geometry.computeBoundingBox(); const box = first.geometry.boundingBox;
  if (box === null) throw new Error('Authored log omitted bounds');
  const halfLen = (box.max.x - box.min.x) / 2, centre = box.getCenter(new THREE.Vector3()), pos = first.geometry.getAttribute('position');
  let rSum = 0, rN = 0;
  for (let i = 0; i < pos.count; i++) {
    if (Math.abs(pos.getX(i) - centre.x) > halfLen * 0.8) continue;
    rSum += Math.hypot(pos.getY(i) - centre.y, pos.getZ(i) - centre.z); rN++;
  }
  const radius = rN > 0 ? rSum / rN : Math.min(box.max.y - box.min.y, box.max.z - box.min.z) / 2;
  const origin = new THREE.Vector3(), q = new THREE.Quaternion(), scale = new THREE.Vector3(); first.matrix.decompose(origin, q, scale);
  const c = centre.clone().applyMatrix4(first.matrix), axis = new THREE.Vector3(1, 0, 0).applyQuaternion(q), r = radius * scale.x;
  const rot = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
  const capsule: CapsuleRow = { kind: 'capsule', x: c.x, y: c.y, z: c.z, halfHeight: Math.max(0.05, halfLen * scale.x - r), radius: r, rot: { x: rot.x, y: rot.y, z: rot.z, w: rot.w } };
  const parts = scans.logs.map((part, i) => rest(part, part.matrix, `pine.props.log.${i}`));
  return { piece, rows: { rocks, stumps, log: { parts, capsule } } };
}

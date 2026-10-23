import * as THREE from 'three';
import { smoothstep } from '../core/noise';

/** Client-only bounded scatter drawing. Placement, colour, range and collision ownership remain authored data. */
export interface ScatterPose {
  x: number; y: number; z: number;
  yaw: number;
  sx: number; sy: number; sz: number;
  /** lean (radians) about x / z — rocks settling into a slope, a tilted clump */
  tiltX?: number; tiltZ?: number;
  /** Optional solid source marker; collision is registered separately. */
  solid?: true;
  /** metres: this instance's draw distance (before the tier scale) */
  far: number;
  /** linear RGB multiplier (instanceColor) */
  r: number; g: number; b: number;
}

export interface ScatterSource {
  version: 1; count: number; matrices: Float32Array; colours: Float32Array; spheres: Float32Array; ranges: Float32Array;
  cellSize: number; keepNear: number; fadeStart: number; rangeScale: number;
}

export interface ScatterLayer { name: string; mesh: THREE.InstancedMesh; count: number; cull: (frustum: THREE.Frustum, viewer: THREE.Vector3) => void; readonly visible: number; readonly tris: number }
const sourceLayers = new WeakMap<THREE.Object3D, ScatterSource>();
/** Copy original placement rows only when the offline map inventory requests them. */
export function captureScatterSource(mesh: THREE.Object3D): ScatterSource | undefined {
  const source = sourceLayers.get(mesh);
  return source === undefined ? undefined : { ...source, matrices: source.matrices.slice(), colours: source.colours.slice(), spheres: source.spheres.slice(), ranges: source.ranges.slice() };
}

export function scatterLayer(name: string, geometry: THREE.BufferGeometry, material: THREE.Material, list: ScatterPose[], farScale: number, castShadow = false, keepNear = 26): ScatterLayer {
  if (list.length > 1_000_000 || !Number.isFinite(farScale) || farScale <= 0 || !Number.isFinite(keepNear) || keepNear < 0
    || list.some(row => ![row.x,row.y,row.z,row.yaw,row.sx,row.sy,row.sz,row.far,row.r,row.g,row.b,row.tiltX??0,row.tiltZ??0].every(Number.isFinite) || row.far<0 || row.far*farScale>2000)) throw new Error('Invalid scatter rows');
  geometry.computeBoundingSphere();
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, list.length));
  mesh.name = name; mesh.frustumCulled = false; mesh.castShadow = castShadow; mesh.receiveShadow = true;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, list.length) * 3), 3);
  mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  const matrices = new Float32Array(list.length * 16), colours = new Float32Array(list.length * 3), spheres = new Float32Array(list.length * 4), ranges = new Float32Array(list.length);
  const transform = new THREE.Matrix4(), rotation = new THREE.Quaternion(), angles = new THREE.Euler(), point = new THREE.Vector3(), scale = new THREE.Vector3(), sphere = new THREE.Sphere();
  list.forEach((it, i) => {
    transform.compose(point.set(it.x, it.y, it.z), rotation.setFromEuler(angles.set(it.tiltX ?? 0, it.yaw, it.tiltZ ?? 0, 'YXZ')), scale.set(it.sx, it.sy, it.sz)).toArray(matrices, i * 16);
    colours.set([it.r, it.g, it.b], i * 3); spheres.set([it.x, it.y, it.z, (geometry.boundingSphere?.radius ?? 1) * Math.max(it.sx, it.sy, it.sz)], i * 4); ranges[i] = it.far * farScale;
  });
  // 24 m cells, each with the box round its instances' spheres and the xz bounds of their centres: a cell wholly past
  // keepNear and outside the frustum skips its instances in one test (G639: per-instance sphere tests and string-keyed
  // cell reads were ~2 ms of a Nalati look frame at phone 4x). Cells list in the old window's order, nearest first.
  const buckets = new Map<string, { cx: number; cz: number; members: number[] }>();
  list.forEach((it, i) => {
    const cx = Math.floor(it.x / 24), cz = Math.floor(it.z / 24), key = `${cx},${cz}`, bucket = buckets.get(key);
    if (bucket === undefined) buckets.set(key, { cx, cz, members: [i] }); else bucket.members.push(i);
  });
  const cells = [...buckets.values()].sort((a, b) => a.cz - b.cz || a.cx - b.cx).map(({ cx, cz, members }) => {
    const box = new THREE.Box3();
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const i of members) {
      const x = spheres[i * 4] ?? 0, y = spheres[i * 4 + 1] ?? 0, z = spheres[i * 4 + 2] ?? 0, r = spheres[i * 4 + 3] ?? 1;
      box.expandByPoint(point.set(x - r, y - r, z - r)).expandByPoint(point.set(x + r, y + r, z + r));
      x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z);
    }
    return { cx, cz, members: Int32Array.from(members), box, x0, z0, x1, z1, d2: 0 };
  });
  const near: (typeof cells)[number][] = [];
  const reach = ranges.reduce((far, value) => Math.max(far, value), 0);
  const cull = (frustum: THREE.Frustum, viewer: THREE.Vector3): void => {
    let n = 0;
    near.length = 0;
    for (const cell of cells) {
      const dx = Math.max(0, cell.cx * 24 - viewer.x, viewer.x - (cell.cx + 1) * 24), dz = Math.max(0, cell.cz * 24 - viewer.z, viewer.z - (cell.cz + 1) * 24);
      cell.d2 = dx * dx + dz * dz;
      if (cell.d2 > reach * reach) continue;
      const ex = Math.max(0, cell.x0 - viewer.x, viewer.x - cell.x1), ez = Math.max(0, cell.z0 - viewer.z, viewer.z - cell.z1);
      if (ex * ex + ez * ez > keepNear * keepNear && !frustum.intersectsBox(cell.box)) continue;
      near.push(cell);
    }
    near.sort((a, b) => a.d2 - b.d2);
    for (const cell of near) for (const i of cell.members) {
      const far = ranges[i] ?? 0, d2 = ((spheres[i * 4] ?? 0) - viewer.x) ** 2 + ((spheres[i * 4 + 2] ?? 0) - viewer.z) ** 2;
      if (d2 > far * far) continue;
      sphere.center.set(spheres[i * 4] ?? 0, spheres[i * 4 + 1] ?? 0, spheres[i * 4 + 2] ?? 0); sphere.radius = spheres[i * 4 + 3] ?? 1;
      if (d2 > keepNear * keepNear && !frustum.intersectsSphere(sphere)) continue;
      const fade = smoothstep(far, far * 0.82, Math.sqrt(d2)), out = mesh.instanceMatrix.array;
      for (let q = 0; q < 16; q++) out[n * 16 + q] = (matrices[i * 16 + q] ?? 0) * (q < 11 && (q & 3) !== 3 ? fade : 1);
      mesh.instanceColor?.setXYZ(n, colours[i * 3] ?? 1, colours[i * 3 + 1] ?? 1, colours[i * 3 + 2] ?? 1); n++;
    }
    mesh.count = n; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor !== null) mesh.instanceColor.needsUpdate = true;
  };
  sourceLayers.set(mesh, { version: 1, count: list.length, matrices, colours, spheres, ranges, cellSize: 24, keepNear, fadeStart: 0.82, rangeScale: farScale });
  const tris = (geometry.index?.count ?? geometry.getAttribute('position').count) / 3;
  mesh.count = 0;
  return { name, mesh, count: list.length, cull, get visible() { return mesh.count; }, get tris() { return mesh.count * tris; } };
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _b = new THREE.Box3();

/** each instance's world box (6 floats: min xyz, max xyz): its layer's geometry box at the instance's transform */
export function instanceBoxes(geometry: THREE.BufferGeometry, list: readonly ScatterPose[]): Float32Array {
  if (geometry.boundingBox === null) geometry.computeBoundingBox();
  const bb = geometry.boundingBox ?? new THREE.Box3();
  const out = new Float32Array(list.length * 6);
  list.forEach((it, i) => {
    _m.compose(_p.set(it.x, it.y, it.z), _q.setFromEuler(_e.set(it.tiltX ?? 0, it.yaw, it.tiltZ ?? 0, 'YXZ')), _s.set(it.sx, it.sy, it.sz));
    _b.copy(bb).applyMatrix4(_m);
    out.set([_b.min.x, _b.min.y, _b.min.z, _b.max.x, _b.max.y, _b.max.z], i * 6);
  });
  return out;
}

/**
 * A placement's pose, and a model's own-space colliders carried to it (E306, ./model.ts step 2): the model owns its
 * colliders in its own space; `place` turns them into world-space `ColliderDesc`s per copy. Engine-neutral data, as
 * everywhere else: src/engine/physics/pieces.ts makes the Rapier colliders.
 */
import * as THREE from 'three';
import type { ColliderDesc } from '../world/registry';
import type { Placement } from './model';

/** one copy's transform: the matrix, and its rotation and uniform scale taken apart once */
export interface Pose {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly matrix: THREE.Matrix4;
  readonly quat: THREE.Quaternion;
  readonly scale: number;
  /** no rotation at all (the colliders keep their own yaw exactly) */
  readonly upright: boolean;
}

const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _q = new THREE.Quaternion();

/** The pose of a placement: scale, yaw, lean X, lean Z, then the position (or its matrix). */
export function poseOf(pl: Placement<object>): Pose {
  const matrix = new THREE.Matrix4();
  if (pl.matrix === undefined) {
    const s = pl.scale ?? 1;
    matrix.makeScale(s, s, s);
    if (pl.yaw !== undefined) matrix.premultiply(_m.makeRotationY(pl.yaw));
    if (pl.leanX !== undefined) matrix.premultiply(_m.makeRotationX(pl.leanX));
    if (pl.leanZ !== undefined) matrix.premultiply(_m.makeRotationZ(pl.leanZ));
    matrix.premultiply(_m.makeTranslation(pl.x, pl.y, pl.z));
  } else matrix.copy(pl.matrix);
  const quat = new THREE.Quaternion();
  matrix.decompose(_p, quat, _s);
  const upright = pl.matrix === undefined ? (pl.yaw ?? 0) === 0 && (pl.leanX ?? 0) === 0 && (pl.leanZ ?? 0) === 0 : Math.abs(quat.w) > 1 - 1e-12;
  return { x: pl.x, y: pl.y, z: pl.z, matrix, quat, scale: _s.x, upright };
}

/**
 * A copy's geometry posed into the world the way the old builders did it, step by step (scale, rotateY, rotateX,
 * rotateZ, translate) — so a merged model is bit-identical to the loop it replaced. A `matrix` placement applies once.
 */
export function poseGeometry(g: THREE.BufferGeometry, pl: Placement<object>): void {
  if (pl.matrix !== undefined) { g.applyMatrix4(pl.matrix); return; }
  if (pl.scale !== undefined && pl.scale !== 1) g.scale(pl.scale, pl.scale, pl.scale);
  if (pl.yaw !== undefined) g.rotateY(pl.yaw);
  if (pl.leanX !== undefined) g.rotateX(pl.leanX);
  if (pl.leanZ !== undefined) g.rotateZ(pl.leanZ);
  g.translate(pl.x, pl.y, pl.z);
}

const scaled = (a: Float32Array, s: number): Float32Array => (s === 1 ? a : a.map((v) => v * s));

/** one own-space collider at a copy's pose, in world space */
export function placeCollider(d: ColliderDesc, pose: Pose): ColliderDesc {
  const s = pose.scale;
  if (d.kind === 'treads') {
    const from = _p.set(d.from.x, d.from.y, d.from.z).applyMatrix4(pose.matrix);
    const f = { x: from.x, y: from.y, z: from.z };
    const to = _p.set(d.to.x, d.to.y, d.to.z).applyMatrix4(pose.matrix);
    return { ...d, from: f, to: { x: to.x, y: to.y, z: to.z }, width: d.width * s };
  }
  const c = _p.set(d.x, d.y, d.z).applyMatrix4(pose.matrix);
  const at = { x: c.x, y: c.y, z: c.z };
  // the rotation: the pose's, then the collider's own (its `rot`, or its `yaw`)
  let turn: Pick<ColliderDesc & { kind: 'box' }, 'yaw' | 'rot'>;
  if (pose.upright) turn = d.rot === undefined ? (d.yaw === undefined ? {} : { yaw: d.yaw }) : { rot: d.rot };
  else {
    if (d.rot !== undefined) _q.set(d.rot.x, d.rot.y, d.rot.z, d.rot.w);
    else _q.setFromAxisAngle(_s.set(0, 1, 0), d.yaw ?? 0);
    _q.premultiply(pose.quat);
    turn = Math.abs(_q.x) < 1e-9 && Math.abs(_q.z) < 1e-9 ? { yaw: 2 * Math.atan2(_q.y, _q.w) } : { rot: { x: _q.x, y: _q.y, z: _q.z, w: _q.w } };
  }
  const surface = d.surface === undefined ? {} : { surface: d.surface };
  switch (d.kind) {
    case 'box': return { kind: 'box', ...at, hx: d.hx * s, hy: d.hy * s, hz: d.hz * s, ...turn, ...surface };
    case 'capsule': return { kind: 'capsule', ...at, halfHeight: d.halfHeight * s, radius: d.radius * s, ...turn, ...surface };
    case 'ball': return { kind: 'ball', ...at, radius: d.radius * s, ...turn, ...surface };
    case 'hull': return { kind: 'hull', ...at, points: scaled(d.points, s), ...turn, ...surface };
    case 'trimesh': return { kind: 'trimesh', ...at, vertices: scaled(d.vertices, s), indices: d.indices, ...turn, ...surface };
    default: return d;
  }
}

/**
 * `{ kind: 'drawn-hull' }` for a copy whose geometry is already posed in the world (the merged path): the hull of the
 * vertices it draws, relative to its placement's position — exactly what the old builders registered.
 */
export function drawnHullWorld(geos: readonly THREE.BufferGeometry[], pose: Pose): ColliderDesc {
  let n = 0;
  for (const g of geos) n += g.getAttribute('position').count;
  const pts = new Float32Array(n * 3);
  let o = 0;
  for (const g of geos) {
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++, o++) { pts[o * 3] = p.getX(i) - pose.x; pts[o * 3 + 1] = p.getY(i) - pose.y; pts[o * 3 + 2] = p.getZ(i) - pose.z; }
  }
  return { kind: 'hull', x: pose.x, y: pose.y, z: pose.z, points: pts };
}

/** `{ kind: 'drawn-hull' }` for a copy drawn from own-space geometry (instanced / batched / single): scaled, turned by `rot` */
export function drawnHullOwn(geos: readonly THREE.BufferGeometry[], pose: Pose): ColliderDesc {
  let n = 0;
  for (const g of geos) n += g.getAttribute('position').count;
  const pts = new Float32Array(n * 3);
  let o = 0;
  for (const g of geos) {
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++, o++) { pts[o * 3] = p.getX(i) * pose.scale; pts[o * 3 + 1] = p.getY(i) * pose.scale; pts[o * 3 + 2] = p.getZ(i) * pose.scale; }
  }
  const q = pose.quat;
  return { kind: 'hull', x: pose.x, y: pose.y, z: pose.z, points: pts, ...(pose.upright ? {} : { rot: { x: q.x, y: q.y, z: q.z, w: q.w } }) };
}

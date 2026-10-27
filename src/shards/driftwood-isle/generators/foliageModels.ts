import { Matrix4, Quaternion, Vector3 } from 'three';
import type { ColliderDesc } from '@wildshard/engine/world/registry';

export interface PalmParams { readonly h: number; readonly lean: number; readonly leanDir: number; readonly rot: number; readonly fronds: number }
export interface HibiscusBushParams { readonly r: number; readonly flowers: boolean; readonly phase: number }
export const palm: { id: string; seed: number; defaults: { h: number; lean: number; leanDir: number; rot: number; fronds: number; }; variants: ({ id: string; label: string; params: { h?: never; lean?: never; fronds?: never; }; } | { id: string; label: string; params: { h: number; lean: number; fronds: number; }; })[]; } = { id: 'driftwood-isle/palm', seed: 0x5ea1 ^ 0x9a,
  defaults: { h: 8, lean: 0.2, leanDir: 0, rot: 0, fronds: 11 }, variants: [
    { id: 'tall', label: 'Tall', params: {} }, { id: 'young', label: 'Young', params: { h: 5.5, lean: 0.1, fronds: 9 } },
    { id: 'leaning', label: 'Leaning', params: { h: 9.5, lean: 0.35, fronds: 13 } },
  ] };
export const hibiscusBush: { id: string; seed: number; defaults: { r: number; flowers: boolean; phase: number; }; variants: ({ id: string; label: string; params: { flowers?: never; r?: never; }; } | { id: string; label: string; params: { flowers: boolean; r?: never; }; } | { id: string; label: string; params: { r: number; flowers?: never; }; })[]; } = { id: 'driftwood-isle/hibiscus-bush', seed: 0x5ea1 ^ 0xb5 ^ 0xe116,
  defaults: { r: 1.3, flowers: true, phase: 0 }, variants: [
    { id: 'flowering', label: 'In flower', params: {} }, { id: 'leaf', label: 'Leaf only', params: { flowers: false } },
    { id: 'small', label: 'Small', params: { r: 0.8 } },
  ] };

/** Original bent trunk contacts, evaluated only by the author job. */
export function palmColliders(p: PalmParams): ColliderDesc[] {
  const axis = (t: number): Vector3 => { const off = p.lean * p.h * (t * t - 0.12 * Math.sin(t * Math.PI)); return new Vector3(Math.cos(p.leanDir) * off, p.h * t, Math.sin(p.leanDir) * off); };
  const out: ColliderDesc[] = [], cuts = [0, 1 / 3, 2 / 3, 1];
  for (let k = 0; k < 3; k++) {
    const t0 = cuts[k] ?? 0, t1 = cuts[k + 1] ?? 1, p0 = axis(t0), p1 = axis(t1);
    if (k === 0) p0.y -= 0.3;
    const along = p1.clone().sub(p0), len = along.length(), radius = 0.3 * (1 - t0 * 0.45);
    const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), along.divideScalar(len));
    out.push({ kind: 'capsule', x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2, z: (p0.z + p1.z) / 2, halfHeight: len / 2, radius, rot: { x: q.x, y: q.y, z: q.z, w: q.w } });
  }
  return out;
}

/** A copy's placement: its position and either its pose (scale, yaw, lean X, lean Z) or a full matrix. */
export interface FoliagePlacement {
  readonly x: number; readonly y: number; readonly z: number; readonly yaw?: number; readonly leanX?: number; readonly leanZ?: number;
  readonly scale?: number; readonly matrix?: Matrix4;
}
/** One copy's transform: the matrix, and its rotation and uniform scale taken apart once. */
export interface FoliagePose {
  readonly x: number; readonly y: number; readonly z: number; readonly matrix: Matrix4; readonly quat: Quaternion; readonly scale: number;
  /** no rotation at all (the colliders keep their own yaw exactly) */
  readonly upright: boolean;
}
const poseMatrix = new Matrix4(), posePoint = new Vector3(), poseScale = new Vector3(), poseTurn = new Quaternion();

/** The pose of a placement, built exactly as the engine's `poseOf` builds it (engine/models/colliders.ts), so the foliage
 *  bank needs no runtime import; test/driftwood-foliage-pose.test.ts fences the two against each other. */
export function foliagePose(pl: FoliagePlacement): FoliagePose {
  const matrix = new Matrix4();
  if (pl.matrix === undefined) {
    const s = pl.scale ?? 1;
    matrix.makeScale(s, s, s);
    if (pl.yaw !== undefined) matrix.premultiply(poseMatrix.makeRotationY(pl.yaw));
    if (pl.leanX !== undefined) matrix.premultiply(poseMatrix.makeRotationX(pl.leanX));
    if (pl.leanZ !== undefined) matrix.premultiply(poseMatrix.makeRotationZ(pl.leanZ));
    matrix.premultiply(poseMatrix.makeTranslation(pl.x, pl.y, pl.z));
  } else matrix.copy(pl.matrix);
  const quat = new Quaternion();
  matrix.decompose(posePoint, quat, poseScale);
  const upright = pl.matrix === undefined ? (pl.yaw ?? 0) === 0 && (pl.leanX ?? 0) === 0 && (pl.leanZ ?? 0) === 0 : Math.abs(quat.w) > 1 - 1e-12;
  return { x: pl.x, y: pl.y, z: pl.z, matrix, quat, scale: poseScale.x, upright };
}

const scaled = (a: Float32Array, s: number): Float32Array => (s === 1 ? a : a.map(v => v * s));
/** One own-space collider at a copy's pose, in world space, exactly as the engine's `placeCollider` places it. */
export function placeFoliageCollider(d: ColliderDesc, pose: FoliagePose): ColliderDesc {
  const s = pose.scale;
  if (d.kind === 'treads') {
    const from = posePoint.set(d.from.x, d.from.y, d.from.z).applyMatrix4(pose.matrix);
    const f = { x: from.x, y: from.y, z: from.z };
    const to = posePoint.set(d.to.x, d.to.y, d.to.z).applyMatrix4(pose.matrix);
    return { ...d, from: f, to: { x: to.x, y: to.y, z: to.z }, width: d.width * s };
  }
  const c = posePoint.set(d.x, d.y, d.z).applyMatrix4(pose.matrix);
  const at = { x: c.x, y: c.y, z: c.z };
  // the rotation: the pose's, then the collider's own (its `rot`, or its `yaw`)
  let turn: Pick<ColliderDesc & { kind: 'box' }, 'yaw' | 'rot'>;
  if (pose.upright) turn = d.rot === undefined ? (d.yaw === undefined ? {} : { yaw: d.yaw }) : { rot: d.rot };
  else {
    if (d.rot !== undefined) poseTurn.set(d.rot.x, d.rot.y, d.rot.z, d.rot.w);
    else poseTurn.setFromAxisAngle(poseScale.set(0, 1, 0), d.yaw ?? 0);
    poseTurn.premultiply(pose.quat);
    turn = Math.abs(poseTurn.x) < 1e-9 && Math.abs(poseTurn.z) < 1e-9 ? { yaw: 2 * Math.atan2(poseTurn.y, poseTurn.w) } : { rot: { x: poseTurn.x, y: poseTurn.y, z: poseTurn.z, w: poseTurn.w } };
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

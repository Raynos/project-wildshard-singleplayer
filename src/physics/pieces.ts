/**
 * A registered piece's `ColliderDesc`s (src/world/registry.ts) as Rapier colliders — the one place engine-neutral
 * collider data becomes Rapier (PHYSICS.md P2b). Each collider is tagged with its material and the piece as owner, so
 * a query hit knows it touched "the hut, planks".
 */
import type { Collider, ColliderDesc as RapierDesc, RigidBody } from '@dimforge/rapier3d-simd';
import * as THREE from 'three';
import type { ColliderDesc, Piece } from '../world/registry';
import type { Physics } from './Physics';
import { groups } from './groups';
import { tagCollider, type Material } from './surface';

/** One tread of a stair: a solid block from the stair's foot up to this tread's top. */
export function treadBoxes(d: Extract<ColliderDesc, { kind: 'treads' }>): Extract<ColliderDesc, { kind: 'box' }>[] {
  const dx = d.to.x - d.from.x, dz = d.to.z - d.from.z, run = Math.hypot(dx, dz) / d.count, rise = (d.to.y - d.from.y) / d.count;
  const yaw = Math.atan2(dx, dz);
  const out: Extract<ColliderDesc, { kind: 'box' }>[] = [];
  for (let i = 0; i < d.count; i++) {
    const f = (i + 0.5) / d.count, top = d.from.y + rise * (i + 1), hy = Math.max(0.01, (top - d.from.y) / 2);
    out.push({ kind: 'box', x: d.from.x + dx * f, y: d.from.y + hy, z: d.from.z + dz * f, hx: d.width / 2, hy, hz: run / 2, yaw, ...(d.surface === undefined ? {} : { surface: d.surface }) });
  }
  return out;
}

function rapierDesc(physics: Physics, d: Exclude<ColliderDesc, { kind: 'treads' }>): RapierDesc | null {
  const { R } = physics;
  switch (d.kind) {
    case 'box': return R.ColliderDesc.cuboid(Math.max(0.005, d.hx), Math.max(0.005, d.hy), Math.max(0.005, d.hz));
    case 'capsule': return R.ColliderDesc.capsule(Math.max(0.005, d.halfHeight), d.radius);
    case 'ball': return R.ColliderDesc.ball(d.radius);
    case 'hull': return R.ColliderDesc.convexHull(d.points);
    case 'trimesh': return R.ColliderDesc.trimesh(d.vertices, d.indices);
    default: return null;
  }
}

export interface AddedPiece {
  colliders: Collider[];
  /** a moving piece's body; `sync()` poses it from the object it follows (call in the fixed step's `pre` slot) */
  body: RigidBody | null;
  sync: () => void;
}

const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();

/**
 * Build the piece's colliders into the world: static ones in world space, or — for a piece that `follows` a moving
 * object — attached to a kinematic body in that object's frame. Returns them, so a caller can remove the piece later.
 */
export function addPiece(physics: Physics, piece: Piece): AddedPiece {
  const out: Collider[] = [];
  const { R, world } = physics;
  let body: RigidBody | null = null;
  const follows = piece.follows;
  if (follows) {
    follows.updateWorldMatrix(true, false);
    follows.matrixWorld.decompose(_p, _q, _s);
    body = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(_p.x, _p.y, _p.z).setRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w }));
  }
  for (const raw of piece.colliders ?? []) {
    for (const d of raw.kind === 'treads' ? treadBoxes(raw) : [raw]) {
      const desc = rapierDesc(physics, d);
      if (desc === null) continue; // a degenerate hull: nothing to collide with
      desc.setTranslation(d.x, d.y, d.z).setCollisionGroups(groups('WORLD'));
      if (d.rot) desc.setRotation(d.rot);
      else if (d.yaw !== undefined && d.yaw !== 0) desc.setRotation({ x: 0, y: Math.sin(d.yaw / 2), z: 0, w: Math.cos(d.yaw / 2) });
      const c = world.createCollider(desc, body ?? undefined);
      const material: Material = d.surface ?? raw.surface ?? piece.surface ?? 'wood';
      tagCollider(c, material, piece);
      out.push(c);
    }
  }
  const b = body, active = piece.active;
  let on = true;
  const sync = b && follows ? () => {
    if (active) {
      const want = active();
      if (want !== on) { on = want; for (const c of out) c.setEnabled(want); }
    }
    follows.updateWorldMatrix(true, false);
    follows.matrixWorld.decompose(_p, _q, _s);
    b.setNextKinematicTranslation({ x: _p.x, y: _p.y, z: _p.z });
    b.setNextKinematicRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w });
  } : () => undefined;
  return { colliders: out, body, sync };
}

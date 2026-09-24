/**
 * The P2 bridge (PHYSICS.md P2): until P4 / P3 author each structure's real colliders, the world's hand-made
 * `Collider` boxes — every Y-rotated box in `player.colliders`: walls, posts, rails, rocks, hulls, interactables — are
 * mirrored into Rapier as the same cuboids, and the forest's trunks as capsules, so the player's character controller
 * is stopped by exactly what stopped the old `collide()`.
 *
 * The list is live: builders and the quest push into it after boot, a door's box is switched off while it swings or
 * stands open. `sync()` runs in the fixed step's `pre` slot and diffs it: new boxes get a collider, changed ones
 * are moved or rebuilt, removed ones are dropped. P4 / P3 delete this file.
 */
import type { Collider as RapierCollider } from '@dimforge/rapier3d-simd';
import type { Collider } from '../player/Player';
import type { Physics } from './Physics';
import { groups } from './groups';
import { tagCollider, untagCollider } from './surface';

interface Mirror { body: RapierCollider; x: number; z: number; rot: number; hw: number; hd: number; yTop: number; yBottom: number }

export class ColliderBridge {
  private readonly mirrors = new Map<Collider, Mirror>();
  private readonly seen = new Set<Collider>();

  constructor(private readonly physics: Physics, private readonly boxes: readonly Collider[]) {}

  sync(): void {
    const { R, world } = this.physics;
    this.seen.clear();
    for (const b of this.boxes) {
      this.seen.add(b);
      const m = this.mirrors.get(b);
      if (m && m.hw === b.hw && m.hd === b.hd && m.yTop === b.yTop && m.yBottom === b.yBottom) {
        if (m.x !== b.x || m.z !== b.z || m.rot !== b.rot) { place(m.body, b); m.x = b.x; m.z = b.z; m.rot = b.rot; }
        continue;
      }
      if (m) { untagCollider(m.body); world.removeCollider(m.body, false); }
      const hy = Math.max(0.005, (b.yTop - b.yBottom) / 2);
      const body = world.createCollider(R.ColliderDesc.cuboid(Math.max(0.005, b.hw), hy, Math.max(0.005, b.hd)).setCollisionGroups(groups('WORLD')));
      place(body, b);
      tagCollider(body, 'wood', b);
      this.mirrors.set(b, { body, x: b.x, z: b.z, rot: b.rot, hw: b.hw, hd: b.hd, yTop: b.yTop, yBottom: b.yBottom });
    }
    for (const [b, m] of this.mirrors) {
      if (this.seen.has(b)) continue;
      untagCollider(m.body); world.removeCollider(m.body, false); this.mirrors.delete(b);
    }
  }

  get count(): number { return this.mirrors.size; }
}

/**
 * The old `collide()` rotated the player into a box's frame by −rot (local = R(−rot)·world, x' = x·cos − z·sin), so
 * the box sits at world = R(rot)·local — a rotation of −rot about +Y in three / Rapier's right-handed convention.
 */
function place(body: RapierCollider, b: Collider): void {
  const a = -b.rot / 2;
  body.setTranslation({ x: b.x, y: (b.yTop + b.yBottom) / 2, z: b.z });
  body.setRotation({ x: 0, y: Math.sin(a), z: 0, w: Math.cos(a) });
}

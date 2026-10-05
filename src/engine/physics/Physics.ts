/**
 * The physics world (project/archive/2026-09-23-physics.md §Architecture): one Rapier `World` per shard, advanced once per fixed step.
 *
 * `Game` owns the clock (the frame phases, ENGINE-FIT E2): its fixed loop runs `pre → step → post` at 60 Hz, fed the
 * loop's unscaled dt, so visual hit-stop leaves gameplay time running and a skipped frame (menu, rotate gate) steps
 * nothing. `step()` is registered in the `step` slot; colliders that move are placed in `pre`, and characters move
 * against the stepped world in `post`. Rapier 0.21's World owns its empty SoftBodySet and supplies it to the
 * changed low-level step/remove/debug APIs; gameplay uses only these World wrappers.
 */
import type { World } from '@dimforge/rapier3d-simd';
import type { Rapier } from './rapier';
import { FIXED_STEP } from '../core/fixedStep';
import { currentOwner } from '../app/ownership';
import type { Scope } from '../app/scope';
import { untagCollider } from './surface';

/** Owns one fixed-step collision world and its complete same-version continuation. */
export class Physics {
  readonly world: World;
  /** ms the last `step()` took (the perf meter / bench read it) */
  stepMs = 0;

  readonly R: Rapier;
  private readonly bodyOwners = new Map<number, Scope>();
  private readonly colliderOwners = new Map<number, Scope>();
  constructor(R: Rapier, snapshot?: Uint8Array) {
    this.R = R;
    this.world = snapshot === undefined ? new R.World({ x: 0, y: -9.81, z: 0 }) : R.World.restoreSnapshot(snapshot);
    this.world.timestep = FIXED_STEP;
    const bodies = new Map<number, () => void>(), colliders = new Map<number, () => void>();
    const createBody = this.world.createRigidBody.bind(this.world), removeBody = this.world.removeRigidBody.bind(this.world);
    const createCollider = this.world.createCollider.bind(this.world), removeCollider = this.world.removeCollider.bind(this.world);
    this.world.createRigidBody = (desc) => {
      const body = createBody(desc), scope = currentOwner();
      if (scope) {
        this.bodyOwners.set(body.handle, scope);
        bodies.set(body.handle, scope.capture('bodies', () => { if (body.isValid()) this.world.removeRigidBody(body); }));
      }
      return body;
    };
    this.world.createCollider = (desc, parent) => {
      const collider = createCollider(desc, parent), scope = currentOwner();
      if (scope) {
        this.colliderOwners.set(collider.handle, scope);
        colliders.set(collider.handle, scope.capture('colliders', () => { if (collider.isValid()) this.world.removeCollider(collider, true); }));
      }
      return collider;
    };
    this.world.removeCollider = (collider, wake) => {
      colliders.get(collider.handle)?.(); colliders.delete(collider.handle); this.colliderOwners.delete(collider.handle); untagCollider(collider);
      removeCollider(collider, wake);
    };
    this.world.removeRigidBody = (body) => {
      for (let i = 0; i < body.numColliders(); i++) {
        const collider = body.collider(i); colliders.get(collider.handle)?.(); colliders.delete(collider.handle); this.colliderOwners.delete(collider.handle); untagCollider(collider);
      }
      bodies.get(body.handle)?.(); bodies.delete(body.handle); this.bodyOwners.delete(body.handle); removeBody(body);
    };
  }

  /** Live native handles owned by this scope subtree in this world, excluding identically numbered handles elsewhere. */
  scopedCensus(scope: Scope): { bodies: number; colliders: number } {
    const count = (owners: Map<number, Scope>): number => {
      let total = 0; for (const owner of owners.values()) if (owner.belongsTo(scope)) total++; return total;
    };
    return { bodies: count(this.bodyOwners), colliders: count(this.colliderOwners) };
  }

  /** Rapier's complete same-version continuation; a fresh Physics instance can consume it. */
  snapshot(): Uint8Array { return this.world.takeSnapshot(); }

  step(): void {
    const t0 = performance.now();
    this.world.step();
    this.stepMs = performance.now() - t0;
  }

  dispose(): void { this.world.forEachCollider(untagCollider); this.world.free(); this.bodyOwners.clear(); this.colliderOwners.clear(); }
}

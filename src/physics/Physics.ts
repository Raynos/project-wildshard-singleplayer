/**
 * The physics world (project/archive/2026-09-23-physics.md §Architecture): one Rapier `World` per shard, advanced once per fixed step.
 *
 * `Game` owns the clock (the frame phases, ENGINE-FIT E2): its fixed loop runs `pre → step → post` at 60 Hz, fed the
 * loop's scaled dt, so hit-stop slows the world with everything else and a skipped frame (menu, rotate gate) steps
 * nothing. `step()` is registered in the `step` slot; colliders that move are placed in `pre`, and characters move
 * against the stepped world in `post`.
 */
import type { World } from '@dimforge/rapier3d-simd';
import type { Rapier } from './rapier';
import { FIXED_STEP } from '../core/fixedStep';

export class Physics {
  readonly world: World;
  /** ms the last `step()` took (the perf meter / bench read it) */
  stepMs = 0;

  constructor(readonly R: Rapier) {
    this.world = new R.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = FIXED_STEP;
  }

  step(): void {
    const t0 = performance.now();
    this.world.step();
    this.stepMs = performance.now() - t0;
  }

  dispose(): void { this.world.free(); }
}

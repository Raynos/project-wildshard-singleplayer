import type { PerspectiveCamera } from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import type { NineDragonWorld } from '../world/build';
import { specimenLight } from '../look/specimenLight';

/** State owned by one level's world hook. */
export class NdRuntime {
  readonly world: NineDragonWorld;
  readonly camera: PerspectiveCamera;
  guardOpen = false;
  private disposed = false;

  constructor(world: NineDragonWorld, camera: PerspectiveCamera) {
    this.world = world;
    this.camera = camera;
  }
  cull(camera: PerspectiveCamera = this.camera): void {
    if (!this.disposed) this.world.cull(camera);
  }
  specimenLight(on: boolean, key?: { x: number; z: number }): void {
    if (!this.disposed) specimenLight(this.world.shared, on, key);
  }
  dispose(): void {
    if (this.disposed) return;
    this.specimenLight(false);
    this.guardOpen = false;
    this.disposed = true;
  }
}

let current: NdRuntime | null = null;
/** The world hook establishes the runtime before the look or traversal is built. */
export function ndRuntime(): NdRuntime {
  if (current === null) throw new Error('Nine Dragon world hook has not run');
  return current;
}
export function ownNdRuntime(scope: Scope, runtime: NdRuntime): void {
  if (scope.disposed) throw new Error('Cannot install Nine Dragon into a disposed level');
  if (current !== null) throw new Error('Nine Dragon runtime is already installed');
  current = runtime;
  scope.onDispose(() => {
    runtime.dispose();
    if (current === runtime) current = null;
  });
}

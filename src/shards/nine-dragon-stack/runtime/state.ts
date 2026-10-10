import type { PerspectiveCamera } from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import { FrameCamera } from '@wildshard/engine/world/frameCamera';
import type { NineDragonWorld } from '../world/build';
import { specimenLight } from '../look/specimenLight';

/** State owned by one level's world hook. */
export class NdRuntime {
  readonly world: NineDragonWorld;
  guardOpen = false;
  private disposed = false;
  /** the page's camera */
  private readonly page: PerspectiveCamera;
  /** the camera seen from the world's root (SF63: a grid cell's render offset; standalone the camera itself) */
  private readonly frame: FrameCamera;

  constructor(world: NineDragonWorld, camera: PerspectiveCamera) {
    this.world = world;
    this.page = camera;
    this.frame = new FrameCamera(world.root);
  }
  /**
   * The camera in the world's own frame, where its programs shade and its cullers measure (the page's camera standalone).
   * Reading it also writes the root's place in the page to the programs' `uRootAt` (data/look.ts SHARED_UNIFORMS).
   */
  get camera(): PerspectiveCamera {
    this.world.shared.u.uRootAt.value.setFromMatrixPosition(this.world.root.matrixWorld);
    return this.frame.of(this.page);
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

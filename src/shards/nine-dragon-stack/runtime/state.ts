import type { PerspectiveCamera } from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import { FrameCamera } from '@wildshard/engine/world/frameCamera';
import type { NineDragonWorld } from '../world/build';
import { specimenLight } from '../look/specimenLight';
import { lendUniforms } from '@wildshard/sdk/looks/lentLooks';

/** State owned by one level's world hook. */
export class NdRuntime {
  readonly world: NineDragonWorld;
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
  /** The camera in the world's own frame, where its cullers measure (the page's camera standalone); the programs' root
   *  place (`uRootAt`) is the look's 'nine.frame' channel group's. */
  get camera(): PerspectiveCamera { return this.frame.of(this.page); }
  cull(camera: PerspectiveCamera = this.camera): void {
    if (!this.disposed) this.world.cull(camera);
  }
  specimenLight(on: boolean, key?: { x: number; z: number }): void {
    if (!this.disposed) specimenLight(this.world.shared, on, key);
  }
  dispose(): void {
    if (this.disposed) return;
    this.specimenLight(false);
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
  // the shared uniforms the look's post graphs link (look/render.ts, the 'nine-shared' set its row names)
  lendUniforms(scope, 'nine-shared', runtime.world.shared.u);
  scope.onDispose(() => {
    runtime.dispose();
    if (current === runtime) current = null;
  });
}

import type { Scope } from '@wildshard/engine/app/scope';
import type { NineDragonWorld } from '../world/build';
import { lendUniforms } from '@wildshard/sdk/looks/lentLooks';

/** The world hook lends the world's shared uniforms to the look: the post graphs' 'nine-shared' set, read and written by
 *  its 'nine.frame' channel group (generators/frameChannels.ts). */
export function lendNineShared(scope: Scope, world: NineDragonWorld): void {
  if (scope.disposed) throw new Error('Cannot install Nine Dragon into a disposed level');
  lendUniforms(scope, 'nine-shared', world.shared.u);
}

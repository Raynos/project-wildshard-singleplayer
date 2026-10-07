import { Bow as PlatformBow, type BowOptions as PlatformBowOptions, type BowWorld as PlatformBowWorld } from '@wildshard/engine/combat/view/Bow';
import type { Targets } from '@wildshard/engine/combat/types';
import type { BowStyle } from './profile';

/** Transitional host ports for the trusted platform bow family. */
export type BowWorld = PlatformBowWorld;
/** Existing kit callers retain their row/profile options; the bridge supplies current input and style defaults. */
export type BowOptions = Omit<PlatformBowOptions<BowStyle>, 'inputContext' | 'initialStyle'>;
/** Compatibility constructor only; draw clocks, arrows and view strategy execution have one platform implementation. */
export class Bow extends PlatformBow<BowStyle> {
  constructor(world: BowWorld, targets: Targets | undefined, opts: BowOptions) {
    super(world, targets, { ...opts, inputContext: 'weapon.bow', initialStyle: 'recurve' });
  }
}

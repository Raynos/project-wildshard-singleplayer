import { Bow, type BowWorld, type BowOptions } from '#kit';
import type { Targets } from '#engine';
import { LONGBOW } from '#shards/pine-hollow/weapons/longbowProfile';
/** Compatibility constructor for today's loadout; S2.1 builds Bow with the LONGBOW row. */
export class Longbow extends Bow {
  constructor(world: BowWorld, targets: Targets | undefined, opts: BowOptions) { super(world, targets, { ...opts, profile: LONGBOW }); }
}
export type LongbowWorld = BowWorld;
export type LongbowOptions = BowOptions;
export { ARROW_LEN, POSE, buildArrowGeometry, arrowKind, arrowMaterial, longbowSpecimen } from '#shards/pine-hollow/weapons/longbowView';
export { pineWind } from '#shards/pine-hollow/weapons/longbowProfile';
export const QUIVER_MAX = 20;
export const AIM_ZOOM = 1.6, AIM_VM_ZOOM = 0.85, AIM_SWAY = 0.5, AIM_SPREAD = 0.5, AIM_IN = 10;

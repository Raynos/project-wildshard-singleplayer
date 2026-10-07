import { Bow as PlatformBow, type BowWorld as PlatformBowWorld, type BowOptions as PlatformBowOptions } from '@wildshard/engine/combat/view/Bow';

/** The shared drawn-projectile instance; view recipes and profiles are supplied by its owner. */
export type BowInstance<Style extends string = string> = PlatformBow<Style>;
/** Host view-strategy ports for the trusted bow family. */
export type BowWorld = PlatformBowWorld;
/** Row, profile and unlock policy supplied to the trusted family constructor. */
export type BowOptions<Style extends string = string> = PlatformBowOptions<Style>;
/** The one platform bow constructor; the SDK owns no second draw clock, projectile pool or presentation implementation. */
export const Bow: typeof PlatformBow = PlatformBow;

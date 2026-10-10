import { Filament as PlatformFilament, Rope as PlatformRope } from '@wildshard/game/systems/looks/ropeFilament';

/** A verlet rope pinned at both ends, stepped at a fixed rate (SHARD-PLATFORM M3, rope filament). */
export const Rope: typeof PlatformRope = PlatformRope;
/** A rope (the instance type). */
export type RopeView = PlatformRope;
/** The screen-space ribbon that draws a rope. */
export const Filament: typeof PlatformFilament = PlatformFilament;
/** A filament (the instance type). */
export type FilamentView = PlatformFilament;

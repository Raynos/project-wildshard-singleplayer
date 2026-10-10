import { SmokeColumn as PlatformSmokeColumn, type SmokeColumnRow as PlatformSmokeColumnRow } from '@wildshard/game/systems/looks/smokeColumn';

/** A smoke column's numbers as data (SHARD-PLATFORM M3): puffs, rise, life, lean, wander, size, fades and its patch. */
export type SmokeColumnRow = PlatformSmokeColumnRow;
/** A thin, broken smoke column off a fire: one Points cloud, thinning close to the viewer, still past its far distance. */
export const SmokeColumn: typeof PlatformSmokeColumn = PlatformSmokeColumn;
/** A smoke column (the class's instances). */
export type SmokeColumnSet = PlatformSmokeColumn;

import { CaveInterior as PlatformCaveInterior, type CaveFrame as PlatformCaveFrame, type CaveLookRow as PlatformCaveLookRow, type CaveMeta as PlatformCaveMeta } from '@wildshard/game/systems/kit/caveInterior';

/** A baked cave interior's meta file, in the cave's frame (SHARD-PLATFORM M3, the kit system). */
export type CaveMeta = PlatformCaveMeta;
/** The cave's frame in the world: its mouth and its turn. */
export type CaveFrame = PlatformCaveFrame;
/** How a cave's shaft of light, drips and fill look and behave near its mouth (a shard's data row). */
export type CaveLookRow = PlatformCaveLookRow;
/** A cave cut into the terrain: its cuts, hole, roof patch, spots, footprint, floor and its shaft / drips. */
export const CaveInterior: typeof PlatformCaveInterior = PlatformCaveInterior;
/** A cave cut into the terrain (the instance type). */
export type CaveInteriorView = PlatformCaveInterior;

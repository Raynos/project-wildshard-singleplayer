import { TrophyWall as PlatformTrophyWall, type TrophyWallOptions as PlatformTrophyWallOptions } from '@wildshard/game/compendium/trophyWall';

/** What a trophy wall is built from: its anchor, the compendium state, the creature factory and its rows. */
export type TrophyWallOptions = PlatformTrophyWallOptions;
/** A shard's trophy wall: a mounted head per species the player has taken, read from the compendium (SHARD-PLATFORM M3). */
export const TrophyWall: typeof PlatformTrophyWall = PlatformTrophyWall;
/** A live trophy wall (the class's instance type). */
export type TrophyWallInstance = PlatformTrophyWall;

import { FigureCrowd as PlatformFigureCrowd, tintAbove as platformTintAbove, type FigureCrowdLevels as PlatformFigureCrowdLevels } from '@wildshard/game/systems/cull/figureCrowd';

/** A crowd's levels as data. */
export type FigureCrowdLevels = PlatformFigureCrowdLevels;
/** A crowd of static figures culled per figure with distance levels (SHARD-PLATFORM M3). */
export const FigureCrowd: typeof PlatformFigureCrowd = PlatformFigureCrowd;
/** A figure crowd (the instance type). */
export type FigureCrowdView = PlatformFigureCrowd;
/** Recolours every vertex above a height, keeping its shading. */
export const tintAbove: typeof platformTintAbove = platformTintAbove;

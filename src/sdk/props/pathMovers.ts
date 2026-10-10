import {
  moveAlong as platformMoveAlong, moverStart as platformMoverStart,
  type CablePath as PlatformCablePath, type LoopPath as PlatformLoopPath, type MoverPath as PlatformMoverPath,
  type MoverPlacement as PlatformMoverPlacement, type OrbitPath as PlatformOrbitPath,
} from '@wildshard/game/systems/props/pathMovers';

/** A mover along x, wrapping (a train). */
export type LoopPath = PlatformLoopPath;
/** A mover swinging along a sloped cable (a gondola). */
export type CablePath = PlatformCablePath;
/** A mover circling a centre, bobbing, facing along the circle (a drone). */
export type OrbitPath = PlatformOrbitPath;
/** One of the movers' paths. */
export type MoverPath = PlatformMoverPath;
/** A mover's placement at t = 0. */
export type MoverPlacement = PlatformMoverPlacement;
/** The mover's placement at t = 0 (SHARD-PLATFORM M3). */
export const moverStart: typeof platformMoverStart = platformMoverStart;
/** Pose a placed mover on its path at t, without allocating (SHARD-PLATFORM M3). */
export const moveAlong: typeof platformMoveAlong = platformMoveAlong;

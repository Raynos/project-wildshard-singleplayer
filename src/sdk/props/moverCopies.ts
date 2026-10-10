import { placeMovers as platformPlaceMovers, type RunningMover as PlatformRunningMover } from '@wildshard/game/systems/props/moverCopies';

/** One placed mover: its object and the path it runs. */
export type RunningMover = PlatformRunningMover;
/** Place a mover model's copies on their paths, named for the budget lane (SHARD-PLATFORM M3). */
export const placeMovers: typeof platformPlaceMovers = platformPlaceMovers;

import { RespawnQueue as PlatformQueue } from '@wildshard/game/population/respawn';

/** Ordered population return queue on the caller's random authority and clocks. */
export type RespawnQueueInstance = PlatformQueue;
export const RespawnQueue: typeof PlatformQueue = PlatformQueue;

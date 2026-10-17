import { RespawnQueue as PlatformQueue } from '@wildshard/game/population/respawn';

/** Ordered returns from owner-supplied draw facts, clocks and traversal rows. */
export type RespawnQueueInstance = PlatformQueue;
export const RespawnQueue: typeof PlatformQueue = PlatformQueue;

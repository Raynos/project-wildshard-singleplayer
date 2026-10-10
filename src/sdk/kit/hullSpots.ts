import { hullSpots as platformHullSpots, type HullSpotsRow as PlatformHullSpotsRow } from '@wildshard/game/systems/kit/hullSpots';

/** Where to look on a skinned hull for its tip spots, and how far under each a spot hangs (SHARD-PLATFORM M3, the kit system). */
export type HullSpotsRow = PlatformHullSpotsRow;
/** A skinned hull's tip spots round a bone (leftmost, rightmost, the highest part-way out), in that bone's frame; null without one. */
export const hullSpots: typeof platformHullSpots = platformHullSpots;

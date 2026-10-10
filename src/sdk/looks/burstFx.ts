import { Flash as PlatformFlash, Sparks as PlatformSparks } from '@wildshard/game/systems/looks/burstFx';

/** A deterministic burst of hot streaks (SHARD-PLATFORM M3, burst effects). */
export const Sparks: typeof PlatformSparks = PlatformSparks;
/** A sparks burst (the instance type). */
export type SparksView = PlatformSparks;
/** A camera-facing star flash. */
export const Flash: typeof PlatformFlash = PlatformFlash;
/** A flash (the instance type). */
export type FlashView = PlatformFlash;

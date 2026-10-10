import { installRideVeil as platformInstallRideVeil, type RideSlot as PlatformRideSlot } from '@wildshard/game/systems/portals/rideVeil';

/** Where a world's per-frame update finds a ride's step. */
export type RideSlot = PlatformRideSlot;
/** Install a walk-in ring ride for the session with its fade veil in the HUD (SHARD-PLATFORM M3). */
export const installRideVeil: typeof platformInstallRideVeil = platformInstallRideVeil;

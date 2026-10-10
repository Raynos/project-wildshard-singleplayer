import { installHostRide as platformInstallHostRide, type RideHost as PlatformRideHost } from '@wildshard/game/systems/portals/hostRide';

/** What a ring ride uses of the renderer-free host: its player, the player's fall, impulse, knockback and board, its
 *  physics, and a fixed-step system with continuation. */
export type RideHost<Physics> = PlatformRideHost<Physics>;
/** Install a walk-in ring ride on the renderer-free host's fixed step, with exact continuation (SHARD-PLATFORM M3). */
export const installHostRide: typeof platformInstallHostRide = platformInstallHostRide;

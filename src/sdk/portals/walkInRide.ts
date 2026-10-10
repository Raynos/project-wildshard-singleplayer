import {
  playerRider as platformPlayerRider, walkInRide as platformWalkInRide,
  type PortalPlayer as PlatformPortalPlayer, type PortalRide as PlatformPortalRide, type PortalRideState as PlatformPortalRideState,
  type PortalRider as PlatformPortalRider, type PortalSource as PlatformPortalSource, type RideFade as PlatformRideFade, type RideRings as PlatformRideRings,
} from '@wildshard/game/systems/portals/walkInRide';

/** The fade to dark, the hold and the fade back (s). */
export type RideFade = PlatformRideFade;
/** The rings a ride watches. */
export type RideRings = PlatformRideRings;
/** What the ride needs of the player. */
export type PortalRider = PlatformPortalRider;
/** The portals while they run. */
export type PortalRide = PlatformPortalRide;
/** The ride's whole state, for a checkpoint. */
export type PortalRideState = PlatformPortalRideState;
/** What the ride uses of the engine's player. */
export type PortalPlayer = PlatformPortalPlayer;
/** A shardfile's portal entries and the rules' inputs. */
export type PortalSource = PlatformPortalSource;
/** Ride ring portals: walk in, fade, the format's checked transfer under the dark (SHARD-PLATFORM M3). */
export const walkInRide: typeof platformWalkInRide = platformWalkInRide;
/** The player's side of a ring ride (SHARD-PLATFORM M3). */
export const playerRider: typeof platformPlayerRider = platformPlayerRider;

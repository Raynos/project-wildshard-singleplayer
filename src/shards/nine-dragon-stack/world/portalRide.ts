// G224 (E435): riding the portals, on the SDK's walk-in ring ride (@wildshard/sdk/portals/walkInRide): walk into a deck's
// ring and you stand in Lantern Square facing up it; walk into the square's ring and you come out of the ring on the deck
// you came in by (the north deck if you spawned in the square). Under the dark the move is the format's checked transfer
// (SF8c) between the declared nodes of shard.config.ts. Renderer-free (SF72): the ride runs the same in the page
// (world/portalVeil.ts draws its fade in the HUD) and in the headless host (runtime/portals.ts).
import type { PortalTraversalPorts } from '@wildshard/game/shardfile/portalTraversal';
import { type PortalPlayer as Player, type PortalRide as Ride, type PortalRideState as RideState, type PortalRider as Rider, playerRider as sdkPlayerRider, walkInRide } from '@wildshard/sdk/portals/walkInRide';
import type { RideSlot } from '@wildshard/sdk/portals/rideVeil';
import source from '../shard.config';
import { PORTAL_FADE as FADE, PORTAL_TRIGGER } from '../data/portals';
import { DECK_PORTALS, SQUARE_PORTAL } from './portalPlan';

/** s: the fade to dark, the hold in the dark (the move happens as it starts), the fade back (data/portals.ts) */
export const PORTAL_FADE: typeof FADE = FADE;
/** what the ride needs of the player */
export type PortalRider = Rider;
/** the portals while they run (captures and tests read them through the plugin's `portals`) */
export type PortalRide = Ride;
/** the ride's whole state, for a checkpoint (the headless host's continuation) */
export type PortalRideState = RideState;
/** what the ride uses of the engine's player */
export type PortalPlayer = Player;

/** where the world's per-frame update finds the ride's step (world/build.ts) */
export type PortalSlot = RideSlot;

/** the ride over the four decks' rings and the square's ring out */
export function portalRide(rider: PortalRider, veil: (k: number) => void): PortalRide {
  return walkInRide(rider, veil, { roads: DECK_PORTALS, out: SQUARE_PORTAL, trigger: PORTAL_TRIGGER, fade: PORTAL_FADE });
}

/** the player's side of the ride, transferring between shard.config.ts's four declared portal links */
export function playerRider(player: PortalPlayer, physics: () => PortalTraversalPorts['physics']): PortalRider {
  return sdkPlayerRider(player, physics, source);
}

import type { PortalTraversalPorts } from '@wildshard/game/shardfile/portalTraversal';
import { type RideHost, installHostRide } from '@wildshard/sdk/portals/hostRide';
import { playerRider, portalRide, type PortalRide } from '../world/portalRide';
import { rideFeats, type NineFacts } from '../world/feats';

/** The ride's fixed-step adapter id. */
export const PORTAL_STEP = 'nine-dragon-stack.portals';

/** What the ride uses of the renderer-free host (the engine's SimHost, structurally). */
export type PortalHost = RideHost<PortalTraversalPorts['physics']>;

/**
 * Nine Dragon's portal rides in the renderer-free host (SF72) on the SDK's host ride (@wildshard/sdk/portals/hostRide):
 * the page's own ride and rider (world/portalRide.ts `portalRide` + `playerRider`), driven by the host's fixed step after
 * the player's move. Nothing draws: the veil is the page's (world/portalVeil.ts). A ride that lands in Lantern Square
 * reports the square's fact (world/feats.ts) to `fact`.
 */
export function installNinePortals(host: PortalHost, fact: NineFacts = () => { /* no ledger */ }): PortalRide {
  return installHostRide(host, PORTAL_STEP, (body) => portalRide(playerRider(body, () => host.physics), () => { /* the fade is the page's view */ }), (ride) => rideFeats(ride.step, ride.rides, fact));
}

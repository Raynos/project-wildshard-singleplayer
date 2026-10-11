import type { PortalTraversalPorts } from '@wildshard/game/shardfile/portalTraversal';
import { type RideHost, installHostRide } from './portals/hostRide';
import type { DirectorStagesData } from '@wildshard/format/directorStages';
import { playerRider, declaredPortals, walkInRide, type PortalRide, type PortalSource } from './portals/walkInRide';
import { PORTAL_FADE, PORTAL_TRIGGER } from '../data/portals';
import { rideFeats, type NineFacts } from '../world/feats';

type NinePortalSource = PortalSource & { readonly directors?: readonly DirectorStagesData[] };

/** The ride's fixed-step adapter id. */
export const PORTAL_STEP = 'nine-dragon-stack.portals';

/** What the ride uses of the renderer-free host (the engine's SimHost, structurally). */
export type PortalHost = RideHost<PortalTraversalPorts['physics']>;

/**
 * Nine Dragon's portal rides in the renderer-free host (SF72) on its native host ride (runtime/portals/hostRide.ts):
 * the page's own ride and rider over the admitted portal entries and director, driven by the host's fixed step after
 * the player's move. Nothing draws: the veil is the page's (world/portalVeil.ts). A ride that lands in Lantern Square
 * reports the square's fact (world/feats.ts) to `fact`.
 */
export function installNinePortals(host: PortalHost, source: NinePortalSource, fact: NineFacts = () => { /* no ledger */ }): PortalRide {
  const stages = source.directors?.find(row => row.id === 'nine.portal-ride');
  if (stages === undefined) throw new Error('Missing Nine portal director declaration');
  return installHostRide(host, PORTAL_STEP, (body) => walkInRide(playerRider(body, () => host.physics, source), () => { /* the fade is the page's view */ },
    { entries: declaredPortals(source), trigger: PORTAL_TRIGGER, fade: PORTAL_FADE, stages }), (ride) => rideFeats(ride.step, ride.rides, fact));
}

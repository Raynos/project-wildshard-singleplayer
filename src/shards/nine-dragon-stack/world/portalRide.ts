// The page binds its admitted four-deck ride and player services.
import type { PortalTraversalPorts } from '@wildshard/game/shardfile/portalTraversal';
import type { PortalRideState as RideState } from '@wildshard/game/shardfile/walkInPortalRide';
import { bindPortalRide, declaredPortals, playerRider as sdkPlayerRider } from '../runtime/portals/hostRide';
import type { PortalPlayer as Player, PortalRide as Ride, PortalRider as Rider } from '../runtime/portals/types';
import type { RideSlot } from '../runtime/portals/rideVeil';
import type { Shardfile } from '@wildshard/format/shardSchema';
import portals from '../data/portals.json' with { type: 'json' };

export type PortalRider = Rider;
export type PortalRide = Ride;
export type PortalRideState = RideState;
export type PortalPlayer = Player;
export type PortalSlot = RideSlot;

export function portalRide(rider: PortalRider, veil: (amount: number) => void, source: Shardfile): PortalRide {
  const stages = source.directors?.find(row => row.id === 'nine.portal-ride');
  if (stages === undefined) throw new Error('Missing Nine portal director declaration');
  return bindPortalRide(rider, veil, { entries: declaredPortals(source), trigger: portals.trigger, fade: portals.fade, stages });
}

export function playerRider(player: PortalPlayer, physics: () => PortalTraversalPorts['physics'], source: Shardfile): PortalRider {
  return sdkPlayerRider(player, physics, source);
}

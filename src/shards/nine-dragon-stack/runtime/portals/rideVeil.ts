// rideVeil — a walk-in ring ride's fade veil in the HUD (SHARD-PLATFORM M3, ex Nine Dragon's world/portalVeil.ts, G224).
// The ride itself (which ring, the hold, the checked transfer under the dark) is renderer-free (walkInRide) and runs the
// same in the headless host (hostRide); this is only the page's view of its fade: a declared full-screen panel, its
// opacity the ride's veil, shown only while it is above 0, owned by the level's scope so it goes with the session.
//
//   const ride = installRideVeil(slot, rider, VEIL, 'MyVeil', (r, veil) => walkInRide(r, veil, rings));
import { declarePanel, type PanelNode } from '@wildshard/engine/ui/panel';
import { mountUi, uiScope } from '@wildshard/engine/ui/ownership';
import type { PortalRide, PortalRider } from './walkInRide';

/** where the world's per-frame update finds the ride's step (null when no ride runs) */
export interface RideSlot { step: ((dt: number) => void) | null }

/** Install a ride for this session: the veil `node` mounted on the HUD under the scope `scope`, the ride `rideOf` makes
 *  with that veil, and its step (wrapped by `stepOf`) in `slot`; the scope's end lets go of a held body and empties the slot. */
export function installRideVeil(slot: RideSlot, rider: PortalRider, node: PanelNode, scope: string, rideOf: (rider: PortalRider, veil: (k: number) => void) => PortalRide, stepOf: (ride: PortalRide) => (dt: number) => void = (ride) => ride.step): PortalRide {
  const owner = uiScope(scope);
  const veil = declarePanel(node);
  mountUi(veil.root, owner);
  const ride = rideOf(rider, (k) => { veil.style('', 'opacity', k.toFixed(3)); veil.style('', 'display', k > 0 ? 'block' : 'none'); });
  slot.step = stepOf(ride);
  owner.onDispose(() => { if (ride.busy()) rider.hold(false); slot.step = null; });
  return ride;
}

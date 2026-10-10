// G224 (E435): the portals' fade veil in the HUD, on the SDK's ride veil (@wildshard/sdk/portals/rideVeil). The ride
// itself is renderer-free in world/portalRide.ts and runs the same in the headless host (runtime/portals.ts); this is only
// the page's view of its fade (data/portals.ts PORTAL_VEIL).
import { installRideVeil } from '@wildshard/sdk/portals/rideVeil';
import { portalRide, type PortalRide, type PortalRider, type PortalSlot } from './portalRide';
import { rideFeats, type NineFacts } from './feats';
import { PORTAL_VEIL } from '../data/portals';

/**
 * install the portals' ride for this session: the fade veil in the HUD (owned by the level's scope, so it goes with the
 * session) and the step, run by the world's own per-frame update (world/build.ts `portal`, after the player's); a ride
 * that lands in Lantern Square reports the square's fact (world/feats.ts) to `fact`
 */
export function installPortals(slot: PortalSlot, rider: PortalRider, fact: NineFacts = () => { /* no ledger */ }): PortalRide {
  return installRideVeil(slot, rider, PORTAL_VEIL, 'NdPortalVeil', portalRide, (ride) => rideFeats(ride.step, ride.rides, fact));
}

// G224 (E435): the portals' fade veil in the HUD. The ride itself (which ring, the hold, the checked transfer under the
// dark) is renderer-free in world/portalRide.ts and runs the same in the headless host (runtime/portals.ts); this is
// only the page's view of its fade.
import { mountUi, uiScope } from '@wildshard/engine/ui/ownership';
import { portalRide, type PortalRide, type PortalRider, type PortalSlot } from './portalRide';
import { rideFeats, type NineFacts } from './feats';

/**
 * install the portals' ride for this session: the fade veil in the HUD (owned by the level's scope, so it goes with the
 * session) and the step, run by the world's own per-frame update (world/build.ts `portal`, after the player's); a ride
 * that lands in Lantern Square reports the square's fact (world/feats.ts) to `fact`
 */
export function installPortals(slot: PortalSlot, rider: PortalRider, fact: NineFacts = () => { /* no ledger */ }): PortalRide {
  const scope = uiScope('NdPortalVeil');
  const el = document.createElement('div');
  el.className = 'nd-portal-veil';
  el.style.cssText = 'position:absolute;inset:0;pointer-events:none;opacity:0;display:none;z-index:60;background:radial-gradient(circle at 50% 50%,#2a1648 0%,#0a0612 70%)';
  mountUi(el, scope);
  const ride = portalRide(rider, (k) => { el.style.opacity = k.toFixed(3); el.style.display = k > 0 ? 'block' : 'none'; });
  slot.step = rideFeats(ride.step, ride.rides, fact);
  scope.onDispose(() => { if (ride.busy()) rider.hold(false); slot.step = null; });
  return ride;
}

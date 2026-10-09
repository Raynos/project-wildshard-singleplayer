// G224 (E435): the portals' fade veil in the HUD. The ride itself (which ring, the hold, the checked transfer under the
// dark) is renderer-free in world/portalRide.ts and runs the same in the headless host (runtime/portals.ts); this is
// only the page's view of its fade.
import { declarePanel, mountPanel, panelScope, type PanelNode } from '@wildshard/sdk/panels';
import { portalRide, type PortalRide, type PortalRider, type PortalSlot } from './portalRide';
import { rideFeats, type NineFacts } from './feats';

/** the fade veil: a full-screen violet dark over the HUD, faded by the ride (SF28: a declared panel) */
export const PORTAL_VEIL = { cls: 'nd-portal-veil', style: {
  position: 'absolute', inset: '0', pointerEvents: 'none', opacity: '0', display: 'none', zIndex: '60',
  background: 'radial-gradient(circle at 50% 50%,#2a1648 0%,#0a0612 70%)',
} } satisfies PanelNode;

/**
 * install the portals' ride for this session: the fade veil in the HUD (owned by the level's scope, so it goes with the
 * session) and the step, run by the world's own per-frame update (world/build.ts `portal`, after the player's); a ride
 * that lands in Lantern Square reports the square's fact (world/feats.ts) to `fact`
 */
export function installPortals(slot: PortalSlot, rider: PortalRider, fact: NineFacts = () => { /* no ledger */ }): PortalRide {
  const scope = panelScope('NdPortalVeil');
  const veil = declarePanel(PORTAL_VEIL);
  mountPanel(veil, scope);
  const ride = portalRide(rider, (k) => { veil.style('', 'opacity', k.toFixed(3)); veil.style('', 'display', k > 0 ? 'block' : 'none'); });
  slot.step = rideFeats(ride.step, ride.rides, fact);
  scope.onDispose(() => { if (ride.busy()) rider.hold(false); slot.step = null; });
  return ride;
}

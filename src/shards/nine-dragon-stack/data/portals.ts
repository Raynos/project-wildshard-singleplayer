// G224 (Jake, 2026-10-07, E435): Nine Dragon's portals as data (SHARD-PLATFORM M3, ex world/portalPlan.ts and
// world/portalRide.ts): the four road-height decks' rings and the square's one ring out, placed and ridden by the SDK's
// ring portals (@wildshard/sdk/portals/ringPortals, portals/walkInRide, portals/rideVeil). Heights are over the square's
// datum (layout.ts Y0).
import type { PanelNode } from '@wildshard/sdk/panels';

/** the ring's radius to its tube's centre, the tube's radius, and how high its centre floats over the floor */
export const RING = { r: 2.1, tube: 0.16, lift: 2.75 } as const;

/**
 * the walk-in trigger: from `front` m in front of the ring's plane to `back` m behind it, `half` m either side of its
 * centre line, feet within `feet` m of the ring's floor. The format's checked traversal admits a transfer only from within
 * `reach` m of the declared portal node with the feet within 0.15 m of its floor (src/game/shardfile/portalTraversal.ts),
 * so the trigger is the middle of the ring (the body passes through its opening, under its top arc), every corner inside
 * that reach.
 */
export const PORTAL_TRIGGER = { front: 0.6, back: 0.6, half: 1, feet: 0.15, reach: 1.25 } as const;

/** s: the fade to dark, the hold in the dark (the move happens as it starts), the fade back */
export const PORTAL_FADE = { out: 0.28, hold: 0.12, in: 0.4 } as const;

/** how far short of the entry socket's asphalt end a deck's ring stands: on the socket's last metre (SF8c: a road portal
 *  stands 0.5 to 14.5 m in), two metres in front of the 16 m deck's end wall; it has no collider, so the road stays clear */
export const DECK_RING_SHORT = 1;

/**
 * the square's one ring out: at the square's north end (6 m in from layout.ts PLAZA.z0, −26), beside the paifang's east
 * bay and short of the banyan's planter, walked into going north; the arrival looks up the square at it (the south half is
 * the night market, and the street through the gate is the walk route's, scripts/physics-route.json)
 */
export const SQUARE_RING = { id: 'portal.square', x: 12, dy: 0, z: -20, nx: 0, nz: -1 } as const;

/** arriving in Lantern Square: the spawn's own spot by the Well's balustrade, facing up the square toward the paifang
 *  (shard.config.ts `spawn`), the ring out ~30 m ahead, just right of the paifang */
export const SQUARE_ARRIVAL_AT = { id: 'portal.square.arrival', x: 0.95, dy: 0, z: 7.5, yawDeg: -12 } as const;

/** the walked route's turns from the arrival up the square, west of the hawker stall, to the ring out (x, z); it ends
 *  3 m short of the ring, then at it */
export const SQUARE_ROUTE_TURNS = [[5.5, 2], [6, -14]] as const;

/** the shardfile collider ids the portal nodes stand on (shard.config.ts declares them: world/entries.ts portalFloors) */
export const PORTAL_FLOORS = { deckPrefix: 'deck.', square: 'square' } as const;

/** the fade veil: a full-screen violet dark over the HUD, faded by the ride (SF28: a declared panel) */
export const PORTAL_VEIL = { cls: 'nd-portal-veil', style: {
  position: 'absolute', inset: '0', pointerEvents: 'none', opacity: '0', display: 'none', zIndex: '60',
  background: 'radial-gradient(circle at 50% 50%,#2a1648 0%,#0a0612 70%)',
} } satisfies PanelNode;

// G224 (Jake, 2026-10-07, E435): Nine Dragon's entries are portals. The fragment floats at +125 m and covers ~8 % of its
// cell, so it builds no corridors out to the edges: each of the four road-height landing decks (world/entries.ts) carries
// a floating ring that sends you to Lantern Square, and the square has ONE ring out that sends you back to the deck you
// came in by. The rings are the SDK's (@wildshard/sdk/portals/ringPortals) placed from data/portals.ts; the look
// (world/portals.ts), the walk-in ride (world/portalRide.ts), the tests and the format's declared portal links (SF8c,
// `portalLinks`) all read this one plan.
import { CHUNK_HALF, ENTRY_ASPHALT, ENTRY_WIDTH } from '@wildshard/engine/core/config';
import { type EdgePortal, type PortalLinkRow, type Pose, type RingPortal, type ShardEdge as Edge, edgeArrival, edgePortals, exitNodeId, exitRoad, inRingPortal, ringPortalLinks } from '@wildshard/sdk/portals/ringPortals';
import { DECK_RING_SHORT, PORTAL_FLOORS, PORTAL_TRIGGER, SQUARE_ARRIVAL_AT, SQUARE_RING, SQUARE_ROUTE_TURNS } from '../data/portals';
import { Y0 } from '../layout';

/** a cell edge, as the shardfile names them (north is +z) */
export type ShardEdge = Edge;
/** one portal: where its ring stands (feet height `y`), the unit normal its face looks along (the way you walk in) */
export type Portal = RingPortal;
/** a deck's portal: its edge, and the deck's frame (the edge midpoint, the inward unit axis) */
export type DeckPortal = EdgePortal;

/** how far in from the cell edge a deck's portal stands (data/portals.ts DECK_RING_SHORT) */
export const DECK_PORTAL_A = ENTRY_ASPHALT - DECK_RING_SHORT;
/** a ride can only start where the format admits a transfer: every corner of the trigger inside its reach */
export const TRIGGER_ADMITTED = Math.hypot(Math.max(PORTAL_TRIGGER.front, PORTAL_TRIGGER.back), PORTAL_TRIGGER.half) < PORTAL_TRIGGER.reach;

/** the four decks' rings in the format's edge order (north is +z: world/entries.ts FRAMES) */
export const DECK_PORTALS: readonly DeckPortal[] = edgePortals(CHUNK_HALF, DECK_PORTAL_A);

/** the square's one ring out (data/portals.ts SQUARE_RING) */
export const SQUARE_PORTAL: Portal = { id: SQUARE_RING.id, x: SQUARE_RING.x, y: Y0 + SQUARE_RING.dy, z: SQUARE_RING.z, nx: SQUARE_RING.nx, nz: SQUARE_RING.nz };

/** arriving in Lantern Square (data/portals.ts SQUARE_ARRIVAL_AT) */
export const SQUARE_ARRIVAL: Pose = { x: SQUARE_ARRIVAL_AT.x, y: Y0 + SQUARE_ARRIVAL_AT.dy, z: SQUARE_ARRIVAL_AT.z, yaw: SQUARE_ARRIVAL_AT.yawDeg * (Math.PI / 180) };

/** arriving on a deck from the square: out of the deck's own ring, facing out along the road */
export const deckArrival: (p: DeckPortal) => Pose = edgeArrival;
/** the declared exit node in the square bound back to a deck's road (one per entry, all at the square's one ring) */
export const squareExitId = (edge: ShardEdge): string => exitNodeId(SQUARE_PORTAL, edge);
/** which deck the square's ring sends you to: back to the deck you came in by, else the north deck */
export const exitDeck = (entered: ShardEdge | null): DeckPortal => exitRoad(DECK_PORTALS, entered);
/** whether feet at (x, y, z) are inside a portal's walk-in volume (data/portals.ts PORTAL_TRIGGER) */
export const inPortal = (p: Portal, x: number, y: number, z: number): boolean => inRingPortal(p, PORTAL_TRIGGER, x, y, z);

/** the shardfile collider ids the portal nodes stand on (shard.config.ts declares them: world/entries.ts portalFloors) */
export const deckFloorId = (edge: ShardEdge): string => `${PORTAL_FLOORS.deckPrefix}${edge}`;
export const SQUARE_FLOOR = PORTAL_FLOORS.square;
/** the walked route from the arrival up the square, west of the hawker stall, to the portal out (the format's
 *  destination -> exit route) */
const onSquare = (x: number, z: number): [number, number, number] => [x + 0, Y0 + 0, z + 0]; // JSON data: never −0
export const SQUARE_ROUTE: readonly [number, number, number][] = [
  onSquare(SQUARE_ARRIVAL.x, SQUARE_ARRIVAL.z), ...SQUARE_ROUTE_TURNS.map(([x, z]) => onSquare(x, z)),
  onSquare(SQUARE_PORTAL.x, SQUARE_PORTAL.z + 3), onSquare(SQUARE_PORTAL.x, SQUARE_PORTAL.z),
];

/** SF8c (G224): each deck's declared portal link in the format's shape: the road portal on the deck at y = 0, the square's
 *  arrival (shared by all four) and the square's exit node for that deck, bound back to its road */
export function portalLinks(): PortalLinkRow[] {
  return ringPortalLinks({ roads: DECK_PORTALS, roadFloor: deckFloorId, arrival: { id: SQUARE_ARRIVAL_AT.id, pose: SQUARE_ARRIVAL, floor: SQUARE_FLOOR }, out: SQUARE_PORTAL, outFloor: SQUARE_FLOOR, route: SQUARE_ROUTE });
}

/** the decks are ENTRY_WIDTH wide: the trigger stays inside the opening, clear of the parapets */
export const PORTAL_FITS_DECK = PORTAL_TRIGGER.half < ENTRY_WIDTH / 2;

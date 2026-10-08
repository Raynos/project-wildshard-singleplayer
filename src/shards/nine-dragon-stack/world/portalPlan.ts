// G224 (Jake, 2026-10-07, E435): Nine Dragon's entries are portals. The fragment floats at +125 m and covers ~8 % of its
// cell, so it builds no corridors out to the edges: each of the four road-height landing decks (world/entries.ts) carries
// a floating portal that sends you to Lantern Square, and the square has ONE portal out that sends you to one of the four
// decks. Pure numbers (no three.js scene, no DOM): the look (world/portals.ts), the walk-in ride (world/portalRide.ts),
// the tests and the format's declared portal link (SF8c, `portalLinks`) all read this one plan.
import { CHUNK_HALF, ENTRY_ASPHALT, ENTRY_WIDTH } from '@wildshard/engine/core/config';
import { PLAZA, Y0 } from '../layout';

/** a cell edge, as the shardfile names them (north is +z) */
export type ShardEdge = 'north' | 'east' | 'south' | 'west';

/** the ring's radius to its tube's centre, the tube's radius, and how high its centre floats over the floor */
export const RING = { r: 2.1, tube: 0.16, lift: 2.75 } as const;
/** how far in from the cell edge a deck's portal stands: on the socket's last metre (SF8c: a road portal stands 0.5 to
 *  14.5 m in), two metres in front of the 16 m deck's end wall; it has no collider, so the road stays clear */
export const DECK_PORTAL_A = ENTRY_ASPHALT - 1;
/** the walk-in trigger: from this far in front of the ring's plane to this far behind it (m), and the ring's inner width */
const TRIGGER_FRONT = 0.7, TRIGGER_BACK = 1.4, TRIGGER_HALF = RING.r - RING.tube;
/** where a ride out of the square lands on a deck: this far in from the edge (on the socket), facing the road */
export const DECK_ARRIVAL_A = 10;

/** one portal: where its ring stands (feet height `y`), the unit normal its face looks along (the way you walk in) */
export interface Portal {
  readonly id: string;
  readonly x: number; readonly y: number; readonly z: number;
  /** the unit vector a walker crosses the ring along (horizontal) */
  readonly nx: number; readonly nz: number;
}
/** a deck's portal: its edge, and the deck's frame (the edge midpoint, the inward unit axis) */
export interface DeckPortal extends Portal { readonly edge: ShardEdge; readonly mx: number; readonly mz: number }

/** the four decks in the format's edge order (north is +z: world/entries.ts FRAMES) */
const EDGES: readonly { edge: ShardEdge; mx: number; mz: number; ix: number; iz: number }[] = [
  { edge: 'north', mx: 0, mz: CHUNK_HALF, ix: 0, iz: -1 }, { edge: 'east', mx: CHUNK_HALF, mz: 0, ix: -1, iz: 0 },
  { edge: 'south', mx: 0, mz: -CHUNK_HALF, ix: 0, iz: 1 }, { edge: 'west', mx: -CHUNK_HALF, mz: 0, ix: 1, iz: 0 },
];

export const DECK_PORTALS: readonly DeckPortal[] = EDGES.map((e) => ({
  id: `portal.${e.edge}`, edge: e.edge, mx: e.mx, mz: e.mz,
  x: e.mx + e.ix * DECK_PORTAL_A, y: 0, z: e.mz + e.iz * DECK_PORTAL_A, nx: e.ix, nz: e.iz,
}));

/**
 * the square's one portal out: at the square's north end, beside the paifang's east bay and short of the banyan's
 * planter, walked into going north; the arrival looks up the square at it (the south half is the night market, and the
 * street through the gate is the walk route's, scripts/physics-route.json)
 */
export const SQUARE_PORTAL: Portal = { id: 'portal.square', x: 12, y: Y0, z: PLAZA.z0 + 6, nx: 0, nz: -1 };

/** a player pose: feet and yaw (the engine's: forward is (−sin yaw, −cos yaw)) */
export interface Pose { readonly x: number; readonly y: number; readonly z: number; readonly yaw: number }
/** the yaw that looks along (dx, dz) */
export const yawAlong = (dx: number, dz: number): number => Math.atan2(-dx, -dz) + 0; // never −0 (JSON data)

/**
 * Arriving in Lantern Square: the spawn's own spot by the Well's balustrade, facing up the square toward the paifang
 * (shard.config.ts `spawn`), the portal out ~30 m ahead, just right of the paifang.
 */
export const SQUARE_ARRIVAL: Pose = { x: 0.95, y: Y0, z: 7.5, yaw: -12 * (Math.PI / 180) };

/** arriving on a deck from the square: on its socket, DECK_ARRIVAL_A in from the edge, facing out along the road */
export function deckArrival(p: DeckPortal): Pose {
  const ix = p.nx, iz = p.nz;
  return { x: p.mx + ix * DECK_ARRIVAL_A, y: 0, z: p.mz + iz * DECK_ARRIVAL_A, yaw: yawAlong(-ix, -iz) };
}

/**
 * Which deck the square's one portal sends you to (deterministic): back to the deck you came in by, as the format's
 * portal link binds each entry's exit to its own road (SF8c: road -> destination, exit -> road); from a fresh spawn or a
 * reload (nothing entered this session) the north deck.
 */
export function exitDeck(entered: ShardEdge | null): DeckPortal {
  const p = DECK_PORTALS.find((row) => row.edge === (entered ?? 'north'));
  if (p === undefined) throw new Error('Nine Dragon has no deck portal to send you to');
  return p;
}

/** whether feet at (x, y, z) are inside a portal's walk-in volume (inside the ring, crossing its plane) */
export function inPortal(p: Portal, x: number, y: number, z: number): boolean {
  const dx = x - p.x, dz = z - p.z, along = dx * p.nx + dz * p.nz, across = -dx * p.nz + dz * p.nx;
  return along >= -TRIGGER_FRONT && along <= TRIGGER_BACK && Math.abs(across) <= TRIGGER_HALF && y >= p.y - 0.5 && y <= p.y + RING.lift + RING.r;
}

type V3 = [number, number, number];
const v = (x: number, y: number, z: number): V3 => [x + 0, y + 0, z + 0]; // JSON data: never −0
/** the shardfile collider ids the portal nodes stand on (shard.config.ts declares them: world/entries.ts portalFloors) */
export const deckFloorId = (edge: ShardEdge): string => `deck.${edge}`;
export const SQUARE_FLOOR = 'square';
/** the walked route from the arrival up the square, west of the hawker stall, to the portal out (the format's
 *  destination -> exit route) */
export const SQUARE_ROUTE: readonly V3[] = [v(SQUARE_ARRIVAL.x, Y0, SQUARE_ARRIVAL.z), v(5.5, Y0, 2), v(6, Y0, -14), v(SQUARE_PORTAL.x, Y0, SQUARE_PORTAL.z + 3), v(SQUARE_PORTAL.x, Y0, SQUARE_PORTAL.z)];
/**
 * SF8c (G224): each deck's declared portal link in the format's shape (src/game/shardfile/portalLink.ts, sp-x5): the road
 * portal on the deck at y = 0, the square's arrival (shared by all four) and the square's portal out. The format gives
 * each entry its own exit node bound back to its own road, so the one ring in the square is four exit nodes at the same
 * spot (`portal.square.<edge>`), and the ride fires the one bound to the deck you came in by (`exitDeck`).
 */
export function portalLinks(): { edge: ShardEdge; portal: { road: { id: string; at: V3; floor: string; yaw: number }; destination: { id: string; at: V3; floor: string; yaw: number }; exit: { id: string; at: V3; floor: string; yaw: number }; links: { from: string; to: string }[]; route: V3[] } }[] {
  return DECK_PORTALS.map((p) => {
    const road = { id: p.id, at: v(p.x, p.y, p.z), floor: deckFloorId(p.edge), yaw: yawAlong(p.nx, p.nz) };
    const destination = { id: 'portal.square.arrival', at: v(SQUARE_ARRIVAL.x, SQUARE_ARRIVAL.y, SQUARE_ARRIVAL.z), floor: SQUARE_FLOOR, yaw: SQUARE_ARRIVAL.yaw };
    const exit = { id: `portal.square.${p.edge}`, at: v(SQUARE_PORTAL.x, SQUARE_PORTAL.y, SQUARE_PORTAL.z), floor: SQUARE_FLOOR, yaw: yawAlong(SQUARE_PORTAL.nx, SQUARE_PORTAL.nz) };
    return { edge: p.edge, portal: { road, destination, exit, links: [{ from: road.id, to: destination.id }, { from: exit.id, to: road.id }], route: SQUARE_ROUTE.map((q) => v(...q)) } };
  });
}

/** the decks are ENTRY_WIDTH wide: the trigger stays inside the opening, clear of the parapets */
export const PORTAL_FITS_DECK = TRIGGER_HALF < ENTRY_WIDTH / 2;

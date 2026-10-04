import { CHUNK_HALF, ENTRY_ASPHALT, ENTRY_WIDTH } from '@wildshard/engine/core/config';
import { CROWN, GROVE, ROOST, SUNREST, rimAlong, type Isle } from '../layout';

/**
 * SHARD-PLATFORM SF49-g (G99 / G102, Jake: "B Switchback ramp"): Sky Reach's four legal entryways. At each edge midpoint a
 * plank landing at road height (top y = 0) meets the far end of the platform's 8 × 15 m entry socket; from it a timber
 * switchback tower climbs in two stacked lanes (`SWITCHBACK.rise` per flight, a level landing at every turn) and a plank
 * causeway on trestles climbs on, straight inward, to the nearest island's rim. Pure data: the shardfile declares the four
 * landings from it (shard.config.ts, the socket-landing proof), world/entries.ts builds the meshes and colliders from it.
 *
 * Each entry is laid out in its own frame: `t` runs along the edge (metres from the midpoint, to the tower's side), `u`
 * runs inward from the cell edge. The socket covers |t| ≤ 4, u 0…15; the road landing starts at u = 15.
 */
export type EntryEdge = 'north' | 'east' | 'south' | 'west';

export const SWITCHBACK = {
  /** a flight's and the causeway's walking width (metres) */
  lane: 3,
  /** the slot between the two stacked lanes (narrower than the player's 0.76 m capsule) */
  gap: 0.5,
  /** a flight's run along the edge and its rise: 11.3°, far under the 40° climb */
  run: 15, rise: 3,
  /** the turn landings' length along the edge */
  turn: 3,
  /** the road landing: from `landing` m beside the midpoint to the first flight */
  landing: 5,
  /** the causeway's grade: the tower takes the climb above 6.5°; a short causeway to a high rim may reach 8° */
  causeway: Math.tan((6.5 * Math.PI) / 180), steepest: Math.tan((8 * Math.PI) / 180),
  /** how far the causeway's last level deck runs onto the island past its rim */
  overlap: 2,
  /** the level stub from the tower's top landing to the causeway */
  stub: 3,
  /** rail height and thickness, deck thickness */
  rail: 1.1, railThick: 0.12, deck: 0.2,
} as const;

const U0 = ENTRY_ASPHALT;                                                         // the road landing's socket side
const UA = [U0, U0 + SWITCHBACK.lane] as const;                                    // lane A (even flights)
const UB = [UA[1] + SWITCHBACK.gap, UA[1] + SWITCHBACK.gap + SWITCHBACK.lane] as const; // lane B (odd flights)
const U1 = UB[1];
const T_NEAR = SWITCHBACK.landing, T_F0 = T_NEAR + SWITCHBACK.turn, T_F1 = T_F0 + SWITCHBACK.run, T_FAR = T_F1 + SWITCHBACK.turn;
/** the tower's post lines: along the edge (the turn landings' ends) and inward (the two lanes' outer sides) */
export const TOWER = { t: [T_NEAR, T_F0, T_F1, T_FAR], u: [U0, U1] } as const;
/** where the climb leaves the tower: the middle of the near turn landings */
const T_EXIT = (T_NEAR + T_F0) / 2;
/** the socket's half width plus a hair: the road landing's edge rails stop short of the opening */
const OPEN = ENTRY_WIDTH / 2 + 0.05;

export interface P3 { readonly x: number; readonly y: number; readonly z: number }
/** A straight piece along a→b: a deck (the line is its top centre) or a rail (the line is its foot); `width` across. */
export interface Slab { readonly role: 'deck' | 'rail'; readonly a: P3; readonly b: P3; readonly width: number }
/** A plain axis-aligned box (the shardfile's collider shape): the road landing. */
export interface LandingBox { readonly kind: 'box'; readonly x: number; readonly y: number; readonly z: number; readonly hx: number; readonly hy: number; readonly hz: number; readonly surface: 'wood' }
/** A visual timber post from `from` up to `to` (y), at (x, z). */
export interface Post { readonly x: number; readonly z: number; readonly from: number; readonly to: number }
export interface EntryRamp {
  readonly edge: EntryEdge;
  readonly isle: Isle;
  /** flights in the tower (even, so the top landing is on the near side) */
  readonly flights: number;
  /** the road landing: declared by the shardfile, installed exactly */
  readonly landing: LandingBox;
  readonly slabs: readonly Slab[];
  readonly posts: readonly Post[];
  /** the walk from the socket's far edge to the island top (x, z, the deck height there) */
  readonly path: readonly P3[];
  /** frame helper: (t, u, y) to world */
  readonly at: (t: number, u: number, y: number) => P3;
}

const OUTWARD: Readonly<Record<EntryEdge, readonly [number, number]>> = { north: [0, 1], east: [1, 0], south: [0, -1], west: [-1, 0] };
/** The entry's frame: `side` picks which way along the edge the tower stands (so the causeway reaches its island). */
export function entryFrame(edge: EntryEdge, side: 1 | -1): (t: number, u: number, y: number) => P3 {
  const [ox, oz] = OUTWARD[edge], tx = -oz * side, tz = ox * side;
  return (t, u, y) => ({ x: ox * (CHUNK_HALF - u) + tx * t, y, z: oz * (CHUNK_HALF - u) + tz * t });
}
/** Is (x, z) on the island's 12-gon top? */
function onIsle(isle: Isle, x: number, z: number): boolean {
  const dx = x - isle.x, dz = z - isle.z;
  return Math.hypot(dx, dz) <= rimAlong(isle, Math.atan2(dz, dx));
}

function ramp(edge: EntryEdge, isle: Isle, side: 1 | -1): EntryRamp {
  const at = entryFrame(edge, side), S = SWITCHBACK, laneMid = (lane: readonly [number, number]): number => (lane[0] + lane[1]) / 2;
  // the causeway runs straight inward at the exit's t until it crosses the island's rim
  const stubEnd = U1 + S.stub;
  let rim = stubEnd;
  for (; rim < 2 * CHUNK_HALF; rim += 0.05) { const p = at(T_EXIT, rim, 0); if (onIsle(isle, p.x, p.z)) break; }
  if (rim >= 2 * CHUNK_HALF) throw new Error(`Sky Reach entry ${edge}: the causeway misses ${isle.id}`);
  const run = rim - stubEnd;
  let flights = 2;
  while (isle.y - (flights + 2) * S.rise >= 0 && (isle.y - flights * S.rise) / run > S.causeway) flights += 2;
  const top = flights * S.rise;
  if (top > isle.y || (isle.y - top) / run > S.steepest) throw new Error(`Sky Reach entry ${edge}: no switchback fits ${isle.id}`);

  const slabs: Slab[] = [], deck = (a: P3, b: P3, width: number): void => { slabs.push({ role: 'deck', a, b, width }); };
  const rail = (a: P3, b: P3): void => { slabs.push({ role: 'rail', a, b, width: S.railThick }); };
  const railT = (t0: number, t1: number, u: number, y0: number, y1: number): void => { rail(at(t0, u, y0), at(t1, u, y1)); };
  const railU = (u0: number, u1: number, t: number, y0: number, y1: number): void => { rail(at(t, u0, y0), at(t, u1, y1)); };
  const mid = (U0 + U1) / 2, across = U1 - U0, ext = 0.15;
  // the road landing (declared; installed exactly): rails on its three open sides, the opening onto the socket left clear
  const c = at((-T_NEAR + T_F0) / 2, mid, 0), alongX = OUTWARD[edge][0] === 0, half = (T_F0 + T_NEAR) / 2;
  const landing: LandingBox = { kind: 'box', x: c.x, y: -S.deck / 2, z: c.z, hx: alongX ? half : across / 2, hy: S.deck / 2, hz: alongX ? across / 2 : half, surface: 'wood' };
  railU(U0, U1, -T_NEAR, 0, 0); railT(-T_NEAR, T_F0, U1, 0, 0);
  railT(-T_NEAR, -OPEN, U0, 0, 0); railT(OPEN, T_F0, U0, 0, 0);
  railU(UA[1], U1, T_F0, 0, 0); // lane B is open air at road height
  for (let k = 0; k < flights; k++) {
    const lane = k % 2 === 0 ? UA : UB, up = k % 2 === 0, y0 = k * S.rise, y1 = y0 + S.rise;
    const ta = up ? T_F0 : T_F1, tb = up ? T_F1 : T_F0, dir = Math.sign(tb - ta);
    deck(at(ta - dir * ext, laneMid(lane), y0 - ext * S.rise / S.run), at(tb + dir * ext, laneMid(lane), y1 + ext * S.rise / S.run), S.lane);
    railT(ta, tb, lane[0], y0, y1); railT(ta, tb, lane[1], y0, y1);
    // the turn landing at the flight's top: across both lanes, railed on its open sides
    const far = up, t0 = far ? T_F1 : T_NEAR, t1 = far ? T_FAR : T_F0;
    deck(at(t0, mid, y1), at(t1, mid, y1), across);
    const end = far ? T_FAR : T_NEAR;
    railU(U0, U1, end, y1, y1); railT(t0, t1, U0, y1, y1);
    if (k < flights - 1) railT(t0, t1, U1, y1, y1);
    else railU(U0, UB[0], T_F0, y1, y1); // the top landing: no flight above lane A; the stub leaves through its inner side
  }
  // the stub and the causeway: straight inward at T_EXIT, rails both sides, a level deck onto the island past its rim
  deck(at(T_EXIT, U1 - ext, top), at(T_EXIT, stubEnd, top), S.lane);
  deck(at(T_EXIT, stubEnd - ext, top), at(T_EXIT, rim, isle.y), S.lane);
  deck(at(T_EXIT, rim - ext, isle.y), at(T_EXIT, rim + S.overlap, isle.y), S.lane);
  for (const t of [T_NEAR, T_F0]) { railU(U1, stubEnd, t, top, top); railU(stubEnd, rim, t, top, isle.y); }

  // timber: the tower's corner and flight-end posts down into the cloud sea, the causeway's bents every ~10 m
  const posts: Post[] = [], foot = -45;
  for (const t of TOWER.t) for (const u of TOWER.u) { const p = at(t, u, 0); posts.push({ x: p.x, z: p.z, from: foot, to: top + S.rail }); }
  for (const u of TOWER.u) { const p = at(-T_NEAR, u, 0); posts.push({ x: p.x, z: p.z, from: foot, to: S.rail }); }
  const bents = Math.max(1, Math.round(run / 10));
  for (let i = 1; i < bents; i++) {
    const u = stubEnd + (run * i) / bents, y = top + ((isle.y - top) * i) / bents;
    for (const t of [T_NEAR, T_F0]) { const p = at(t, u, 0); posts.push({ x: p.x, z: p.z, from: foot, to: y + S.rail }); }
  }
  // the walk: across the landing, up every flight by its lane's middle, round every turn, out along the causeway
  const path: P3[] = [at(0, U0 + 0.5, 0), at(T_EXIT, laneMid(UA), 0)];
  for (let k = 0; k < flights; k++) {
    const lane = laneMid(k % 2 === 0 ? UA : UB), up = k % 2 === 0, y1 = (k + 1) * S.rise;
    path.push(at(up ? T_F0 : T_F1, lane, k * S.rise), at(up ? T_F1 : T_F0, lane, y1));
    const turn = up ? (T_F1 + T_FAR) / 2 : T_EXIT, next = laneMid(k % 2 === 0 ? UB : UA);
    path.push(at(turn, lane, y1), at(turn, k < flights - 1 ? next : U1, y1));
  }
  path.push(at(T_EXIT, stubEnd, top), at(T_EXIT, rim, isle.y), at(T_EXIT, rim + S.overlap + 2, isle.y));
  return { edge, isle, flights, landing, slabs, posts, path, at };
}

/** The four entries: each to its nearest island, the tower on the side that sends the causeway straight onto it. */
export const ENTRY_RAMPS: readonly EntryRamp[] = [
  ramp('north', SUNREST, -1), ramp('east', ROOST, -1), ramp('south', CROWN, 1), ramp('west', GROVE, -1),
];

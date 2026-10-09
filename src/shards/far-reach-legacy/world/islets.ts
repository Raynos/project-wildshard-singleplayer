import { CHUNK_HALF, ENTRY_ASPHALT, ENTRY_WIDTH } from '@wildshard/engine/core/config';
import { GROVE, ROOST, RUIN, SUNREST, type Isle, type Span } from '../data/layout';
import { apothem, rimAlong } from '../layout';

/**
 * SHARD-PLATFORM SF49-g (G183, Jake 2026-10-07: "4, the Rising Islet"): Sky Reach's four legal entryways. At each edge
 * midpoint a stone lip at road height (top y = 0) meets the far end of the platform's 8 × 15 m entry socket; beside it a
 * small grass islet rests level with the road and rises on chains (one SF30 kinematic mover, behaviour/islet.as) to a
 * gate isle about 50 m in and 25 m up; a rope bridge ties the gate isle to the nearest island that no quest gates (the
 * south one goes to the ruin isle, never into the storm-crown arena). Pure data: the shardfile declares the four lips from
 * it (shard.config.ts, the socket-landing proof: a moving deck can't prove a permanent walk surface), world/risingIslet.ts
 * builds the meshes, colliders and the mover rows from it.
 *
 * Each entry is laid out in its own frame: `t` runs along the edge (metres from the midpoint), `u` runs inward from the
 * cell edge. The socket covers |t| ≤ 4, u 0…15; the lip runs u 15…15 + LIP.depth.
 */
export type EntryEdge = 'north' | 'east' | 'south' | 'west';

export const ISLET = {
  /** the static stone lip the socket lands on: depth inward, width along the edge (past the 8 m socket), thickness */
  lip: { depth: 1.5, width: ENTRY_WIDTH + 1, thick: 0.6 },
  /** the moving islet: its 12-gon's corner radius and rock keel depth (it reads as a small floating isle) */
  islet: { r: 5.6, keel: 7 },
  /** the gate isle: how far in and how high its deck sits, its rim radius and keel */
  gate: { u: 52, y: 25, r: 9.5, keel: 15 },
  /** the walk gap between the lip and the resting islet, and between the docked islet and the gate isle (SF8c's socketLift
   *  allows at most 5 cm at a road stop) */
  gap: 0.04,
  /** the ride: seconds at rest at each end, average speed along the chains (m/s; the eased peak is 1.11×) */
  dwell: 6, speed: 2.2,
  /** the rope bridge's walking width */
  bridge: 2.4,
  /** the stationary road gate (SF8c socketLift): a timber bar across the lip's road edge, closed while the islet is away
   *  (u from the socket's inner line, its depth and height, and its width past the 8 m opening) */
  gateBar: { depth: 0.2, height: 2.2, width: ENTRY_WIDTH + 0.6 },
  /** the static approach's waypoint on the lip (metres in from the socket's inner line) */
  approachU: 1,
  /** the fixed steps a ride may take past its travel (the platform's ride bound, SF8c) */
  rideSlack: 30,
} as const;

export interface P3 { readonly x: number; readonly y: number; readonly z: number }
/** A plain axis-aligned box (the shardfile's collider shape): the road lip. */
export interface LandingBox { readonly kind: 'box'; readonly x: number; readonly y: number; readonly z: number; readonly hx: number; readonly hy: number; readonly hz: number; readonly surface: 'stone' }
/** The stationary road gate's box (feet frame, axis-aligned): it blocks the socket's whole 8 m inner line. */
export interface GateBox { readonly x: number; readonly y: number; readonly z: number; readonly hx: number; readonly hy: number; readonly hz: number }
/** A gate isle's walk strips as the shardfile declares them (world/build.ts islandColliders' exact boxes, yaw form). */
export interface IsleStrip { readonly kind: 'box'; readonly x: number; readonly y: number; readonly z: number; readonly hx: number; readonly hy: number; readonly hz: number; readonly yaw: number; readonly surface: 'grass' }
export interface RisingIslet {
  readonly edge: EntryEdge;
  /** the stationary road gate (closed while the islet is away) */
  readonly gateBar: GateBox;
  /** SF8c's socketLift link: the islet's road and top stops, the walk from the top stop onto the gate isle's ground, the
   *  static approach over the lip, and the ride's fixed-step bound */
  readonly lift: { readonly route: readonly P3[]; readonly approach: readonly P3[]; readonly rideTicks: number };
  /** the playable island the rope bridge reaches */
  readonly isle: Isle;
  /** the static lip at road height: declared by the shardfile, installed exactly */
  readonly landing: LandingBox;
  /** the islet's deck centre at rest (y 0, against the lip) and docked (at the gate isle's deck height, against its rim) */
  readonly rest: P3;
  readonly dock: P3;
  /** seconds one way along the chains */
  readonly travel: number;
  /** the gate isle (an ordinary island of the shard's own builder) */
  readonly gate: Isle;
  /** the rope bridge from the gate isle's far rim to the island's rim */
  readonly bridge: Span;
  /** the walk: the socket's far edge → onto the resting islet (leg 1); the docked islet → gate isle → bridge → island top (leg 2) */
  readonly board: readonly P3[];
  readonly climb: readonly P3[];
  /** frame helper: (t, u, y) to world */
  readonly at: (t: number, u: number, y: number) => P3;
}

const OUTWARD: Readonly<Record<EntryEdge, readonly [number, number]>> = { north: [0, 1], east: [1, 0], south: [0, -1], west: [-1, 0] };
/** The entry's frame: `t` along the edge (to the right looking inward), `u` inward from the cell edge. */
export function entryFrame(edge: EntryEdge): (t: number, u: number, y: number) => P3 {
  const [ox, oz] = OUTWARD[edge], tx = -oz, tz = ox;
  return (t, u, y) => ({ x: ox * (CHUNK_HALF - u) + tx * t, y, z: oz * (CHUNK_HALF - u) + tz * t });
}
/** The rope span between two islands' rims, overlapping each by a metre (layout's `along` for rope bridges). */
function rope(id: string, a: Isle, b: Isle, width: number): Span {
  const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), ux = dx / d, uz = dz / d;
  const ra = rimAlong(a, Math.atan2(uz, ux)) - 1, rb = rimAlong(b, Math.atan2(-uz, -ux)) - 1;
  return { id, kind: 'rope', x0: a.x + ux * ra, z0: a.z + uz * ra, x1: b.x - ux * rb, z1: b.z - uz * rb, y: a.y, y1: b.y, width };
}

/** One entry: `gateT` shifts the gate isle along the edge (the south one clears the storm crown overhead). */
function islet(edge: EntryEdge, isle: Isle, gateT: number): RisingIslet {
  const at = entryFrame(edge), I = ISLET, U0 = ENTRY_ASPHALT, lipU = U0 + I.lip.depth / 2;
  const isletR = apothem({ id: 'islet', x: 0, z: 0, r: I.islet.r, y: 0, keel: I.islet.keel });
  const g = at(gateT, I.gate.u, I.gate.y), gate: Isle = { id: `gate.${edge}`, x: g.x, z: g.z, r: I.gate.r, y: I.gate.y, keel: I.gate.keel };
  const r = at(0, U0 + I.lip.depth + I.gap + isletR, 0), rest: P3 = r;
  // docked: against the gate isle's rim on the line from the resting islet, deck level with the gate isle's
  const dx = gate.x - rest.x, dz = gate.z - rest.z, d = Math.hypot(dx, dz), reach = d - apothem(gate) - isletR - I.gap;
  const dock: P3 = { x: rest.x + (dx / d) * reach, y: gate.y, z: rest.z + (dz / d) * reach };
  const length = Math.hypot(dock.x - rest.x, dock.y - rest.y, dock.z - rest.z), travel = Math.round((length / I.speed) * 10) / 10;
  const c = at(0, lipU, 0), alongX = OUTWARD[edge][0] === 0;
  const landing: LandingBox = { kind: 'box', x: c.x, y: -I.lip.thick / 2, z: c.z, hx: alongX ? I.lip.width / 2 : I.lip.depth / 2, hy: I.lip.thick / 2, hz: alongX ? I.lip.depth / 2 : I.lip.width / 2, surface: 'stone' };
  const bridge = rope(`far.rope.gate.${edge}`, gate, isle, I.bridge);
  const inward = (p: P3, k: number): P3 => ({ x: p.x + (dx / d) * k, y: p.y, z: p.z + (dz / d) * k });
  const bx = bridge.x1 - bridge.x0, bz = bridge.z1 - bridge.z0, bl = Math.hypot(bx, bz);
  const board: P3[] = [at(0, U0 + 0.5, 0), at(0, U0 + I.lip.depth + 1, 0), { ...rest }];
  // the gate bar stands on the lip, its road face on the socket's inner line; the static approach crosses the lip
  const gc = at(0, U0 + I.gateBar.depth / 2, I.gateBar.height / 2);
  const gateBar: GateBox = { x: gc.x, y: gc.y, z: gc.z, hx: alongX ? I.gateBar.width / 2 : I.gateBar.depth / 2, hy: I.gateBar.height / 2, hz: alongX ? I.gateBar.depth / 2 : I.gateBar.width / 2 };
  const lift = { route: [{ ...dock }, inward(dock, isletR + 2), { x: gate.x, y: gate.y, z: gate.z }], approach: [at(0, U0, 0), at(0, U0 + I.approachU, 0)],
    rideTicks: Math.ceil(travel * 60) + I.rideSlack };
  const climb: P3[] = [{ ...dock }, inward(dock, isletR + 2), { x: gate.x, y: gate.y, z: gate.z }, { x: bridge.x0 - (bx / bl) * 2, y: gate.y, z: bridge.z0 - (bz / bl) * 2 },
    { x: bridge.x0, y: bridge.y, z: bridge.z0 }, { x: bridge.x1, y: bridge.y1, z: bridge.z1 }, { x: bridge.x1 + (bx / bl) * 4, y: isle.y, z: bridge.z1 + (bz / bl) * 4 }];
  return { edge, isle, landing, rest, dock, travel, gate, bridge, board, climb, at, gateBar, lift };
}

/**
 * The four entries, each to the nearest island no quest gates: north to Sunrest (the spawn isle), east to the roost, west
 * to the grove; south to the ruin isle (G183: never into the storm-crown arena), its gate isle 40 m east of the midpoint so
 * the islet's climb and the gate isle clear the crown's keel overhead. The east gate isle stands 58 m north of the
 * midpoint, so its bridge lands on the roost's rim between two of its sandstone spires (world/roost.ts, at 0.05 and 0.9
 * rad); straight in from the midpoint the bridge ran into the 0.05 spire and the walk stalled there (g183 ride, 2026-10-07).
 */
export const RISING_ISLETS: readonly RisingIslet[] = [
  islet('north', SUNREST, 0), islet('east', ROOST, 58), islet('south', RUIN, 40), islet('west', GROVE, 0),
];

/** A gate isle's six walk strips 30° apart (world/build.ts islandColliders, in the shardfile's yaw form). */
export function isleStrips(isle: Isle): IsleStrip[] {
  const half = apothem(isle), width = isle.r * 0.26;
  return [0, 1, 2, 3, 4, 5].map((i) => ({ kind: 'box', x: isle.x, y: isle.y - 1, z: isle.z, hx: half, hy: 1, hz: width, yaw: 0 - (i * Math.PI) / 6, surface: 'grass' }));
}

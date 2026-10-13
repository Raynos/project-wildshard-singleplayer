import type { Isle, Span } from './layout';

/** Rising Islet dimensions in metres; generator emits the four admitted SDK SocketLift entries. */
export const ISLET = {
  /** the static stone lip the socket lands on: depth inward, width along the edge (past the 8 m socket), thickness */
  lip: { depth: 1.5, width: 9, thick: 0.6 },
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
  gateBar: { depth: 0.2, height: 2.2, width: 8.6 },
  /** the static approach's waypoint on the lip (metres in from the socket's inner line) */
  approachU: 1,
  /** the fixed steps a ride may take past its travel (the platform's ride bound, SF8c) */
  rideSlack: 30,
} as const;

/** Entry order is also the shipping mover and prompt registration order. */
export const ISLET_EDGES = ['north', 'east', 'south', 'west'] as const;
/** The platform's road socket is fifteen metres deep; a lip begins on its inner line. */
export const SOCKET_DEPTH = 15;

/** The four fixed road socket sides. */
export type EntryEdge = 'north' | 'east' | 'south' | 'west';

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


/** The moving deck's authored footprint; its exact row also feeds the offline collider/rig recipes. */
export const ISLET_ISLE: Isle = { id: 'islet', x: 0, z: 0, r: ISLET.islet.r, y: 0, keel: ISLET.islet.keel };

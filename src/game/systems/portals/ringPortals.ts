// ringPortals — floating ring portals a walker steps through (SHARD-PLATFORM M3, ex Nine Dragon's world/portalPlan.ts,
// G224): pure numbers, no scene. A shard whose entries are the format's `portalLink` kind (SF8c, game shardfile/portalLink)
// stands one ring on each road edge's deck and one ring of its own as the way out. This module places the road rings at
// the cell's edge midpoints, tests whether feet are inside a ring's walk-in volume, picks the road the way out leads back
// to, and writes each entry's declared portal link in the format's shape (the road node, the shared arrival, the exit
// node bound back to that road, the walked route).
//
//   const roads = edgePortals(CHUNK_HALF, ENTRY_ASPHALT - 1);
//   inRingPortal(roads[0], { front: 0.6, back: 0.6, half: 1, feet: 0.15 }, x, y, z);

/** a cell edge, as the shardfile names them (north is +z) */
export type ShardEdge = 'north' | 'east' | 'south' | 'west';

/** one ring: where it stands (feet height `y`) and the horizontal unit vector a walker crosses it along */
export interface RingPortal {
  readonly id: string;
  readonly x: number; readonly y: number; readonly z: number;
  /** the unit vector a walker crosses the ring along (horizontal) */
  readonly nx: number; readonly nz: number;
}
/** a road edge's ring: its edge, and the deck's frame (the edge midpoint) */
export interface EdgePortal extends RingPortal { readonly edge: ShardEdge; readonly mx: number; readonly mz: number }

/** a ring's walk-in volume: from `front` m in front of its plane to `back` m behind it, `half` m either side of its
 *  centre line, the feet within `feet` m of its floor */
export interface RingTrigger { readonly front: number; readonly back: number; readonly half: number; readonly feet: number }

/** a player pose: feet and yaw (the engine's: forward is (−sin yaw, −cos yaw)) */
export interface Pose { readonly x: number; readonly y: number; readonly z: number; readonly yaw: number }

/** the yaw that looks along (dx, dz) */
export const yawAlong = (dx: number, dz: number): number => Math.atan2(-dx, -dz) + 0; // never −0 (JSON data)

/** the four road edges in the format's order: the midpoint's direction and the inward axis */
const EDGES: readonly { edge: ShardEdge; mx: number; mz: number; ix: number; iz: number }[] = [
  { edge: 'north', mx: 0, mz: 1, ix: 0, iz: -1 }, { edge: 'east', mx: 1, mz: 0, ix: -1, iz: 0 },
  { edge: 'south', mx: 0, mz: -1, ix: 0, iz: 1 }, { edge: 'west', mx: -1, mz: 0, ix: 1, iz: 0 },
];

/** the four road rings (`portal.<edge>`, feet at y 0), `inset` m in from the edge midpoints of a cell reaching `half` m
 *  from its centre, walked into going inward */
export function edgePortals(half: number, inset: number): EdgePortal[] {
  return EDGES.map((e) => {
    const mx = e.mx * half, mz = e.mz * half;
    return { id: `portal.${e.edge}`, edge: e.edge, mx, mz, x: mx + e.ix * inset, y: 0, z: mz + e.iz * inset, nx: e.ix, nz: e.iz };
  });
}

/** arriving at a road ring from the way out: out of the ring itself, facing out along the road */
export function edgeArrival(p: EdgePortal): Pose { return { x: p.x, y: p.y, z: p.z, yaw: yawAlong(-p.nx, -p.nz) }; }

/** whether feet at (x, y, z) are inside a ring's walk-in volume (through its middle, crossing its plane, on its floor) */
export function inRingPortal(p: RingPortal, t: RingTrigger, x: number, y: number, z: number): boolean {
  const dx = x - p.x, dz = z - p.z, along = dx * p.nx + dz * p.nz, across = -dx * p.nz + dz * p.nx;
  return along >= -t.front && along <= t.back && Math.abs(across) <= t.half && Math.abs(y - p.y) <= t.feet;
}

/** the road the way out leads back to: the one you came in by (the format binds each entry's exit to its own road), else
 *  the first road (a fresh spawn or a reload) */
export function exitRoad(roads: readonly EdgePortal[], entered: ShardEdge | null): EdgePortal {
  const p = roads.find((row) => row.edge === (entered ?? roads[0]?.edge));
  if (p === undefined) throw new Error('ringPortals: no road portal to send you to');
  return p;
}

/** the way out's exit node bound back to one road (one per entry, all at the way out's one ring) */
export const exitNodeId = (out: RingPortal, edge: ShardEdge): string => `${out.id}.${edge}`;

type V3 = [number, number, number];
const v = (x: number, y: number, z: number): V3 => [x + 0, y + 0, z + 0]; // JSON data: never −0

/** one portal node in the format's shape */
export interface PortalNodeRow { id: string; at: V3; floor: string; yaw: number }
/** one entry's declared portal link in the format's shape (game shardfile/portalLink.ts) */
export interface PortalLinkRow {
  edge: ShardEdge;
  portal: { road: PortalNodeRow; destination: PortalNodeRow; exit: PortalNodeRow; links: { from: string; to: string }[]; route: V3[] };
}

/** what the links are written from: the road rings and the floor each stands on, the arrival node shared by every road,
 *  the way out's ring and its floor, and the walked route from the arrival to it */
export interface RingPortalPlan {
  readonly roads: readonly EdgePortal[];
  readonly roadFloor: (edge: ShardEdge) => string;
  readonly arrival: { readonly id: string; readonly pose: Pose; readonly floor: string };
  readonly out: RingPortal;
  readonly outFloor: string;
  readonly route: readonly (readonly [number, number, number])[];
}

/** each road's declared portal link: road → arrival, and the way out's exit node for that road → the road */
export function ringPortalLinks(plan: RingPortalPlan): PortalLinkRow[] {
  const { arrival, out } = plan;
  return plan.roads.map((p) => {
    const road = { id: p.id, at: v(p.x, p.y, p.z), floor: plan.roadFloor(p.edge), yaw: edgeArrival(p).yaw };
    const destination = { id: arrival.id, at: v(arrival.pose.x, arrival.pose.y, arrival.pose.z), floor: arrival.floor, yaw: arrival.pose.yaw };
    const exit = { id: exitNodeId(out, p.edge), at: v(out.x, out.y, out.z), floor: plan.outFloor, yaw: yawAlong(out.nx, out.nz) };
    return { edge: p.edge, portal: { road, destination, exit, links: [{ from: road.id, to: destination.id }, { from: exit.id, to: road.id }], route: plan.route.map((q) => v(q[0], q[1], q[2])) } };
  });
}

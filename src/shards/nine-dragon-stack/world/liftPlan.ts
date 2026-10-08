// SF51-p (G184, E435): the lantern lifts' plan, as data the world, the plugin and the mover bake share (world/lifts.ts
// builds their look; generators/movers.ts bakes their mover rows from it). Pure numbers: no three.js scene, no DOM.
import { CHUNK_HALF, ENTRY_ASPHALT, ENTRY_WIDTH } from '@wildshard/engine/core/config';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import type { MoverBox } from '@wildshard/engine/physics/mover';
import { Y0 } from '../layout';
/** the ride, bottom to top (seconds; G184: about 16 s) */
export const RIDE = 16;
/** SF8c: how long the cage rests at the winch house before its automatic idle return to the deck (seconds) */
export const DWELL = 6;
/** SF8c: the fixed steps a ride may take past its travel (the platform's ride bound) */
export const RIDE_SLACK = 30;
/** the cage's half width (a 3.2 m square box) and its height to the roof's underside */
export const CAGE = 1.6, CAGE_H = 2.6;
/** the shaft's corner posts stand this far from its centre */
export const POST = 1.95;
/** one timber frame of the shaft (metres) */
export const FRAME_STEP = 5;
/** the chain's link pitch and the two chains' offset across the cage (between its wall and the posts) */
export const LINK = 0.45, CHAIN_X = 1.76;
/** how far in from the cell edge the cage stands: past the 16 m deck and its 0.8 m end wall */
export const ALONG = 16.8 + CAGE;

/** one lift: the deck it starts from (its edge midpoint and inward axis), where across the deck its shaft stands, its top */
export interface Lift {
  readonly id: string;
  /** the deck's edge midpoint and inward unit axis (world/entries.ts FRAMES) */
  readonly mx: number; readonly mz: number; readonly ix: number; readonly iz: number;
  /** the shaft's offset across the deck (world x on a north / south deck, z on an east / west one) */
  readonly across: number;
  /** the winch house's floor: where the ride ends */
  readonly top: number;
}

/**
 * The lifts that are built. `nd.lift.n` is the legacy "north" lift's stable mover id: its deck is the one at z = −250,
 * which the shardfile format calls the SOUTH entry (north is +250), so shard.config.ts declares it as the south
 * socketLift without moving anything. The north deck's shaft stands 2.4 m east of the deck's axis, so at the top the cage opens
 * straight onto the north street's end (x 0.5 … 12.5 at z −230). The south, east and west decks have no fragment floor
 * within a short bridge of their tops yet (SF51-p: a pick for Jake), so they stay closed by their end walls.
 */
export const LIFTS: readonly Lift[] = [
  { id: 'nd.lift.n', mx: 0, mz: -CHUNK_HALF, ix: 0, iz: 1, across: 2.4, top: Y0 },
];

/** the north lift's door onto the street's end, world x from … to (world/colliders.ts closes the street's end round it) */
export const NORTH_DOOR = [2.4 - CAGE - 0.4, 2.4 + CAGE + 0.4] as const;

/** the yaw that turns a lift's local frame (+z inward, toward the fragment) onto the world */
export function liftYaw(l: Lift): number { return Math.atan2(l.ix, l.iz); }

/** a point `a` metres in from the edge and `c` across, in world x / z */
export function frameXZ(l: Lift, a: number, c: number): [number, number] {
  return l.ix === 0 ? [c, l.mz + l.iz * a] : [l.mx + l.ix * a, c];
}

/** the cage's floor centre at the deck */
export function liftBottom(l: Lift): { x: number; y: number; z: number } { const [x, z] = frameXZ(l, ALONG, l.across); return { x, y: 0, z }; }
/** the cage's floor centre at the winch house */
export function liftTop(l: Lift): { x: number; y: number; z: number } { return { ...liftBottom(l), y: l.top }; }

/** an axis-aligned world box from the lift's frame: `a0..a1` in from the edge, `c0..c1` across (offsets from the shaft), `y0..y1` */
function frameBox(l: Lift, a0: number, a1: number, c0: number, c1: number, y0: number, y1: number, surface: ColliderDesc['surface'] = 'stone'): ColliderDesc & { kind: 'box' } {
  const [xa, za] = frameXZ(l, a0, l.across + c0), [xb, zb] = frameXZ(l, a1, l.across + c1);
  return { kind: 'box', x: (xa + xb) / 2, y: (y0 + y1) / 2, z: (za + zb) / 2, hx: Math.abs(xb - xa) / 2, hy: (y1 - y0) / 2, hz: Math.abs(zb - za) / 2, surface };
}

/**
 * SF8c socketLift: the stationary road gate, a lacquered lattice gate across the socket's whole inner line (ENTRY_ASPHALT
 * in from the edge, on the deck's axis), closed whenever the cage is away from the deck (behaviour/lift.as part 2). Its
 * depth, height and its width past the 8 m opening (it stands on the parapets' ends).
 */
export const ROAD_GATE = { depth: 0.2, height: 2.2, width: ENTRY_WIDTH + 0.6 } as const;
/** the road gate's centre in world x / z and its feet-frame box (axis-aligned) */
export function roadGateAt(l: Lift): { x: number; y: number; z: number } {
  const [x, z] = frameXZ(l, ENTRY_ASPHALT + ROAD_GATE.depth / 2, 0);
  return { x, y: ROAD_GATE.height / 2, z };
}
export function roadGateBoxes(l: Lift): MoverBox[] {
  const w = ROAD_GATE.width / 2, d = ROAD_GATE.depth / 2;
  return [{ x: 0, y: 0, z: 0, hx: l.ix === 0 ? w : d, hy: ROAD_GATE.height / 2, hz: l.ix === 0 ? d : w, rot: { x: 0, y: 0, z: 0, w: 1 } }];
}

/** the end wall's door into the shaft (in from the edge, across from the shaft's centre): its jambs stand outside it */
export const DOOR = { a0: 16, a1: 16.8, c0: -CAGE, c1: CAGE, h: 3 } as const;

/** the shaft's static collision: the pit floor under the cage at rest, its back wall at the deck, the winch house's back wall */
export function liftColliders(l: Lift): ColliderDesc[] {
  return [
    // the pit floor under the resting cage, flush with the deck (the cage's own floor covers it when it is down)
    frameBox(l, ALONG - CAGE, ALONG + CAGE, -CAGE, CAGE, -1.2, 0),
    // behind the cage at the deck: the shaft's stone footing
    frameBox(l, ALONG + CAGE + 0.05, ALONG + CAGE + 0.65, -CAGE - 0.4, CAGE + 0.4, 0, 3.4),
    // the winch house's back wall at the top (the deck side: the cage opens only onto the street there)
    frameBox(l, ALONG - CAGE - 0.6, ALONG - CAGE - 0.2, -CAGE - 0.4, CAGE + 0.4, l.top, l.top + 3.4, 'wood'),
  ];
}

/** the cage's colliders in its own frame (floor top at y = 0): the floor, the two lattice sides and the roof */
export function cageBoxes(): MoverBox[] {
  const rot = { x: 0, y: 0, z: 0, w: 1 }, w = CAGE - 0.05;
  return [
    // the floor is flush with the deck and the street at its rests (the engine's mover-deck fix, 76eed8338 / 23e98a2fc,
    // walks a flush kinematic seam; the g184 ride proves on, up, off, back on and down with 0 stuck)
    { x: 0, y: -0.15, z: 0, hx: w, hy: 0.15, hz: w, rot },
    { x: -w + 0.05, y: CAGE_H / 2, z: 0, hx: 0.05, hy: CAGE_H / 2, hz: w, rot },
    { x: w - 0.05, y: CAGE_H / 2, z: 0, hx: 0.05, hy: CAGE_H / 2, hz: w, rot },
    { x: 0, y: CAGE_H + 0.15, z: 0, hx: w, hy: 0.15, hz: w, rot },
  ];
}
/** the cage's two gates (its open deck and street faces), colliding only while it moves */
export function gateBoxes(): MoverBox[] {
  const rot = { x: 0, y: 0, z: 0, w: 1 }, w = CAGE - 0.05;
  return [-1, 1].map((s) => ({ x: 0, y: CAGE_H / 2, z: s * (w - 0.05), hx: w, hy: CAGE_H / 2, hz: 0.05, rot }));
}
/** a door box in the frame of `at` (the cage's bottom or top): the deck's door in the end wall, or the street's threshold */
export function doorBoxes(which: 'deck' | 'street'): MoverBox[] {
  const rot = { x: 0, y: 0, z: 0, w: 1 };
  // the deck's door: the end wall's thickness behind the cage's deck face; the street's: just past its street face
  const z = which === 'deck' ? -(CAGE + 0.4) : CAGE + 0.2;
  return [{ x: 0, y: DOOR.h / 2, z, hx: CAGE, hy: DOOR.h / 2, hz: 0.18, rot }];
}

type V3 = [number, number, number];
/**
 * SF8c: a lift's declared socketLift link (shard.config.ts's entryway; the platform proves and commands it). The static
 * approach walks the deck from the socket's inner midpoint to in front of the end wall's door, then straight through the
 * door onto the resting cage (the threshold is flush with the deck, the cage's floor 5 cm past it); the onward route steps
 * out of the docked cage's street face onto the street (shard.config.ts declares its floor). `deck` names the declared deck row.
 */
export function liftLink(l: Lift, deck: string): { mover: string; gate: string; roadStop: V3; topStop: V3; route: V3[]; rideTicks: number; approach: { colliders: string[]; route: V3[] } } {
  const v = (x: number, y: number, z: number): V3 => [x + 0, y + 0, z + 0]; // JSON data: never −0
  const b = liftBottom(l), t = liftTop(l), xz = (a: number, c: number): [number, number] => frameXZ(l, a, c);
  const [mx, mz] = xz(ENTRY_ASPHALT, 0), [fx, fz] = xz(ENTRY_ASPHALT + 0.4, l.across);
  const [ox, oz] = xz(ALONG + CAGE + 3, l.across), [wx, wz] = xz(ALONG + CAGE + 9.6, l.across + 4.1);
  return { mover: l.id, gate: `${l.id}.road-gate`, roadStop: v(b.x, b.y, b.z), topStop: v(t.x, t.y, t.z), route: [v(t.x, t.y, t.z), v(ox, t.y, oz), v(wx, t.y, wz)],
    rideTicks: Math.ceil(RIDE * 60) + RIDE_SLACK, approach: { colliders: [deck], route: [v(mx, 0, mz), v(fx, 0, fz)] } };
}

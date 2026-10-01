/** Every coordinate of Sky Reach. Island tops are flat at `TOP`; the void below them is the cloud sea. */
export const TOP = 30;
/** the player soft-respawns below this; creatures die below `KILL_Y` (manifest `world.killY`) */
export const FLOOR = 14;
export const KILL_Y = 10;

export interface Island { id: string; x: number; z: number; r: number; depth: number }
export const SUNREST: Island = { id: 'sunrest', x: 0, z: 0, r: 20, depth: 24 };
export const WINDMILL: Island = { id: 'windmill', x: 0, z: -60, r: 15, depth: 20 };
export const ROOST: Island = { id: 'roost', x: 56, z: -18, r: 13, depth: 17 };
export const GULL: Island = { id: 'gull', x: -48, z: 14, r: 10, depth: 14 };
export const ISLANDS: readonly Island[] = [SUNREST, WINDMILL, ROOST, GULL];

export const onIsland = (x: number, z: number): boolean => ISLANDS.some((i) => Math.hypot(x - i.x, z - i.z) < i.r);

/** how a bridge is built: `rope` walks, `hover` carries only a board rider, `fallen` is the quest's bridge */
export type BridgeKind = 'rope' | 'hover' | 'fallen';
export interface Bridge { id: string; kind: BridgeKind; from: Island; to: Island; width: number }
export const BRIDGES: readonly Bridge[] = [
  { id: 'far.bridge.gull', kind: 'rope', from: SUNREST, to: GULL, width: 2.4 },
  { id: 'far.hover.roost', kind: 'hover', from: SUNREST, to: ROOST, width: 3 },
  { id: 'far.hover.mill', kind: 'hover', from: ROOST, to: WINDMILL, width: 3 },
  { id: 'far.bridge.mill', kind: 'fallen', from: SUNREST, to: WINDMILL, width: 2.6 },
];
/**
 * A rope deck overlaps each rim by `ROPE_OVERLAP` so a walker steps straight on. A hover deck starts `HOVER_GAP`
 * clear of the rim (Jake's rule): on foot you step into the gap and fall; the board floats over it.
 */
export const ROPE_OVERLAP = 1.2;
export const HOVER_GAP = 0.8;

/** the end points of a bridge deck, at deck height */
export function bridgeEnds(b: Bridge): { ax: number; az: number; bx: number; bz: number; yaw: number; length: number } {
  const dx = b.to.x - b.from.x, dz = b.to.z - b.from.z, d = Math.hypot(dx, dz), ux = dx / d, uz = dz / d;
  const inset = b.kind === 'hover' ? -HOVER_GAP : ROPE_OVERLAP;
  const ax = b.from.x + ux * (b.from.r - inset), az = b.from.z + uz * (b.from.r - inset);
  const bx = b.to.x - ux * (b.to.r - inset), bz = b.to.z - uz * (b.to.r - inset);
  return { ax, az, bx, bz, yaw: Math.atan2(ux, uz), length: Math.hypot(bx - ax, bz - az) };
}

export const SPAWN = { x: 0, z: 9, yaw: 0 };
/** the winch on Sunrest's north rim, beside the fallen bridge's anchor */
export const WINCH = { x: 3.2, z: -16.5 };
export const MILL = { x: 0, z: -63 };
/** the drift ray circles Sunrest at this radius and height */
export const RAY = { x: 0, z: -10, radius: 26, altitude: TOP + 13 };
/** a walking trail on the spawn island (new shards declare their own roads) */
export const TRAIL: [number, number][][] = [[[0, 9], [0, -2], [2, -14]]];

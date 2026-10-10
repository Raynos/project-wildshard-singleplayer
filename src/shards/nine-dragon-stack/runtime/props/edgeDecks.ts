// edgeDecks — road landing decks at a cell's edge midpoints (SHARD-PLATFORM M3, ex Nine Dragon's world/floorRows.ts,
// SF51-g): a structure shard that floats over an undrawn datum builds a deck under each edge's road socket, its top at
// y = 0, so the platform's asphalt socket lies on it flat. Each deck has a frame (its edge, the edge midpoint, the inward
// axis) and boxes laid out in it: `a` metres in from the edge, `c` across, `y` up. Renderer-free: the boxes are collider
// rows and the drawing's sizes alike.
//
//   const f = edgeFrame('north', CHUNK_HALF);
//   const { slab, rails, walls } = deckParts(f, { half: 4, depth: 16, slab: 1.2, railT: 0.6, railH: 1.1, wallT: 0.8, wallH: 6 });
import type { ColliderDesc } from '@wildshard/engine/world/registry';

/** a cell edge, as the shardfile names them (north is +z) */
export type DeckEdge = 'north' | 'east' | 'south' | 'west';

/** one deck's frame: its edge, its edge-midpoint, the inward unit axis */
export interface EdgeFrame { edge: DeckEdge; mx: number; mz: number; ix: number; iz: number }
/** an axis-aligned box in a deck's frame (its centre, size and vertical extent) */
export interface FrameBox { x: number; z: number; sx: number; sz: number; y0: number; y1: number }
/** a deck's sizes: half its opening, its depth in from the edge, its slab's thickness, its parapets' and end wall's
 *  thickness and height */
export interface DeckSizes { readonly half: number; readonly depth: number; readonly slab: number; readonly railT: number; readonly railH: number; readonly wallT: number; readonly wallH: number }

const UNIT: Readonly<Record<DeckEdge, { mx: number; mz: number; ix: number; iz: number }>> = {
  north: { mx: 0, mz: 1, ix: 0, iz: -1 }, south: { mx: 0, mz: -1, ix: 0, iz: 1 }, east: { mx: 1, mz: 0, ix: -1, iz: 0 }, west: { mx: -1, mz: 0, ix: 1, iz: 0 },
};

/** the frame of the deck on `edge` of a cell reaching `half` m from its centre */
export function edgeFrame(edge: DeckEdge, half: number): EdgeFrame {
  const u = UNIT[edge];
  return { edge, mx: u.mx * half, mz: u.mz * half, ix: u.ix, iz: u.iz };
}

/** an axis-aligned box in a deck's frame: `a0..a1` metres in from the edge, `c0..c1` across, `y0..y1` up */
export function inFrame(f: EdgeFrame, a0: number, a1: number, c0: number, c1: number, y0: number, y1: number): FrameBox {
  const along = (a: number): [number, number] => [f.mx + f.ix * a, f.mz + f.iz * a];
  const [ax0, az0] = along(a0), [ax1, az1] = along(a1);
  // the across axis is x for a north / south deck, z for an east / west one
  const xs = f.ix === 0 ? [c0, c1] : [ax0, ax1], zs = f.ix === 0 ? [az0, az1] : [c0, c1];
  const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
  return { x: (x0 + x1) / 2, z: (z0 + z1) / 2, sx: x1 - x0, sz: z1 - z0, y0, y1 };
}

/** a deck's parts: the slab (its top at y 0), the two parapets just outside the opening, the end wall past the socket */
export function deckParts(f: EdgeFrame, s: DeckSizes): { slab: FrameBox; rails: FrameBox[]; walls: FrameBox[] } {
  const h = s.half, c0 = -h - s.railT, c1 = h + s.railT;
  return {
    slab: inFrame(f, 0, s.depth, c0, c1, -s.slab, 0),
    rails: [inFrame(f, 0, s.depth, -h - s.railT, -h, 0, s.railH), inFrame(f, 0, s.depth, h, h + s.railT, 0, s.railH)],
    walls: [inFrame(f, s.depth, s.depth + s.wallT, c0, c1, -s.slab, s.wallH)],
  };
}

/** a frame box as a stone box collider */
export const frameCollider = (b: FrameBox): ColliderDesc => ({ kind: 'box', x: b.x, y: (b.y0 + b.y1) / 2, z: b.z, hx: b.sx / 2, hy: (b.y1 - b.y0) / 2, hz: b.sz / 2, surface: 'stone' });

/** a box collider from its extents (min / max corners) */
export function spanCollider(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, surface: 'stone' | 'wood' | 'metal' = 'stone'): ColliderDesc {
  return { kind: 'box', x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (z0 + z1) / 2, hx: Math.abs(x1 - x0) / 2, hy: Math.abs(y1 - y0) / 2, hz: Math.abs(z1 - z0) / 2, surface };
}

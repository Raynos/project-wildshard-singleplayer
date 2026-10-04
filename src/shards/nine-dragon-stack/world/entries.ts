// SF51-g (G93 / G99 / G103 / G131, E435): Nine Dragon's four midpoint entries at road height. The fragment floats at
// +125 m and its terrain is an undrawn datum, so nothing stood at y = 0 on its edges: each midpoint gets a Jiehua stone
// landing deck, ENTRY_WIDTH (8 m) wide and DECK_DEPTH (16 m) deep, its top exactly at y = 0, so the platform's 8 × 15 m
// asphalt socket lies on it flat, clear and dry. Low stone parapets stand just outside the 8 m opening (the canonical side
// walls the footprint admits), and a stone end wall with a cinnabar band closes each deck: the climb to Lantern Square is
// SF51-p content. Default off behind pause ▸ Settings ▸ Debug ▸ Nine Dragon entries (`nineDragonEntries`, debug.ts).
import { ENTRY_WIDTH, CHUNK_HALF } from '@wildshard/engine/core/config';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import { SURF } from '../look/paint';
import type { Ctx } from './ctx';
import { K, type Look } from './kit';

/** how deep each deck runs in from the edge (the 15 m socket plus a metre to the end wall) */
export const DECK_DEPTH = 16;
/** the deck slab's thickness under its y = 0 top */
const SLAB = 1.2;
/** the parapets beside the opening: thickness and height (a stone rail, not a jump block) */
const RAIL_T = 0.6, RAIL_H = 1.1;
/** the end wall: thickness and height */
const WALL_T = 0.8, WALL_H = 6;

const STONE: Look = { wash: 0x626469, kind: K.stone, line: 1, wet: 0.55, surf: SURF.concrete };
const FLAGS: Look = { wash: 0x3e4148, kind: K.flag, wet: 1, line: 0 };
const BAND: Look = { wash: 0x8a2a1e, line: 1, wet: 0.35, accent: true };

/** one deck's frame: its edge-midpoint, the inward unit axis (along) and the across axis */
interface Frame { mx: number; mz: number; ix: number; iz: number }
const FRAMES: readonly Frame[] = [
  { mx: 0, mz: CHUNK_HALF, ix: 0, iz: -1 }, { mx: 0, mz: -CHUNK_HALF, ix: 0, iz: 1 },
  { mx: CHUNK_HALF, mz: 0, ix: -1, iz: 0 }, { mx: -CHUNK_HALF, mz: 0, ix: 1, iz: 0 },
];

/** an axis-aligned box in a deck's frame: `a0..a1` metres in from the edge, `c0..c1` across, `y0..y1` up */
function inFrame(f: Frame, a0: number, a1: number, c0: number, c1: number, y0: number, y1: number): { x: number; z: number; sx: number; sz: number; y0: number; y1: number } {
  const along = (a: number): [number, number] => [f.mx + f.ix * a, f.mz + f.iz * a];
  const [ax0, az0] = along(a0), [ax1, az1] = along(a1);
  // the across axis is x for a north / south deck, z for an east / west one
  const xs = f.ix === 0 ? [c0, c1] : [ax0, ax1], zs = f.ix === 0 ? [az0, az1] : [c0, c1];
  const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
  return { x: (x0 + x1) / 2, z: (z0 + z1) / 2, sx: x1 - x0, sz: z1 - z0, y0, y1 };
}

/** each deck's parts: the slab, the two parapets just outside the opening, the end wall past the socket */
function parts(f: Frame): { slab: ReturnType<typeof inFrame>; rails: ReturnType<typeof inFrame>[]; wall: ReturnType<typeof inFrame> } {
  const h = ENTRY_WIDTH / 2;
  return {
    slab: inFrame(f, 0, DECK_DEPTH, -h - RAIL_T, h + RAIL_T, -SLAB, 0),
    rails: [inFrame(f, 0, DECK_DEPTH, -h - RAIL_T, -h, 0, RAIL_H), inFrame(f, 0, DECK_DEPTH, h, h + RAIL_T, 0, RAIL_H)],
    wall: inFrame(f, DECK_DEPTH, DECK_DEPTH + WALL_T, -h - RAIL_T, h + RAIL_T, -SLAB, WALL_H),
  };
}

const box = (b: ReturnType<typeof inFrame>): ColliderDesc => ({ kind: 'box', x: b.x, y: (b.y0 + b.y1) / 2, z: b.z, hx: b.sx / 2, hy: (b.y1 - b.y0) / 2, hz: b.sz / 2, surface: 'stone' });

/** the four decks' collision: the slabs (tops at y = 0), the parapets and the end walls */
export function entryDeckColliders(): ColliderDesc[] {
  return FRAMES.flatMap((f) => { const p = parts(f); return [box(p.slab), ...p.rails.map(box), box(p.wall)]; });
}

/** the floor on a deck (placement, footsteps), else undefined */
export function entryDeckFloor(x: number, z: number): number | undefined {
  for (const f of FRAMES) {
    const s = parts(f).slab;
    if (Math.abs(x - s.x) <= s.sx / 2 && Math.abs(z - s.z) <= s.sz / 2) return 0;
  }
  return undefined;
}

/** draw the four decks into the fragment's `entries` kit (merged with the world's fabric, one draw) */
export function buildEntryDecks(ctx: Ctx): void {
  const k = ctx.kit('entries');
  for (const f of FRAMES) {
    const p = parts(f);
    k.box(p.slab.x, p.slab.y0, p.slab.z, p.slab.sx, p.slab.y1 - p.slab.y0, p.slab.sz, STONE, { top: FLAGS });
    for (const r of p.rails) k.box(r.x, r.y0, r.z, r.sx, r.y1 - r.y0, r.sz, STONE);
    k.box(p.wall.x, p.wall.y0, p.wall.z, p.wall.sx, p.wall.y1 - p.wall.y0, p.wall.sz, STONE);
    // the cinnabar band across the end wall's face, a hand over head height
    const band = inFrame(f, DECK_DEPTH - 0.05, DECK_DEPTH, -ENTRY_WIDTH / 2, ENTRY_WIDTH / 2, 3.2, 4.0);
    k.box(band.x, band.y0, band.z, band.sx, band.y1 - band.y0, band.sz, BAND);
  }
}

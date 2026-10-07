// SF51-g (G93 / G99 / G103 / G131, E435): Nine Dragon's four midpoint entries at road height. The fragment floats at
// +125 m and its terrain is an undrawn datum, so nothing stood at y = 0 on its edges: each midpoint gets a Jiehua stone
// landing deck, ENTRY_WIDTH (8 m) wide and DECK_DEPTH (16 m) deep, its top exactly at y = 0, so the platform's 8 × 15 m
// asphalt socket lies on it flat, clear and dry. Low stone parapets stand just outside the 8 m opening (the canonical side
// walls the footprint admits), and a stone end wall with a cinnabar band closes each deck: the climb to Lantern Square is
// SF51-p content. Default off behind pause ▸ Settings ▸ Debug ▸ Nine Dragon entries (`nineDragonEntries`, debug.ts).
import { ENTRY_WIDTH, CHUNK_HALF } from '@wildshard/engine/core/config';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import type { ShardCube } from '@wildshard/game/shard/context';
import { SURF } from '../look/paint';
import type { Ctx } from './ctx';
import { K, type Look } from './kit';
import { buildLifts } from './lifts';
import { hipRoof } from './square';
import { DOOR, LIFTS, liftColliders, type Lift } from './liftPlan';

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
const CARVED: Look = { wash: 0x74767c, kind: K.stone, line: 1, wet: 0.45, surf: SURF.concrete };
const BRONZE: Look = { wash: 0x9a6a32, line: 1, accent: true, gloss: true };
const BRONZE_DK: Look = { wash: 0x5a3c1c, line: 1, accent: true, gloss: true };
const FLAME: Look = { wash: 0xffb050, emit: 2.2, line: 0, accent: true };
const EMBER: Look = { wash: 0xff6a20, emit: 1.8, line: 0, accent: true };

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

/** the lantern lift that starts from a deck (SF51-p, world/lifts.ts), if one is built there */
function liftOf(f: Frame): Lift | undefined { return LIFTS.find((l) => l.mx === f.mx && l.mz === f.mz); }

/**
 * each deck's parts: the slab, the two parapets just outside the opening, the end wall past the socket. Where a lantern
 * lift starts (SF51-p) the end wall opens on its cage: a threshold flush with the deck, two jambs and a lintel.
 */
function parts(f: Frame): { slab: ReturnType<typeof inFrame>; rails: ReturnType<typeof inFrame>[]; walls: ReturnType<typeof inFrame>[] } {
  const h = ENTRY_WIDTH / 2, lift = liftOf(f), c0 = -h - RAIL_T, c1 = h + RAIL_T;
  const wall = (w0: number, w1: number, y0: number, y1: number): ReturnType<typeof inFrame> => inFrame(f, DECK_DEPTH, DECK_DEPTH + WALL_T, w0, w1, y0, y1);
  const d0 = lift === undefined ? 0 : lift.across + DOOR.c0, d1 = lift === undefined ? 0 : lift.across + DOOR.c1;
  return {
    slab: inFrame(f, 0, DECK_DEPTH, c0, c1, -SLAB, 0),
    rails: [inFrame(f, 0, DECK_DEPTH, -h - RAIL_T, -h, 0, RAIL_H), inFrame(f, 0, DECK_DEPTH, h, h + RAIL_T, 0, RAIL_H)],
    walls: lift === undefined ? [wall(c0, c1, -SLAB, WALL_H)]
      : [wall(c0, c1, -SLAB, 0), wall(c0, d0, 0, WALL_H), wall(d1, c1, 0, WALL_H), wall(d0, d1, DOOR.h, WALL_H)],
  };
}

/**
 * G200 (Jake's pick B, art/grid/round-22-landings-standalone): played alone there is no road at a deck's open end, so a
 * deck a lift starts from is closed there by a carved balustrade: a plinth, newel posts, carved panels with a cinnabar
 * inset and a top rail across the 8 m opening; a raised pedestal in its middle carries a bronze beacon brazier, and two
 * stone-lantern pillars with green tiled caps and red lanterns stand on the parapets' ends. Standalone only (the
 * world's `caps`, `ctx.cube === null`, plugin.ts): in a grid cell the road socket continues there. Drawn into the
 * `entries` kit like the deck (merged, no new draw); laid out in the deck's frame, so the other three decks reuse it as is.
 */
export const CAP = { depth: 0.7, rail: 1.15, pedestal: 0.6, pedestalH: 1.3, pillar: 0.8, pillarH: 3.4 } as const;
function capParts(f: Frame): { plinth: ReturnType<typeof inFrame>; rail: ReturnType<typeof inFrame>; pedestal: ReturnType<typeof inFrame>; pillars: ReturnType<typeof inFrame>[] } {
  const h = ENTRY_WIDTH / 2, c = h + RAIL_T / 2, p = CAP.pillar / 2;
  return {
    plinth: inFrame(f, 0, CAP.depth, -h, h, 0, 0.3),
    rail: inFrame(f, 0, CAP.depth, -h, h, 0, CAP.rail),
    pedestal: inFrame(f, 0, CAP.depth + 0.1, -CAP.pedestal, CAP.pedestal, 0, CAP.pedestalH),
    pillars: [-1, 1].map((s) => inFrame(f, 0, CAP.pillar + 0.1, s * c - p, s * c + p, 0, CAP.pillarH)),
  };
}
/** whether the decks get their caps this session: standalone (`cube` null) yes; in a grid cell the road socket continues */
export function entryCapsFor(cube: ShardCube | null): boolean { return cube === null; }
/** the decks a balustrade closes when standalone: those a lantern lift starts from (the others are out of reach) */
const capped = (f: Frame): boolean => liftOf(f) !== undefined;

const box = (b: ReturnType<typeof inFrame>): ColliderDesc => ({ kind: 'box', x: b.x, y: (b.y0 + b.y1) / 2, z: b.z, hx: b.sx / 2, hy: (b.y1 - b.y0) / 2, hz: b.sz / 2, surface: 'stone' });

/** the four decks' collision: the slabs (tops at y = 0), the parapets and the end walls; with `caps` (standalone, G200)
 *  the balustrade, its brazier's pedestal and the two lantern pillars across each lift deck's open end */
export function entryDeckColliders(caps = false): ColliderDesc[] {
  const cap = (f: Frame): ColliderDesc[] => { if (!caps || !capped(f)) return []; const c = capParts(f); return [box(c.rail), box(c.pedestal), ...c.pillars.map(box)]; };
  return [...FRAMES.flatMap((f) => { const p = parts(f); return [box(p.slab), ...p.rails.map(box), ...p.walls.map(box), ...cap(f)]; }), ...LIFTS.flatMap(liftColliders)];
}

/** the floor on a deck (placement, footsteps), else undefined */
export function entryDeckFloor(x: number, z: number): number | undefined {
  for (const f of FRAMES) {
    const s = parts(f).slab;
    if (Math.abs(x - s.x) <= s.sx / 2 && Math.abs(z - s.z) <= s.sz / 2) return 0;
  }
  return undefined;
}

/** one balustrade cap (G200) into the `entries` kit, with its lanterns hung in the fragment's lantern batch */
function buildCap(ctx: Ctx, f: Frame): void {
  const k = ctx.kit('entries'), c = capParts(f), h = ENTRY_WIDTH / 2, d = CAP.depth;
  const put = (b: ReturnType<typeof inFrame>, look: Look, opt: { top?: Look | null } = {}): void => { k.box(b.x, b.y0, b.z, b.sx, b.y1 - b.y0, b.sz, look, opt); };
  put(c.plinth, STONE);
  // the newel posts and the carved panels between them (a cinnabar inset on the deck face), the top rail over them
  const newels = [-h + 0.25, -2.3, 2.3, h - 0.25];
  for (const n of newels) put(inFrame(f, 0.05, d - 0.05, n - 0.25, n + 0.25, 0.3, CAP.rail + 0.2), STONE);
  for (const [c0, c1] of [[-h + 0.5, -2.55], [-2.05, -CAP.pedestal], [CAP.pedestal, 2.05], [2.55, h - 0.5]] as const) {
    put(inFrame(f, 0.2, d - 0.2, c0, c1, 0.3, CAP.rail - 0.12), CARVED);
    put(inFrame(f, d - 0.2, d - 0.16, c0 + 0.15, c1 - 0.15, 0.45, CAP.rail - 0.3), BAND);
  }
  put(inFrame(f, 0, d, -h, h, CAP.rail - 0.12, CAP.rail), STONE);
  // the brazier's pedestal, its cinnabar band, and the bronze bowl with its fire
  put(c.pedestal, STONE);
  put(inFrame(f, d + 0.1, d + 0.14, -CAP.pedestal + 0.1, CAP.pedestal - 0.1, 0.7, 1.0), BAND);
  const [bx, bz] = f.ix === 0 ? [0, f.mz + f.iz * (d + 0.1) / 2] : [f.mx + f.ix * (d + 0.1) / 2, 0], top = CAP.pedestalH;
  k.cyl(bx, top, bz, 0.34, 0.26, 0.12, 8, BRONZE_DK);
  k.cyl(bx, top + 0.12, bz, 0.22, 0.6, 0.42, 10, BRONZE);
  k.cyl(bx, top + 0.5, bz, 0.6, 0.66, 0.08, 10, BRONZE_DK, { caps: false });
  k.cyl(bx, top + 0.48, bz, 0.5, 0.5, 0.04, 8, EMBER);
  k.cyl(bx, top + 0.5, bz, 0.42, 0, 0.75, 6, FLAME);
  k.cyl(bx + 0.18, top + 0.5, bz - 0.1, 0.2, 0, 0.45, 5, FLAME);
  k.cyl(bx - 0.16, top + 0.5, bz + 0.12, 0.2, 0, 0.5, 5, FLAME);
  // the two stone-lantern pillars on the parapets' ends: a shaft, a carved collar, a green tiled cap, a red lantern
  for (const p of c.pillars) {
    put(p, CARVED);
    put(inFrame(f, -0.05, CAP.pillar + 0.15, ...pillarSpan(f, p, 0.12), CAP.pillarH - 0.9, CAP.pillarH - 0.7), BAND);
    put(inFrame(f, -0.1, CAP.pillar + 0.2, ...pillarSpan(f, p, 0.16), CAP.pillarH, CAP.pillarH + 0.2), STONE);
    hipRoof(ctx, k, p.x, CAP.pillarH + 0.2, p.z, 1.4, 1.4, 0.7, 0.25, 0x2f5a3f, null);
    // the red lantern hangs from a bronze arm on the pillar's deck face (seen as you step out of the lift)
    const [c0, c1] = pillarSpan(f, p, -0.33), arm = CAP.pillar + 0.55;
    put(inFrame(f, CAP.pillar + 0.1, arm + 0.05, c0, c1, CAP.pillarH - 0.42, CAP.pillarH - 0.34), BRONZE);
    const [lx, lz] = f.ix === 0 ? [p.x, f.mz + f.iz * arm] : [f.mx + f.ix * arm, p.z];
    ctx.lantern(lx, CAP.pillarH - 0.42, lz, 1.0);
  }
}
/** a pillar's across span, widened by `w`, as inFrame's c0 / c1 */
function pillarSpan(f: Frame, p: ReturnType<typeof inFrame>, w: number): [number, number] {
  const half = (f.ix === 0 ? p.sx : p.sz) / 2 + w, mid = f.ix === 0 ? p.x : p.z;
  return [mid - half, mid + half];
}

/** draw the four decks into the fragment's `entries` kit (merged with the world's fabric, one draw); with `caps`
 *  (standalone, G200) each lift deck's open end gets its balustrade */
export function buildEntryDecks(ctx: Ctx, caps = false): void {
  const k = ctx.kit('entries');
  for (const f of FRAMES) {
    const p = parts(f);
    k.box(p.slab.x, p.slab.y0, p.slab.z, p.slab.sx, p.slab.y1 - p.slab.y0, p.slab.sz, STONE, { top: FLAGS });
    for (const r of p.rails) k.box(r.x, r.y0, r.z, r.sx, r.y1 - r.y0, r.sz, STONE);
    for (const w of p.walls) k.box(w.x, w.y0, w.z, w.sx, w.y1 - w.y0, w.sz, STONE);
    // the cinnabar band across the end wall's face, a hand over head height
    const band = inFrame(f, DECK_DEPTH - 0.05, DECK_DEPTH, -ENTRY_WIDTH / 2, ENTRY_WIDTH / 2, 3.2, 4.0);
    k.box(band.x, band.y0, band.z, band.sx, band.y1 - band.y0, band.sz, BAND);
    if (caps && capped(f)) buildCap(ctx, f);
  }
  // SF51-p: the lantern lifts from the decks up to the street (world/lifts.ts)
  buildLifts(ctx);
}

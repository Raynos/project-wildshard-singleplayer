// SF51-g (G93 / G99 / G103 / G131, E435): Nine Dragon's four midpoint entries at road height, drawn (their frames,
// collision and declared floor rows are world/floorRows.ts, renderer-free, SF72). The fragment floats at
// +125 m and its terrain is an undrawn datum, so nothing stood at y = 0 on its edges: each midpoint gets a Jiehua stone
// landing deck, ENTRY_WIDTH (8 m) wide and DECK_DEPTH (16 m) deep, its top exactly at y = 0, so the platform's 8 × 15 m
// asphalt socket lies on it flat, clear and dry. Low stone parapets stand just outside the 8 m opening (the canonical side
// walls the footprint admits), and a stone end wall with a cinnabar band closes each deck. G224 (Jake): the way on is a
// floating portal on each deck to Lantern Square (world/portalPlan.ts, portals.ts, portalRide.ts), so the decks are
// always built (the `nineDragonEntries` row went with the lantern lift it waited for).
import type { ShardCube } from '@wildshard/game/shard/context';
import { SURF } from '../look/paint';
import type { Ctx } from './ctx';
import { K, type Look } from './kit';
import { hipRoof } from './squareParts';
import { CAP, DECK_DEPTH, FRAMES, OPENING_HALF, capParts, deckParts, inFrame, type Frame, type FrameBox } from './floorRows';

const STONE: Look = { wash: 0x626469, kind: K.stone, line: 1, wet: 0.55, surf: SURF.concrete };
const FLAGS: Look = { wash: 0x3e4148, kind: K.flag, wet: 1, line: 0 };
const BAND: Look = { wash: 0x8a2a1e, line: 1, wet: 0.35, accent: true };
const CARVED: Look = { wash: 0x74767c, kind: K.stone, line: 1, wet: 0.45, surf: SURF.concrete };
const BRONZE: Look = { wash: 0x9a6a32, line: 1, accent: true, gloss: true };
const BRONZE_DK: Look = { wash: 0x5a3c1c, line: 1, accent: true, gloss: true };
const FLAME: Look = { wash: 0xffb050, emit: 2.2, line: 0, accent: true };
const EMBER: Look = { wash: 0xff6a20, emit: 1.8, line: 0, accent: true };

/** whether the decks get their caps this session: standalone (`cube` null) yes; in a grid cell the road socket continues */
export function entryCapsFor(cube: ShardCube | null): boolean { return cube === null; }

/**
 * G200 (Jake's pick B, art/grid/round-22-landings-standalone): played alone there is no road at a deck's open end, so
 * each deck (G224: the square's portal can set you down on any of the four) is closed there by a carved balustrade: a plinth, newel posts, carved panels with a cinnabar
 * inset and a top rail across the 8 m opening; a raised pedestal in its middle carries a bronze beacon brazier, and two
 * stone-lantern pillars with green tiled caps and red lanterns stand on the parapets' ends. Standalone only (the
 * world's `caps`, `ctx.cube === null`, plugin.ts): in a grid cell the road socket continues there. Drawn into the
 * `entries` kit like the deck (merged, no new draw); laid out in the deck's frame (floorRows.ts `capParts`), so all four decks share it.
 * This is one cap into the `entries` kit, with its lanterns hung in the fragment's lantern batch.
 */
function buildCap(ctx: Ctx, f: Frame): void {
  const k = ctx.kit('entries'), c = capParts(f), h = OPENING_HALF, d = CAP.depth;
  const put = (b: FrameBox, look: Look, opt: { top?: Look | null } = {}): void => { k.box(b.x, b.y0, b.z, b.sx, b.y1 - b.y0, b.sz, look, opt); };
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
    // the red lantern hangs from a bronze arm on the pillar's deck face (seen as you walk out along the deck)
    const [c0, c1] = pillarSpan(f, p, -0.33), arm = CAP.pillar + 0.55;
    put(inFrame(f, CAP.pillar + 0.1, arm + 0.05, c0, c1, CAP.pillarH - 0.42, CAP.pillarH - 0.34), BRONZE);
    const [lx, lz] = f.ix === 0 ? [p.x, f.mz + f.iz * arm] : [f.mx + f.ix * arm, p.z];
    ctx.lantern(lx, CAP.pillarH - 0.42, lz, 1.0);
  }
}
/** a pillar's across span, widened by `w`, as inFrame's c0 / c1 */
function pillarSpan(f: Frame, p: FrameBox, w: number): [number, number] {
  const half = (f.ix === 0 ? p.sx : p.sz) / 2 + w, mid = f.ix === 0 ? p.x : p.z;
  return [mid - half, mid + half];
}

/** draw the four decks into the fragment's `entries` kit (merged with the world's fabric, one draw); with `caps`
 *  (standalone, G200) each deck's open end gets its balustrade */
export function buildEntryDecks(ctx: Ctx, caps = false): void {
  const k = ctx.kit('entries');
  for (const f of FRAMES) {
    const p = deckParts(f);
    k.box(p.slab.x, p.slab.y0, p.slab.z, p.slab.sx, p.slab.y1 - p.slab.y0, p.slab.sz, STONE, { top: FLAGS });
    for (const r of p.rails) k.box(r.x, r.y0, r.z, r.sx, r.y1 - r.y0, r.sz, STONE);
    for (const w of p.walls) k.box(w.x, w.y0, w.z, w.sx, w.y1 - w.y0, w.sz, STONE);
    // the cinnabar band across the end wall's face, a hand over head height
    const band = inFrame(f, DECK_DEPTH - 0.05, DECK_DEPTH, -OPENING_HALF, OPENING_HALF, 3.2, 4.0);
    k.box(band.x, band.y0, band.z, band.sx, band.y1 - band.y0, band.sz, BAND);
    if (caps) buildCap(ctx, f);
  }
}

// SF72: Nine Dragon's declared floors and its landing decks' collision, renderer-free. shard.config.ts declares these
// rows (the portal floors), the world installs the same boxes (world/install.ts), and a headless runtime loads them in
// plain Node, so nothing here reaches a look, a model or the renderer: the decks' drawing stays in world/entries.ts and the
// rest of the fragment's collision in world/colliders.ts, both built on these frames.
//
// SF51-g (G93 / G99 / G103 / G131, E435): Nine Dragon's four midpoint entries at road height. The fragment floats at
// +125 m and its terrain is an undrawn datum, so nothing stood at y = 0 on its edges: each midpoint gets a landing deck,
// ENTRY_WIDTH (8 m) wide and DECK_DEPTH (16 m) deep, its top exactly at y = 0, so the platform's 8 × 15 m asphalt socket
// lies on it flat, clear and dry. Low parapets stand just outside the 8 m opening (the canonical side walls the
// footprint admits), and an end wall closes each deck.
import { ENTRY_WIDTH, CHUNK_HALF } from '@wildshard/engine/core/config';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import { type EdgeFrame, type FrameBox as DeckBox, deckParts as sdkDeckParts, edgeFrame, frameCollider, inFrame as sdkInFrame, spanCollider } from '@wildshard/sdk/props/edgeDecks';
import { DECK, DECK_CAP } from '../data/decks';
import { PLAZA, Y0 } from '../layout';
import { DECK_PORTALS, SQUARE_FLOOR, deckFloorId, type ShardEdge } from './portalPlan';

/** half the deck's opening: the canonical ENTRY_WIDTH (8 m) entry, centred on the edge's midpoint */
export const OPENING_HALF = ENTRY_WIDTH / 2;
/** how deep each deck runs in from the edge (data/decks.ts) */
export const DECK_DEPTH = DECK.depth;
/** a floor slab's thickness under its top (the decks' and the fragment's floors) */
export const SLAB = DECK.slab;
/** the deck's sizes for the SDK's edge decks (@wildshard/sdk/props/edgeDecks) */
const SIZES = { half: OPENING_HALF, ...DECK };

/** a box from its extents (min / max corners) */
export const span: typeof spanCollider = spanCollider;
/** SF8c (G224): the square's slab, the floor the portal nodes in Lantern Square stand on (shard.config.ts declares it) */
export function squareFloor(): ColliderDesc { return span(PLAZA.x0, Y0 - SLAB, PLAZA.z0, PLAZA.x1 + 0.6, Y0, PLAZA.z1 + 0.6); }

/** one deck's frame: its edge, its edge-midpoint, the inward unit axis */
export type Frame = EdgeFrame;
/** an axis-aligned box in a deck's frame (its centre, size and vertical extent) */
export type FrameBox = DeckBox;
/** the four decks' frames, north, south, east, west */
export const FRAMES: readonly Frame[] = (['north', 'south', 'east', 'west'] as const).map((edge) => edgeFrame(edge, CHUNK_HALF));
/** an axis-aligned box in a deck's frame: `a0..a1` metres in from the edge, `c0..c1` across, `y0..y1` up */
export const inFrame: typeof sdkInFrame = sdkInFrame;
/** each deck's parts: the slab, the two parapets just outside the opening, the end wall past the socket */
export const deckParts = (f: Frame): { slab: FrameBox; rails: FrameBox[]; walls: FrameBox[] } => sdkDeckParts(f, SIZES);

/** G200: the standalone balustrade across a deck's open end (world/entries.ts draws it): its sizes (data/decks.ts) */
export const CAP: typeof DECK_CAP = DECK_CAP;
/** the balustrade's colliding parts: its plinth, its top rail, the brazier's pedestal and the two lantern pillars */
export function capParts(f: Frame): { plinth: FrameBox; rail: FrameBox; pedestal: FrameBox; pillars: FrameBox[] } {
  const h = OPENING_HALF, c = h + DECK.railT / 2, p = CAP.pillar / 2;
  return {
    plinth: inFrame(f, 0, CAP.depth, -h, h, 0, 0.3),
    rail: inFrame(f, 0, CAP.depth, -h, h, 0, CAP.rail),
    pedestal: inFrame(f, 0, CAP.depth + 0.1, -CAP.pedestal, CAP.pedestal, 0, CAP.pedestalH),
    pillars: [-1, 1].map((s) => inFrame(f, 0, CAP.pillar + 0.1, s * c - p, s * c + p, 0, CAP.pillarH)),
  };
}

const box = frameCollider;

/** the four decks' collision: the slabs (tops at y = 0), the parapets and the end walls; with `caps` (standalone, G200)
 *  the balustrade, its brazier's pedestal and the two lantern pillars across each deck's open end */
export function entryDeckColliders(caps = false): ColliderDesc[] {
  return [...FRAMES.flatMap((f) => portalDeckColliders(f.edge)), ...entryCapColliders(caps)];
}
/** the decks' standalone balustrades (G200), each deck's in the same order; none in a grid cell (the socket continues) */
export function entryCapColliders(caps: boolean): ColliderDesc[] {
  if (!caps) return [];
  return FRAMES.flatMap((f) => { const c = capParts(f); return [box(c.rail), box(c.pedestal), ...c.pillars.map(box)]; });
}

/**
 * SF8c (G224): a deck's collision as the shardfile declares it (`deck.<edge>`, shard.config.ts), the named floor its road
 * portal stands on: the whole deck from the cell's edge to its end wall, so it covers the canonical 8 × 15 m socket at
 * y = 0 (the format's portal-floor proof), its two parapets and its end wall. These are the very boxes the world installs
 * (world/install.ts registers each deck as its own piece answering to this id), never a second copy.
 */
export function portalDeckColliders(edge: ShardEdge): ColliderDesc[] {
  const f = FRAMES.find((row) => row.edge === edge); if (f === undefined) throw new Error(`No landing deck on the ${edge} edge`);
  const p = deckParts(f);
  return [box(p.slab), ...p.rails.map(box), ...p.walls.map(box)];
}
/** SF8c (G224): the floors the portal nodes stand on as shardfile collider rows: the four decks' and the square's */
export function portalFloorRows(): { id: string; panel: null; initialActive: true; shapes: ColliderDesc[] }[] {
  return [...DECK_PORTALS.map((p) => ({ id: deckFloorId(p.edge), panel: null, initialActive: true as const, shapes: portalDeckColliders(p.edge) })),
    { id: SQUARE_FLOOR, panel: null, initialActive: true, shapes: [squareFloor()] }];
}

/** the floor on a deck (placement, footsteps), else undefined */
export function entryDeckFloor(x: number, z: number): number | undefined {
  for (const f of FRAMES) {
    const s = deckParts(f).slab;
    if (Math.abs(x - s.x) <= s.sx / 2 && Math.abs(z - s.z) <= s.sz / 2) return 0;
  }
  return undefined;
}

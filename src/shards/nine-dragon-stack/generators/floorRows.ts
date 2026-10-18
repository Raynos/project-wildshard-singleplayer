// SF72: Nine Dragon's declared floors and its landing decks' collision, renderer-free. shard.config.ts declares these
// rows (the portal floors), the world installs the same boxes (plugin.ts world stage), and a headless runtime loads them in
// plain Node, so nothing here reaches a look, a model or the renderer: the decks' drawing stays in world/entries.ts and the
// rest of the fragment's collision in world/colliders.ts, both built on these frames.
//
// SF51-g (G93 / G99 / G103 / G131, E435): Nine Dragon's four midpoint entries at road height. The fragment floats at
// +125 m and its terrain is an undrawn datum, so nothing stood at y = 0 on its edges: each midpoint gets a landing deck,
// ENTRY_WIDTH (8 m) wide and DECK_DEPTH (16 m) deep, its top exactly at y = 0, so the platform's 8 × 15 m asphalt socket
// lies on it flat, clear and dry. Low parapets stand just outside the 8 m opening (the canonical side walls the
// footprint admits), and an end wall closes each deck.
import { ENTRY_WIDTH, CHUNK_HALF } from '@wildshard/engine/core/config';
import { type EdgeFrame, type FrameBox as DeckBox, deckParts as sdkDeckParts, edgeFrame, inFrame as sdkInFrame, spanCollider } from './edgeDecks';
import decks from './decks.json' with { type: 'json' };

const { DECK, DECK_CAP } = decks;

/** half the deck's opening: the canonical ENTRY_WIDTH (8 m) entry, centred on the edge's midpoint */
export const OPENING_HALF = ENTRY_WIDTH / 2;
/** how deep each deck runs in from the edge (generators/decks.json) */
export const DECK_DEPTH = DECK.depth;
/** a floor slab's thickness under its top (the decks' and the fragment's floors) */
export const SLAB = DECK.slab;
/** the deck's sizes for the SDK's edge decks (@wildshard/sdk/props/edgeDecks) */
const SIZES = { half: OPENING_HALF, ...DECK };

/** a box from its extents (min / max corners) */
export const span: typeof spanCollider = spanCollider;
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

/** G200: the standalone balustrade across a deck's open end (world/entries.ts draws it): its sizes (generators/decks.json) */
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

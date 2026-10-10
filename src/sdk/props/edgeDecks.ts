import {
  deckParts as platformDeckParts, edgeFrame as platformEdgeFrame, frameCollider as platformFrameCollider, inFrame as platformInFrame, spanCollider as platformSpanCollider,
  type DeckEdge as PlatformDeckEdge, type DeckSizes as PlatformDeckSizes, type EdgeFrame as PlatformEdgeFrame, type FrameBox as PlatformFrameBox,
} from '@wildshard/game/systems/props/edgeDecks';

/** A cell edge, as the shardfile names them. */
export type DeckEdge = PlatformDeckEdge;
/** One deck's frame: its edge, the edge midpoint and the inward axis. */
export type EdgeFrame = PlatformEdgeFrame;
/** An axis-aligned box in a deck's frame. */
export type FrameBox = PlatformFrameBox;
/** A deck's sizes. */
export type DeckSizes = PlatformDeckSizes;
/** The frame of the deck on one edge of a cell (SHARD-PLATFORM M3). */
export const edgeFrame: typeof platformEdgeFrame = platformEdgeFrame;
/** An axis-aligned box laid out in a deck's frame (SHARD-PLATFORM M3). */
export const inFrame: typeof platformInFrame = platformInFrame;
/** A deck's slab, parapets and end wall (SHARD-PLATFORM M3). */
export const deckParts: typeof platformDeckParts = platformDeckParts;
/** A frame box as a stone box collider (SHARD-PLATFORM M3). */
export const frameCollider: typeof platformFrameCollider = platformFrameCollider;
/** A box collider from its extents (SHARD-PLATFORM M3). */
export const spanCollider: typeof platformSpanCollider = platformSpanCollider;

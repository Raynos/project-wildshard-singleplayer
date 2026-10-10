// SF51-g (E435): Nine Dragon's road landing decks as data (SHARD-PLATFORM M3, ex world/floorRows.ts), laid out by the
// SDK's edge decks (@wildshard/sdk/props/edgeDecks) under ENTRY_WIDTH's 8 m opening.

/** each deck: 16 m deep (the 15 m socket plus a metre to the end wall), a 1.2 m slab under its top (the fragment's floors'
 *  thickness too), 0.6 m stone parapets 1.1 m high (a rail, not a jump block), an end wall 0.8 m thick and 6 m high */
export const DECK = { depth: 16, slab: 1.2, railT: 0.6, railH: 1.1, wallT: 0.8, wallH: 6 } as const;

/** G200: the standalone balustrade across a deck's open end: its depth and rail height, the brazier's pedestal (half
 *  width, height) and the two lantern pillars (width, height) */
export const DECK_CAP = { depth: 0.7, rail: 1.15, pedestal: 0.6, pedestalH: 1.3, pillar: 0.8, pillarH: 3.4 } as const;

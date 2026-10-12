/** The original registration order of Driftwood's dry entry sockets. */
export const DRY_ENTRIES = ['north', 'east', 'south', 'west'] as const;
/** A midpoint road socket, in the original cardinal frame. */
export type DryEntryEdge = typeof DRY_ENTRIES[number];
/** Metres beyond the platform socket, retained from G170. */
export const LANDING_RUN = 1.5;
/** Half the road-height landing slab's original thickness. */
export const LANDING_HALF = 0.1;

/** Original road-deck thickness below its road-height top. */
export const DECK_SLAB = 0.55;

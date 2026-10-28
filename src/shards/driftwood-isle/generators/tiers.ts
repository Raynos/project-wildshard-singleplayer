export type IslandTier = 'phone' | 'desktop';

/**
 * Driftwood's own tier knobs (E357 S4.1, 08 §6.1 step 6; until then rows of the engine's TIER_TABLE): the ocean grid
 * cell over the chunk (m), the scatter counts, and which scatters cast shadows (a merged mesh is drawn whole into the
 * shadow map — 80 k bush triangles twice was the phone's 30 fps). Read by each explicit author tier; no ambient build selection is consulted.
 */
export interface IslandKnobs {
  oceanCell: number; palmCount: number; palmFrondSegs: number; bushCount: number; bushDetail: number;
  bushShadows: boolean; boulderShadows: boolean;
}
export const ISLAND_KNOBS: Readonly<Record<IslandTier, IslandKnobs>> = {
  phone: { oceanCell: 4.0, palmCount: 120, palmFrondSegs: 4, bushCount: 170, bushDetail: 0, bushShadows: false, boulderShadows: true },
  desktop: { oceanCell: 2.75, palmCount: 150, palmFrondSegs: 6, bushCount: 260, bushDetail: 1, bushShadows: true, boulderShadows: true },
};
/** Exact authored knobs for the supplied tier. */
export const islandKnobs = (tier: IslandTier): IslandKnobs => ISLAND_KNOBS[tier];

import { buildTier, type Tier } from '@wildshard/engine/core/tier';

/**
 * Driftwood's own tier knobs (E357 S4.1, 08 §6.1 step 6; until then rows of the engine's TIER_TABLE): the ocean grid
 * cell over the chunk (m), the scatter counts, and which scatters cast shadows (a merged mesh is drawn whole into the
 * shadow map — 80 k bush triangles twice was the phone's 30 fps). Read at build time through `islandKnobs()`, which
 * follows Explore's DETAIL TIERS (buildTier) as the engine's TIER_CONFIG does.
 */
export interface IslandKnobs {
  oceanCell: number; palmCount: number; palmFrondSegs: number; bushCount: number; bushDetail: number;
  bushShadows: boolean; boulderShadows: boolean;
}
export const ISLAND_KNOBS: Readonly<Record<Tier, IslandKnobs>> = {
  phone: { oceanCell: 4.0, palmCount: 120, palmFrondSegs: 4, bushCount: 170, bushDetail: 0, bushShadows: false, boulderShadows: true },
  desktop: { oceanCell: 2.75, palmCount: 150, palmFrondSegs: 6, bushCount: 260, bushDetail: 1, bushShadows: true, boulderShadows: true },
};
/** this build's knobs: the running tier's, or the one a detail-tier view builds at */
export const islandKnobs = (): IslandKnobs => ISLAND_KNOBS[buildTier()];

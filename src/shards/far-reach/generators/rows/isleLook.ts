import skyMapSources from '../../data/skyMapSources.json' with { type: 'json' };

/**
 * The islands' paint is the `isle-paint` graphs of data/lookGraphs.json (E392; SHARDFILE W1 C2): whole (the gate isles,
 * the islets, the knolls), cut 1.4 m under a playable island's top over its keel model (`isle-paint-cut`, data/skyIsles.ts
 * ISLE_CUT) and 0.8 m for the windmill's (`isle-paint-cut-mill`).
 */

/** The library maps the island looks sample (data/skyMapSources.json: the KTX2 file each tiling map was admitted as). */
export const ISLE_MAPS = { rock: skyMapSources.rock.asset, meadow: skyMapSources.meadow.asset } as const;

/** How many values each playable island takes from the level's cosmetic stream (the old 12-gon island's 122; the last seeds
 *  its baked shape, generators/isles.ts), so every piece built after the islands keeps its draws. */
export const ISLE_DRAWS = 122;

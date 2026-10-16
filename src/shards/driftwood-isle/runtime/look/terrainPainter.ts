/**
 * Driftwood's faceted ground (E357 S4.3 step 3, 08 §6.3 B): the look's `terrainPainter`, built by `Terrain.build` in
 * place of the engine's default ground. SHARD-PLATFORM M3 / W2 C2: the faceted grid, its paint (sand / grass / rock by
 * height and slope, ./groundColor.ts, and the sand paths over the grass) and the slab walls are baked
 * (generators/facetedGround.ts, data/groundFiles.ts) and laid by runtime/looks/facetedGround.ts in the ground's graph toon
 * materials, which `prepareGround` (the look's `prepareWorld`) compiles and lends first.
 */
import { facetedGroundPainter, prepareFacetedGround } from '../looks/facetedGround';
import type { TerrainPainter, WorldLookContext } from '@wildshard/engine/render/look';
import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';
import { followToon } from './toon';
import { GROUND_LOOK, KIT_LENDS } from '../const';

/** The ground's and the kit's graph materials, from the island's built output, compiled under the world's scope before it
 *  builds (the look's `prepareWorld`). */
export function prepareGround(product: ShardProduct): (context: WorldLookContext) => Promise<void> {
  return (context) => prepareFacetedGround(context, product.shardfile, GROUND_LOOK, followToon, KIT_LENDS);
}

/** Driftwood's ground: no textures at all, two draw calls, facets of solid colour. */
export const LOWPOLY_TERRAIN: TerrainPainter = facetedGroundPainter({ ground: 'draw:ground:ground', slab: 'draw:ground:slab' });

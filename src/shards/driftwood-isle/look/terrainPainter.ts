/**
 * Driftwood's faceted ground (E357 S4.3 step 3, 08 §6.3 B): the look's `terrainPainter`, built by `Terrain.build` in
 * place of the engine's default ground. SHARD-PLATFORM M3: the faceted grid and the slab walls are
 * runtime/looks/facetedGround.ts from data/groundLook.ts, worn by the ground's graph toon materials (`prepareGround`, the
 * look's `prepareWorld`, compiles and lends them first); this keeps the island's paint: sand / grass / rock by height
 * and slope (./groundColor.ts) and the sand paths over the grass. The sea level is the manifest's `OCEAN.level`.
 */
import * as THREE from 'three';
import { facetedGroundPainter, prepareFacetedGround } from '../runtime/looks/facetedGround';
import type { TerrainPainter, WorldLookContext } from '@wildshard/engine/render/look';
import source from '../shard.config';
import { followToon } from './toon';
import { GROUND_LOOK, GROUND_PATHS } from '../data/groundLook';
import { KIT_LENDS } from '../data/kitLook';
import { OCEAN } from '../world/sites';
import { LP, hash2, lowPolyGroundColor } from './groundColor';

const _pathC = new THREE.Color();
const ss = THREE.MathUtils.smoothstep;

/** The ground's and the kit's graph materials compiled under the world's scope before it builds (the look's `prepareWorld`). */
export function prepareGround(context: WorldLookContext): Promise<void> { return prepareFacetedGround(context, source, GROUND_LOOK, followToon, KIT_LENDS); }

/** Driftwood's ground: no textures at all, two draw calls, facets of solid colour. */
export const LOWPOLY_TERRAIN: TerrainPainter = facetedGroundPainter(GROUND_LOOK, OCEAN.level, (c, { h, slope, x, z, y, lip }, f) => {
  lowPolyGroundColor(c, h, slope, x, z, lip);
  // the sand paths: trails above the beach are sand drawn over the grass (a 3 m bed with a soft edge)
  const p = GROUND_PATHS;
  if (y - OCEAN.level > p.above) {
    const td = f.trailDistance(x, z);
    if (td < p.to) { _pathC.copy(LP.path).multiplyScalar(p.shade[0] + hash2(x, z) * p.shade[1]); c.lerp(_pathC, 1 - ss(td, p.from, p.to)); }
  }
});

/**
 * Driftwood's faceted ground (E357 S4.3 step 3, 08 §6.3 B): the look's `terrainPainter`, built by `Terrain.build` in
 * place of the engine's default ground. SHARD-PLATFORM M3: the faceted grid, its flat-colour patch and the slab walls are
 * @wildshard/sdk/looks/facetedGround from data/groundLook.ts; this keeps the island's paint: sand / grass / rock by height
 * and slope (./groundColor.ts) and the sand paths over the grass. The sea level is the manifest's `OCEAN.level`.
 */
import * as THREE from 'three';
import { facetedGroundPainter } from '@wildshard/sdk/looks/facetedGround';
import type { TerrainPainter } from '@wildshard/engine/render/look';
import { GROUND_LOOK, GROUND_PATHS } from '../data/groundLook';
import { OCEAN } from '../manifest';
import { LP, hash2, lowPolyGroundColor } from './groundColor';

const _pathC = new THREE.Color();
const ss = THREE.MathUtils.smoothstep;

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

import { CHUNK_HALF, ROAD_LENGTH } from '@wildshard/engine/core/config';
import { buildTerrain } from '@wildshard/engine/world/terrainField';

/** Flat placement datum below the structure world; it is neither drawn nor registered as a heightfield. */
export const TERRAIN = buildTerrain(0x9d2a, {
  landscape: () => 0,
  trails: [
    [[0, -CHUNK_HALF], [0, -CHUNK_HALF + ROAD_LENGTH]],
    [[0, CHUNK_HALF], [0, CHUNK_HALF - ROAD_LENGTH]],
    [[-CHUNK_HALF, 0], [-CHUNK_HALF + ROAD_LENGTH, 0]],
    [[CHUNK_HALF, 0], [CHUNK_HALF - ROAD_LENGTH, 0]],
  ],
  cabinSites: [],
  splat: () => [1, 0, 0, 0],
});

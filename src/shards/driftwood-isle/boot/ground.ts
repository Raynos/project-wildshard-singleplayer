import { CHUNK_HALF, ROAD_LENGTH } from '@wildshard/engine/core/config';
import { createBakedTerrainField } from '@wildshard/engine/world/bakedTerrainField';
import { buildTerrainMetadata } from '@wildshard/engine/world/terrainField';
import { PATHS, PIER_PATH_BED } from '../data/layout';
import { DRIFTWOOD_TERRAIN } from '../data/terrainBindings';
import { DRIFTWOOD_SEA, LOWERED_SEA } from '../world/sea';
import sea from '../boot/sea.generated.json' with { type: 'json' };

const { WORLD_DROP } = sea;

export const GROUND = { paths: 'plugin' as const, water: [DRIFTWOOD_SEA], terrain: createBakedTerrainField(DRIFTWOOD_TERRAIN, { ...buildTerrainMetadata(DRIFTWOOD_TERRAIN.seed, {
    trails: [
      [[0, -CHUNK_HALF], [0, -CHUNK_HALF + ROAD_LENGTH]],
      [[0, CHUNK_HALF], [0, CHUNK_HALF - ROAD_LENGTH]],
      [[-CHUNK_HALF, 0], [-CHUNK_HALF + ROAD_LENGTH, 0]],
      [[CHUNK_HALF, 0], [CHUNK_HALF - ROAD_LENGTH, 0]],
      PIER_PATH_BED, ...PATHS.slice(1),
    ],
    cabinSites: [],

  }, () => LOWERED_SEA), datum: -WORLD_DROP }) };

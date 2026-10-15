import { buildTerrain } from '@wildshard/engine/world/terrainField';
import { createBakedTerrainField } from '@wildshard/engine/world/bakedTerrainField';
import { SEED, TRAIL } from '../data/layout';

/** Native ground ownership keeps its original metadata and required samples. */
export const GROUND = { paths: 'plugin', terrain: createBakedTerrainField({key: 'sunscar-dunes', seed: SEED},
  buildTerrain(SEED, {landscape: () => 0, trails: TRAIL, cabinSites: []})) } as const;

import { buildTerrain } from '@wildshard/engine/world/terrainField';
import { createBakedTerrainField } from '@wildshard/engine/world/bakedTerrainField';
import LAYOUT from '../data/layout.generated.json' with { type: 'json' };

// JSON erases tuple arity; the fixed-layout gate pins every authored trail point.
/** Native ground ownership keeps its original metadata and required samples. */
export const GROUND = { paths: 'plugin', terrain: createBakedTerrainField({key: 'sunscar-dunes', seed: LAYOUT.SEED},
  buildTerrain(LAYOUT.SEED, {landscape: () => 0, trails: LAYOUT.TRAIL as [number, number][][], cabinSites: []})) } as const;

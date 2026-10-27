import { DECLARED_SEA, WORLD_DROP } from './sea';
import { TRAILS } from './landscapeRows';
import TERRAIN from '../data/terrainBindings.json' with { type: 'json' };

/** Original declared ground rows, supplied as bounded discovery data by the build program. */
export function driftwoodGroundDeclaration(): { terrain: { key: string; seed: number }; trails: typeof TRAILS; cabinSites: never[]; water: number; datum: number; bodies: typeof DECLARED_SEA[]; paths: 'plugin' } {
  return { terrain: { key: TERRAIN.key, seed: TERRAIN.seed }, trails: TRAILS, cabinSites: [],
    water: DECLARED_SEA.level, datum: -WORLD_DROP, bodies: [DECLARED_SEA], paths: 'plugin' as const };
}

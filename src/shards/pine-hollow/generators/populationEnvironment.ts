
import { PopulationEnvironmentSchema , type PopulationEnvironmentRows as PopulationEnvironmentRowsType } from '@wildshard/format/populationEnvironment';
import { parse } from 'valibot';
import * as layout from './layout';
import ground from '../data/ground.generated.json' with { type: 'json' };
import { pinePhysics } from './physics';

// GR8: called, not read from a scheduler job's output
const physics = pinePhysics();

/** Exact native metadata; only the renderer keeps the authored terrain implementation. */
export const POPULATION_ENVIRONMENT: PopulationEnvironmentRowsType = parse(PopulationEnvironmentSchema, {
  id: 'pine.habitat', seed: 1337, chunkHalf: 250, normalEpsilon: .6, sampling: 'bilinear', water: layout.POND.level, sea: false,
  trails: [layout.S_ROAD, layout.N_ROAD, layout.W_ROAD, layout.E_ROAD, ...Object.entries(layout.SPURS).map(([id, path]) => id === 'den' ? layout.DEN_TRAIL : id === 'lookout' ? layout.LOOKOUT_TRAIL : path)],
  cabins: layout.CABIN_SITES.map(({ x, z }) => ({ x, z })), pond: { x: layout.POND.x, z: layout.POND.z, r: layout.POND.r }, trees: physics.trees,
  // the creek as the ground declares it (generators/bake-geography.mjs `pineGround`): its rest surface, the pool at full
  stream: ground.bodies.find(body => body.kind === 'stream') ?? null,
});

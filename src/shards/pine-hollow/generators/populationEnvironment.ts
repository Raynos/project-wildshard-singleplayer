
import { parsePopulationEnvironment, type PopulationEnvironment as PopulationEnvironmentRowsType } from '@wildshard/sdk/rows';
import * as layout from './layout';
import { pineGeographyRows } from './geographyRows';
import { pinePhysics } from './physics';

// GR8 G33b: the declared ground rows, computed (the retired pine-geography job wrote them as data/ground.generated.json)
const ground = pineGeographyRows().ground;

// GR8: called, not read from a scheduler job's output
const physics = pinePhysics();

/** Exact native metadata; only the renderer keeps the authored terrain implementation. */
export const POPULATION_ENVIRONMENT: PopulationEnvironmentRowsType = parsePopulationEnvironment({
  id: 'pine.habitat', seed: 1337, chunkHalf: 250, normalEpsilon: .6, sampling: 'bilinear', water: layout.POND.level, sea: false,
  trails: [layout.S_ROAD, layout.N_ROAD, layout.W_ROAD, layout.E_ROAD, ...Object.entries(layout.SPURS).map(([id, path]) => id === 'den' ? layout.DEN_TRAIL : id === 'lookout' ? layout.LOOKOUT_TRAIL : path)],
  cabins: layout.CABIN_SITES.map(({ x, z }) => ({ x, z })), pond: { x: layout.POND.x, z: layout.POND.z, r: layout.POND.r }, trees: physics.trees,
  // the creek as the ground declares it (generators/geographyRows.ts, the declared ground): its rest surface, the pool at full
  stream: ground.bodies.find(body => body.kind === 'stream') ?? null,
});

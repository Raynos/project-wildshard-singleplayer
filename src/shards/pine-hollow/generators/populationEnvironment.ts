import { PopulationEnvironmentSchema } from '@wildshard/format/populationEnvironment';
import { parse } from 'valibot';
import layout from '../data/layout.generated.json' with { type: 'json' };
import geography from '../data/geography.generated.json' with { type: 'json' };
import physics from '../data/physics.generated.json' with { type: 'json' };

const creek = geography.creek;
const constant = (height: number) => ({ pieces: [], last: { from: height, to: height, start: 0, offset: 0, span: 1 } });
const line = (row: typeof creek.run) => ({ from: row.from, to: row.to, start: row.start, offset: row.offset, span: row.span });
const bed = { pieces: creek.bed.map(row => ({ until: row.until, line: line(row) })), last: line(creek.run) };
const value = (profile: typeof bed, add = 0) => ({ profile, add });
/** Exact native metadata; only the renderer keeps the authored terrain implementation. */
export const POPULATION_ENVIRONMENT = parse(PopulationEnvironmentSchema, {
  id: 'pine.habitat', seed: 1337, chunkHalf: 250, normalEpsilon: .6, sampling: 'bilinear', water: layout.POND.level, sea: false,
  trails: [layout.S_ROAD, layout.N_ROAD, layout.W_ROAD, layout.E_ROAD, ...Object.entries(layout.SPURS).map(([id, path]) => id === 'den' ? layout.DEN_TRAIL : id === 'lookout' ? layout.LOOKOUT_TRAIL : path)],
  cabins: layout.CABIN_SITES.map(({ x, z }) => ({ x, z })), pond: { x: layout.POND.x, z: layout.POND.z, r: layout.POND.r }, trees: physics.trees,
  stream: { lines: creek.lines, halfWidth: creek.halfWidth,
    bands: [
      { until: creek.riffle, inclusive: false, values: [value(constant(layout.POND.level))] },
      { until: creek.dam-creek.lead, inclusive: false, values: [value(constant(layout.beaverPoolLevel.y)), value(bed,.05)] },
      { until: creek.dam, inclusive: true, values: [value(bed,creek.crest)] },
    ], last: [value(bed,creek.crest), value({ pieces: [], last: line(creek.run) },creek.depth)],
  },
});

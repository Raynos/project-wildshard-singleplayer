import { emptyShardfile } from '@wildshard/sdk/author';
import declared from './outputs.json' with { type: 'json' };
import { sourceFor, type PlotIdea } from './data/source';

/** The open-plots source shard (SF88g, G538/G539/G541/G542/G545): data rows (`outputs.json`, one product per idea) and one
 *  build-time generator (`generators/bake-plots.mjs`, which writes each idea's `assets/<idea>/world.glb`); no runtime
 *  code. The world bake turns a plot into tiles, collision (its `collide_` nodes only), edges and a far proxy. */
function project(row: PlotIdea) {
  const source = sourceFor(row);
  return { ...emptyShardfile(source.identity), ...source,
    world: { glb: `assets/${row.idea}/world.glb`, colliders: 'nodes:collide_',
      materials: { Floor: 'floor', Kerb: 'kerb', Plinth: 'plinth', Rim: 'rim', Frame: 'frame', Billboard: 'billboard', Sign: 'sign', Hologram: 'hologram' } },
  };
}

const [first] = declared.outputs;
if (first === undefined) throw new Error('open-plots: outputs.json needs an idea row');

/** Every output, keyed by its product slug (`wildshard build --output=<slug>`, scripts/shard-outputs.mjs). */
export const outputs = Object.fromEntries(declared.outputs.map((row) => [row.slug, project(row)]));

// oxlint-disable-next-line import/no-default-export -- The SDK loads the author declaration; an output build selects from `outputs`.
export default project(first);

/** Explicit standalone author-source ceiling; this project has no frozen legacy denominator. */
export const buildOptions = { asLineCeiling: 256 };

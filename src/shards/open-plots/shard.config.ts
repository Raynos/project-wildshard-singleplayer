import { emptyShardfile } from '@wildshard/sdk/author';
import declared from './outputs.json' with { type: 'json' };
import source from './data/source.json' with { type: 'json' };
import hologram from './data/hologram.graph.json' with { type: 'json' };
import beam from './data/beam.graph.json' with { type: 'json' };
import plot from './data/plot.json' with { type: 'json' };

/** The open-plots source shard (SF88g, G538/G539/G541/G542/G545): data rows (`outputs.json`, one product per idea) and one
 *  build-time generator (`generators/bake-plots.mjs`, which writes each idea's `assets/<idea>/world.glb`); no runtime
 *  code. The world bake turns a plot into tiles, collision (its `collide_` nodes only), edges and a far proxy.
 *  `data/source.json` holds the plot's authorship, spawn and look (G541, G545: the measure-grid survey floor, plain PBR
 *  kerb and frames, lit-from-within billboard and sign, cyan rim); the idea's hologram and the corner beams draw in the
 *  ONE shared hologram graph (`data/hologram.graph.json`) and `data/beam.graph.json` (G539). */
const look = { ...source.look, materials: { ...source.look.materials,
  // G608: the beams fade over their full height (data/plot.json)
  hologram: { family: 'graph', graph: hologram }, beam: { family: 'graph', graph: { ...beam, params: { ...beam.params, top: { ...beam.params.top, value: plot.beam.height } } } } } };

/** One idea row's output (validated whole by the build's parseShardfile; SF88g: one per idea). */
function project(row: { readonly slug: string; readonly idea: string; readonly name: string; readonly accent: string }) {
  const identity = { slug: row.slug, name: `Open Plot · ${row.name}`, author: source.author, revision: source.revision, seed: source.seed };
  return { ...emptyShardfile(identity), identity, accent: row.accent, spawn: source.spawn, look,
    // G608: the `far_` stand-ins draw only in the far proxy and the plot's own coarse near view
    world: { glb: `assets/${row.idea}/world.glb`, colliders: 'nodes:collide_', far: 'far_', near: 'coarse',
      materials: { Floor: 'floor', Kerb: 'kerb', Plinth: 'plinth', Rim: 'rim', Frame: 'frame', Billboard: 'billboard', Sign: 'sign', Hologram: 'hologram', Beam: 'beam', Glow: 'rim' } },
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

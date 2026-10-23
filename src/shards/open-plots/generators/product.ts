import { emptyShardfile } from '@wildshard/sdk/author';
import declared from '../outputs.json' with { type: 'json' };
import source from '../data/source.json' with { type: 'json' };
import hologram from '../data/hologram.graph.json' with { type: 'json' };
import glowFlicker from '../data/glowFlicker.graph.json' with { type: 'json' };
import poolFlicker from '../data/poolFlicker.graph.json' with { type: 'json' };

/** The open-plots source shard (SF88g, G538/G539/G541/G542/G545): data rows (`outputs.json`, one product per idea) and one
 *  build-time generator (`generators/bake-plots.mjs`, which writes each idea's `assets/<idea>/world.glb`); this module
 *  assembles each idea's product at build time (shard.config.ts is its documented entry); no runtime code. The world bake turns a plot into tiles, collision (its `collide_` nodes only), edges and a far proxy.
 *  `data/source.json` holds the plot's authorship, spawn and look (G541, G545: the measure-grid survey floor, plain PBR
 *  kerb and frames, lit-from-within billboard and sign, cyan rim); each hologram draws in the shared graph. */
const look = { ...source.look, materials: { ...source.look.materials,
  hologram: { family: 'graph', graph: hologram } } };

const { why: _why, ...tiledMaterials } = source.tiledMaterials;
/** G641: a tiled plot's look adds the kit's materials (generators/tiledPlot.mjs) */
// NM10: the lanterns, windows and their light pools flicker a little, each on its own phase (world position), unlit as the
// emissive family drew them (glow x2.4 +-12 %, pool additive x1.2 +-8 %)
const tiledLook = { ...look, materials: { ...look.materials, ...tiledMaterials,
  glow: { family: 'graph', graph: glowFlicker }, pool: { family: 'graph', graph: poolFlicker } } };

/** One idea row's output (validated whole by the build's parseShardfile; SF88g: one per idea). */
function project(row: { readonly slug: string; readonly idea: string; readonly name: string; readonly accent: string; readonly layout?: string; readonly look?: { readonly keys: readonly unknown[] } }) {
  const identity = { slug: row.slug, name: `Open Plot · ${row.name}`, author: source.author, revision: source.revision, seed: source.seed };
  // G641: a row with a layout is a tiled plot; its far proxy is its far-only stand-ins alone (NM0's farMode 'replace')
  // NM12: a row's own sky keys (the Night Market's night) over the plots' shared dusk
  if (row.layout !== undefined) return { ...emptyShardfile(identity), identity, accent: row.accent, spawn: source.spawn, look: row.look === undefined ? tiledLook : { ...tiledLook, keys: row.look.keys },
    // NM5: its own near view from its coarse tiles, so the road sees the tiles instead of the far proxy
    world: { glb: `assets/${row.idea}/world.glb`, colliders: 'nodes:collide_', far: 'far_', farMode: 'replace', near: 'coarse',
      materials: { Paving: 'kit', Kit: 'kit', Water: 'water', Glow: 'glow', Pool: 'pool', Landmark: 'landmark', Poster: 'billboard' } },
  };
  return { ...emptyShardfile(identity), identity, accent: row.accent, spawn: source.spawn, look,
    // G608: the `far_` stand-ins draw only in the far proxy
    world: { glb: `assets/${row.idea}/world.glb`, colliders: 'nodes:collide_', far: 'far_',
      materials: { Floor: 'floor', Kerb: 'kerb', Plinth: 'plinth', Rim: 'rim', Frame: 'frame', Billboard: 'billboard', Sign: 'sign', Hologram: 'hologram', Glow: 'rim' } },
  };
}

const [first] = declared.outputs;
if (first === undefined) throw new Error('open-plots: outputs.json needs an idea row');

/** Every output, keyed by its product slug (`wildshard build --output=<slug>`, scripts/shard-outputs.mjs). */
export const outputs = Object.fromEntries(declared.outputs.map((row) => [row.slug, project(row)]));

/** The first idea's output: the project's default build. */
export const product = project(first);

import { emptyShardfile } from '@wildshard/sdk/author';
import { SOURCE } from './data/source';

const base = emptyShardfile(SOURCE.identity);
/** The open-plots source shard (SF88g, G538/G539/G541/G545): data rows (`data/ideas.json`) and one build-time generator
 *  (`generators/bake-plots.mjs`, which writes `assets/world.glb`); no runtime code. The world bake turns the plot into
 *  tiles, collision (its `collide_` nodes only), edges and a far proxy. */
const project = { ...base, ...SOURCE,
  world: { glb: 'assets/world.glb', colliders: 'nodes:collide_',
    materials: { Floor: 'floor', Kerb: 'kerb', Plinth: 'plinth', Rim: 'rim', Frame: 'frame', Billboard: 'billboard', Sign: 'sign', Hologram: 'hologram' } },
};

// oxlint-disable-next-line import/no-default-export -- The SDK loads the author declaration.
export default project;

/** Explicit standalone author-source ceiling; this project has no frozen legacy denominator. */
export const buildOptions = { asLineCeiling: 256 };

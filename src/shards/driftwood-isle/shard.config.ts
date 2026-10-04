import { emptyShardfile } from '@wildshard/sdk/author';
import { parseShardfile } from '@wildshard/sdk/shardfile';

// SF46 step 1: content and the existing look stay in the declared trusted entry until the grid-ready bake lands.
// oxlint-disable-next-line import/no-default-export -- The author CLI loads shard.config.ts as the project entry.
export default parseShardfile({
  ...emptyShardfile({ slug: 'driftwood-isle', name: 'Driftwood Isle', author: 'Wildshard', revision: 1, seed: 0x5ea1 }),
  runtime: { entry: 'runtime/hybrid.ts' },
  spawn: { x: 0, y: 1.2, z: -194, yaw: Math.PI },
});

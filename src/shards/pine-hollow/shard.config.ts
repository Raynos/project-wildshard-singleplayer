import { emptyShardfile } from '@wildshard/sdk/author';
import { parseShardfile } from '@wildshard/sdk/shardfile';
import { PINE_AUDIO } from './data/audio';

// The trusted legacy entry keeps the live world; SF29 binds its existing audio to these rows.
// oxlint-disable-next-line import/no-default-export -- The author CLI loads shard.config.ts as the project entry.
export default parseShardfile({
  ...emptyShardfile({ slug: 'pine-hollow', name: 'Pine Hollow', author: 'Wildshard', revision: 1, seed: 1337 }),
  accent: 'moss',
  runtime: { entry: 'runtime/index.ts' }, audio: PINE_AUDIO, spawn: { x: 0, y: 0, z: -235, yaw: Math.PI },
});

import { emptyShardfile } from '@wildshard/sdk/author';
import { parseShardfile } from '@wildshard/sdk/shardfile';
import { AUDIO } from './data/audio';

// Legacy trusted runtime retains today's geometry/spawn; SF29 binds only its audio.
// oxlint-disable-next-line import/no-default-export -- The author CLI loads shard.config.ts as the project entry.
export default parseShardfile({ ...emptyShardfile({ slug: 'sunscar-dunes', name: 'Signal Dunes', author: 'Wildshard', revision: 1, seed: 5363 }), accent: 'orchid', runtime: { entry: 'runtime/index.ts' }, audio: AUDIO });

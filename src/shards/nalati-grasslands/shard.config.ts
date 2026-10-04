import { emptyShardfile } from '@wildshard/sdk/author';
import { parseShardfile } from '@wildshard/sdk/shardfile';
import { NALATI_AUDIO } from './data/audio';

// The existing plugin remains the trusted world entry while its audio comes from the shardfile.
// oxlint-disable-next-line import/no-default-export -- The author CLI loads shard.config.ts as the project entry.
export default parseShardfile({ ...emptyShardfile({ slug: 'nalati-grasslands', name: 'Nalati Grasslands', author: 'Wildshard', revision: 1, seed: 0x4a1a }),
  accent: 'ember', runtime: { entry: 'runtime/index.ts' }, audio: NALATI_AUDIO, spawn: { x: 0, y: 0, z: 232, yaw: 0 } });

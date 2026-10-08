import { NINE_DRAGON_RUNTIME_COST } from './data/runtimeCost';
import { emptyShardfile } from '@wildshard/sdk/author';
import { parseShardfile } from '@wildshard/sdk/shardfile';
import { ND_AUDIO } from './data/audio';

// The trusted runtime preserves today's fragment geometry; audio is selected by its declared section.
// oxlint-disable-next-line import/no-default-export -- The author CLI loads shard.config.ts as the project entry.
export default parseShardfile({ ...emptyShardfile({ slug: 'nine-dragon-stack', name: 'Nine Dragon Stack', author: 'Wildshard', revision: 1, seed: 0x9d2a }),
  accent: 'iris', runtime: { entry: 'runtime/index.ts', cost: NINE_DRAGON_RUNTIME_COST }, audio: ND_AUDIO, spawn: { x: 0.95, y: 125, z: 7.5, yaw: -12 * (Math.PI / 180) } });

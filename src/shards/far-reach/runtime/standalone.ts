import type { ShardPlugin } from '@wildshard/game/plugin/shardPlugin';
import { firstPartyStandaloneEntry } from '@wildshard/game/shard/runtimeVariant';

/** SF73: admit this primary's data and bound runtime for SHARDFILE, preserving the supplied native LEGACY constructor. */
export const standaloneEntry = (Native: new () => ShardPlugin): ReturnType<typeof firstPartyStandaloneEntry> =>
  firstPartyStandaloneEntry(Native, 'Sky Reach', () => import('../shard.config'), () => import('./index'), 'runtime');

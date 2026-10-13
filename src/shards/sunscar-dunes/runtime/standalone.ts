import type { ShardPlugin } from '@wildshard/game/plugin/context';
import { firstPartyStandaloneEntry } from '@wildshard/game/shard/runtimeVariant';

/** Admit Signal's data and native runtime through the shared first-party standalone entry. */
export const standaloneEntry = (Native: new () => ShardPlugin): ReturnType<typeof firstPartyStandaloneEntry> =>
  firstPartyStandaloneEntry(Native, 'Signal Dunes', () => import('./source'), () => import('./index'));

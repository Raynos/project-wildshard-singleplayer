import type { ShardPlugin } from '@wildshard/game/shard/plugin';
import { standaloneHybridEntry as platformEntry, type StandaloneEntry, type StandaloneSources } from '@wildshard/game/shard/standaloneEntry';

/** Where a first-party primary's shardfile and trusted runtime load from. */
export type HybridSources = StandaloneSources;
/** A standalone entry's constructor (native LEGACY, SHARDFILE admission, the switch). */
export type HybridEntry = StandaloneEntry;
/** A first-party primary's standalone entry (SF73 / SF27): its shardfile admitted as a hybrid under SHARDFILE, else the native plugin. */
export function standaloneHybridEntry(Native: new () => ShardPlugin, sources: StandaloneSources): StandaloneEntry { return platformEntry(Native, sources); }

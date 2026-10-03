import type { ShardManifest } from './manifest';

// The shard list is the composition root's (src/shards.generated.ts, installed by src/shardList.ts; Node tools by
// scripts/bake-loader.mjs; E362 AG4): the game knows that shards exist, never which. One slot per page, so a test that
// resets its modules still sees it. No runtime imports: a Node tool installs it without loading the engine.
const SLOT = Symbol.for('game.shards');
const isList = (v: unknown): v is readonly ShardManifest[] => Array.isArray(v);
export function installShards(list: readonly ShardManifest[]): void { Reflect.set(globalThis, SLOT, list); }
/** every shard, sorted by `order` */
export function shards(): readonly ShardManifest[] {
  const list: unknown = Reflect.get(globalThis, SLOT);
  if (!isList(list)) throw new Error('No shard list installed: the composition root installs it (src/shardList.ts)');
  return list;
}

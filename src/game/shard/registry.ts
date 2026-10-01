/** Generated shard discovery and the legacy active-shard bridge (removed by shard phases). */
import type { ShardManifest } from './manifest';
import { SHARDS } from './shards.generated';
import { _applyChunkConstants } from '#engine/core/config';
import { onScopeDispose } from '#engine/app/legacyCapture';

export { SHARDS } from './shards.generated';
export { SHARD_API } from './api';
export const DEFAULT_SHARD = 'driftwood-isle';
export const playable = (manifest: ShardManifest): boolean => manifest.status !== 'hidden';

export function shardSlugFromUrl(search?: string): string {
  const named = new URLSearchParams(search ?? (typeof location === 'undefined' ? '' : location.search)).get('chunk');
  return named ?? DEFAULT_SHARD;
}

export function findShard(slug: string): ShardManifest | undefined { return SHARDS.find((manifest) => manifest.slug === slug); }

function initialShard(): ShardManifest {
  const manifest = findShard(shardSlugFromUrl()) ?? findShard(DEFAULT_SHARD);
  if (manifest === undefined) throw new Error(`Missing default shard ${DEFAULT_SHARD}`);
  return manifest;
}

/** The game layer owns the running manifest; engine compatibility readers mirror it until S4.4. */
export const game = { shard: initialShard() };
_applyChunkConstants(game.shard);

const listeners: ((def: ShardManifest) => void)[] = [];

export function getActiveChunk(): ShardManifest { return game.shard; }

/** Select a chunk by slug. Unknown slugs fall back to the default (and warn). */
export function setActiveChunk(slug: string): ShardManifest {
  const def = findShard(slug);
  if (!def) console.warn(`[chunks] unknown chunk "${slug}", using ${DEFAULT_SHARD}`);
  const next = def ?? findShard(DEFAULT_SHARD);
  if (next === undefined) throw new Error(`Missing default shard ${DEFAULT_SHARD}`);
  if (next !== game.shard) {
    game.shard = next;
    _applyChunkConstants(game.shard);
    for (const fn of listeners) fn(game.shard);
  }
  return game.shard;
}

export function onActiveChunkChange(fn: (def: ShardManifest) => void): void {
  listeners.push(fn);
  onScopeDispose(() => { const i = listeners.indexOf(fn); if (i !== -1) listeners.splice(i, 1); }); // a resident shard's (its Minimap): gone with it
}

/** URL for the same page with another chunk selected (other params kept). */
export function chunkUrl(slug: string, from: string = location.href): string {
  const url = new URL(from);
  url.searchParams.set('chunk', slug);
  return url.toString();
}

export { findShard as findChunk, shardSlugFromUrl as chunkSlugFromUrl, DEFAULT_SHARD as DEFAULT_CHUNK };

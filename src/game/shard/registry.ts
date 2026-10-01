/** Generated shard discovery and the legacy active-shard bridge (removed by shard phases). */
import type { ShardManifest } from './manifest';
import { SHARDS } from './shards.generated';
import { _applyChunkConstants } from '#engine/core/config';
import { onOwnerDispose } from '#engine/app/ownership';
import { configureLevel } from '#engine';
import { toLevelSpec } from './spec';

export { SHARDS } from './shards.generated';
export { SHARD_API } from './api';
/** a bare URL boots the first shard by `order` (SHARDS is sorted by it) */
export const DEFAULT_SHARD: string = (() => {
  const first = SHARDS[0];
  if (first === undefined) throw new Error('No shard manifests were generated');
  return first.slug;
})();
export const playable = (manifest: ShardManifest): boolean => manifest.status !== 'hidden';

export function shardSlugFromUrl(search?: string): string {
  const named = new URLSearchParams(search ?? (typeof location === 'undefined' ? '' : location.search)).get('chunk');
  return named ?? DEFAULT_SHARD;
}

export function findShard(slug: string): ShardManifest | undefined { return new Map<string, ShardManifest>(SHARDS.map((manifest) => [manifest.slug, manifest])).get(slug); }

function initialShard(): ShardManifest {
  const manifest = findShard(shardSlugFromUrl()) ?? findShard(DEFAULT_SHARD);
  if (manifest === undefined) throw new Error(`Missing default shard ${DEFAULT_SHARD}`);
  return manifest;
}

/** The game layer owns the running manifest; engine compatibility readers mirror it until S4.4. */
export const game = { shard: initialShard() };
_applyChunkConstants(game.shard);
configureLevel(toLevelSpec(game.shard));

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
    configureLevel(toLevelSpec(game.shard));
    for (const fn of listeners) fn(game.shard);
  }
  return game.shard;
}

export function onActiveChunkChange(fn: (def: ShardManifest) => void): void {
  listeners.push(fn);
  onOwnerDispose(() => { const i = listeners.indexOf(fn); if (i !== -1) listeners.splice(i, 1); }); // a resident shard's (its Minimap): gone with it
}

/** URL for the same page with another chunk selected (other params kept). */
export function chunkUrl(slug: string, from: string = location.href): string {
  const url = new URL(from);
  url.searchParams.set('chunk', slug);
  return url.toString();
}

export { findShard as findChunk, shardSlugFromUrl as chunkSlugFromUrl, DEFAULT_SHARD as DEFAULT_CHUNK };

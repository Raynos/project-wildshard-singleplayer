/** Generated shard discovery and the legacy active-shard bridge (removed by shard phases). */
import type { ShardManifest } from './manifest';
import { configureLevel, _applyChunkConstants, onOwnerDispose } from '#engine';
import { toLevelSpec } from './spec';
import { shards } from './list';

export { installShards, shards } from './list';
export { SHARD_API } from './api';
/** a bare URL boots the first shard by `order` (the list is sorted by it) */
export function defaultShard(): string {
  const first = shards()[0];
  if (first === undefined) throw new Error('No shard manifests were generated');
  return first.slug;
}
export const playable = (manifest: ShardManifest): boolean => manifest.status !== 'hidden';

export function shardSlugFromUrl(search?: string): string {
  const named = new URLSearchParams(search ?? (typeof location === 'undefined' ? '' : location.search)).get('chunk');
  return named ?? defaultShard();
}

export function findShard(slug: string): ShardManifest | undefined { return new Map<string, ShardManifest>(shards().map((manifest) => [manifest.slug, manifest])).get(slug); }

function initialShard(): ShardManifest {
  const manifest = findShard(shardSlugFromUrl()) ?? findShard(defaultShard());
  if (manifest === undefined) throw new Error(`Missing default shard ${defaultShard()}`);
  return manifest;
}

/** The game layer owns the running manifest; engine compatibility readers mirror it until S4.4. Resolved on first read,
 *  not at import: the shard list is installed by the composition root (src/shardList.ts), which reads it right after. */
let current: ShardManifest | null = null;
function active(): ShardManifest {
  if (current === null) {
    current = initialShard();
    _applyChunkConstants(current);
    configureLevel(toLevelSpec(current));
  }
  return current;
}
export const game = {
  get shard(): ShardManifest { return active(); },
  set shard(next: ShardManifest) { current = next; },
};

const listeners: ((def: ShardManifest) => void)[] = [];

export function getActiveChunk(): ShardManifest { return game.shard; }

/** Select a chunk by slug. Unknown slugs fall back to the default (and warn). */
export function setActiveChunk(slug: string): ShardManifest {
  const def = findShard(slug);
  if (!def) console.warn(`[chunks] unknown chunk "${slug}", using ${defaultShard()}`);
  const next = def ?? findShard(defaultShard());
  if (next === undefined) throw new Error(`Missing default shard ${defaultShard()}`);
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

export { findShard as findChunk, shardSlugFromUrl as chunkSlugFromUrl, defaultShard as defaultChunk };

/** Generated shard discovery and the legacy active-shard bridge (removed by shard phases). */
import type { ShardManifest } from './manifest';
import { _applyChunkConstants } from '@wildshard/engine/core/config';
import { configureLevel } from '@wildshard/engine/level/selection';
import { toLevelSpec } from './spec';
import { shards } from './list';

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

/** O15: each installed list's slug table, built once (a Map of every manifest per call was ~500 Simulator samples of
 *  Driftwood's road-entry drive: the grid's per-frame readers look shards up by slug) */
const bySlug = new WeakMap<readonly ShardManifest[], ReadonlyMap<string, ShardManifest>>();
export function findShard(slug: string): ShardManifest | undefined {
  const list = shards();
  let table = bySlug.get(list);
  if (table === undefined) { table = new Map(list.map((manifest) => [manifest.slug, manifest])); bySlug.set(list, table); }
  return table.get(slug);
}

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
  }
  return game.shard;
}


/** URL for the same page with another chunk selected (other params kept). */
export function chunkUrl(slug: string, from: string = location.href): string {
  const url = new URL(from);
  url.searchParams.set('chunk', slug);
  return url.toString();
}

export { findShard as findChunk, shardSlugFromUrl as chunkSlugFromUrl, defaultShard as defaultChunk };

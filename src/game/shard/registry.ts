/**
 * Shard registry — which chunks exist and which one is loaded.
 *
 *   CHUNKS                       every authored ShardManifest, in title-screen order
 *   getActiveChunk()             the def the engine is building / running
 *   setActiveChunk(slug)         switch (before bootstrap(); rebinds config + Heightfield)
 *   onActiveChunkChange(fn)      called with the new def on every switch
 *   chunkSlugFromUrl()           `?chunk=<slug>` or the Driftwood default
 *
 * The initial active chunk is resolved from the URL at module init, so anything that reads
 * `SEED` / `heightAt` at import time already sees the right shard. Since E216 each page builds one shard; picking
 * another on the title screen navigates to a fresh document with its `?chunk=`.
 */
import type { ShardManifest } from './manifest';
import { PINE_HOLLOW } from '#shards/pine-hollow/manifest';
import { DRIFTWOOD_ISLE } from '#shards/driftwood-isle/manifest';
import { NALATI_GRASSLANDS } from '#shards/nalati-grasslands/manifest';
import { NINE_DRAGON_STACK } from '#shards/nine-dragon-stack/manifest';
import { _applyChunkConstants } from '#engine/core/config';
import { onScopeDispose } from '#engine/core/shardScope';

export const DEFAULT_CHUNK = 'driftwood-isle';

export const CHUNKS: [ShardManifest, ...ShardManifest[]] = [
  DRIFTWOOD_ISLE,
  PINE_HOLLOW,
  NALATI_GRASSLANDS, // EARLY ACCESS (project/archive/2026-09-24-nalati-merge.md E1): playable, still being built
];

export function chunkSlugFromUrl(search?: string): string {
  const named = new URLSearchParams(search ?? location.search).get('chunk');
  return named ?? DEFAULT_CHUNK;
}

/**
 * Prototype shards (NINE-DRAGON-STACK P0-5c): built on the engine, in the title deck for everyone as an EXPERIMENTAL card
 * (src/game/titleDeck.ts — E318: one deck, one status, the cold launch's). Not in CHUNKS: the shard prefetch, the packs and
 * the every-shard tests do not reach them.
 */
export const PROTOTYPES: ShardManifest[] = [NINE_DRAGON_STACK];

export function findChunk(slug: string): ShardManifest | undefined {
  return CHUNKS.find((c) => c.slug === slug) ?? PROTOTYPES.find((c) => c.slug === slug);
}

const listeners: ((def: ShardManifest) => void)[] = [];
let active: ShardManifest = findChunk(chunkSlugFromUrl()) ?? CHUNKS[0];
_applyChunkConstants(active);

export function getActiveChunk(): ShardManifest { return active; }

/** Select a chunk by slug. Unknown slugs fall back to the default (and warn). */
export function setActiveChunk(slug: string): ShardManifest {
  const def = findChunk(slug);
  if (!def) console.warn(`[chunks] unknown chunk "${slug}", using ${DEFAULT_CHUNK}`);
  const next = def ?? findChunk(DEFAULT_CHUNK) ?? CHUNKS[0];
  if (next !== active) {
    active = next;
    _applyChunkConstants(active);
    for (const fn of listeners) fn(active);
  }
  return active;
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

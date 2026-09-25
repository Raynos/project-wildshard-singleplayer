/**
 * Shard registry — which chunks exist and which one is loaded.
 *
 *   CHUNKS                       every authored ChunkDef, in title-screen order
 *   getActiveChunk()             the def the engine is building / running
 *   setActiveChunk(slug)         switch (before bootstrap(); rebinds config + Heightfield)
 *   onActiveChunkChange(fn)      called with the new def on every switch
 *   chunkSlugFromUrl()           `?chunk=<slug>` or the default
 *
 * The initial active chunk is resolved from the URL at module init, so anything that reads
 * `SEED` / `heightAt` at import time already sees the right shard. One chunk RUNS at a time; since E155 several can
 * be built in the page (src/shard/ShardHost.ts): picking another on the title screen switches to it in place, and the
 * host calls setActiveChunk on every switch (the URL's `?chunk=` follows it).
 */
import type { ChunkDef } from './ChunkDef';
import { PINE_HOLLOW } from './pine-hollow';
import { DRIFTWOOD_ISLE } from './driftwood-isle';
import { NALATI_GRASSLANDS } from './nalati-grasslands';
import { _applyChunkConstants } from '../core/config';
import { onScopeDispose } from '../core/shardScope';

export const DEFAULT_CHUNK = 'driftwood-isle';

export const CHUNKS: [ChunkDef, ...ChunkDef[]] = [
  DRIFTWOOD_ISLE,
  PINE_HOLLOW,
  NALATI_GRASSLANDS, // EARLY ACCESS (project/archive/2026-09-24-nalati-merge.md E1): playable, still being built
];

export function chunkSlugFromUrl(search = location.search): string {
  return new URLSearchParams(search).get('chunk') ?? DEFAULT_CHUNK;
}

export function findChunk(slug: string): ChunkDef | undefined {
  return CHUNKS.find((c) => c.slug === slug);
}

const listeners: ((def: ChunkDef) => void)[] = [];
let active: ChunkDef = findChunk(chunkSlugFromUrl()) ?? CHUNKS[0];
_applyChunkConstants(active);

export function getActiveChunk(): ChunkDef { return active; }

/** Select a chunk by slug. Unknown slugs fall back to the default (and warn). */
export function setActiveChunk(slug: string): ChunkDef {
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

export function onActiveChunkChange(fn: (def: ChunkDef) => void): void {
  listeners.push(fn);
  onScopeDispose(() => { const i = listeners.indexOf(fn); if (i !== -1) listeners.splice(i, 1); }); // a resident shard's (its Minimap): gone with it
}

/** URL for the same page with another chunk selected (other params kept). */
export function chunkUrl(slug: string, from: string = location.href): string {
  const url = new URL(from);
  url.searchParams.set('chunk', slug);
  return url.toString();
}

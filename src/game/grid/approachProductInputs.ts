import { gridShardfileProduct, type GridProduct, type GridProductOwner } from './products';
import { ApproachInputsDeferredError } from './productInputs';
import type { Scope } from '@wildshard/engine/app/scope';
import { timeClientPreparation } from '../shardfile/preparationTiming';
import { prefetchEntryReads } from './entryReadPrefetch';
import { TIER } from '@wildshard/engine/core/tier';

type InputBorrow = Pick<GridProduct, 'releaseInputs' | 'release'>;

/** Keep one verified input borrow through an approach. Cancellation drains the
 * started acquisition before releasing its charged bytes; a constructor's
 * overlapping borrow keeps the same inputs alive until its own final release. */
export async function holdApproachInputs(acquire: () => Promise<InputBorrow | undefined>, signal: AbortSignal, owner: Scope): Promise<void> {
  if (signal.aborted || owner.disposed || owner.disposing) return;
  const lifetime = owner.child('grid.approach-inputs');
  let stop = (): void => undefined;
  const ended = new Promise<void>(resolve => { stop = resolve; });
  lifetime.onDispose(stop); lifetime.listen(signal, 'abort', () => { lifetime.dispose(); }, { once: true });
  try {
    const input = await acquire();
    if (input === undefined) return;
    try { if (!lifetime.disposed) await ended; }
    finally { try { await input.releaseInputs(); } finally { input.release(); } }
  } finally { lifetime.dispose(); }
}

/** Approach IO uses ordinary product admission, verification and input claims.
 * No strips, regional foundation, runtime hooks or readiness are constructed. */
export function prepareApproachProductInputs(slug: string, owner: GridProductOwner & { readonly scope: Scope }, signal: AbortSignal): Promise<void> {
  return holdApproachInputs(() => timeClientPreparation(slug, 'grid.approach.inputs', async () => {
    // No ordinary input acquisition may run before the speculative headroom check.
    // A missing metadata admission defers this optimization to actual entry.
    const pending = gridShardfileProduct(slug, owner, { signal });
    if (pending === null) return undefined;
    let product: GridProduct;
    try { product = await pending; }
    catch (error) { if (error instanceof ApproachInputsDeferredError) return undefined; throw error; }
    // T7.14: what this region's entry will read, nearest-first, into the content / HTTP cache while the approach lasts
    void prefetchEntryReads(slug, TIER, { source: product.admitted.source, readBlob: hash => product.reader.read(hash),
      fetchAsset: async (url, abort) => { const response = await fetch(url, { signal: abort, priority: 'low' }); await response.arrayBuffer(); },
      fetchJson: async (url, abort) => { const response = await fetch(url, { signal: abort, cache: 'no-cache' }); if (!response.ok) throw new Error(`${String(response.status)} ${url}`); const json: unknown = await response.json(); return json; } }, signal)
      .then(count => { if (count > 0) performance.mark('wildshard.approach.entry-reads', { detail: { slug, count } }); return undefined; }, () => undefined);
    return product;
  }), signal, owner.scope);
}

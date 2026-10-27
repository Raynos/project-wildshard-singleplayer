import { gridShardfileProduct, type GridProduct, type GridProductOwner } from './products';
import type { Scope } from '@wildshard/engine/app/scope';
import { timeClientPreparation } from '../shardfile/preparationTiming';

type InputBorrow = Pick<GridProduct, 'releaseInputs' | 'release'>;

/** Keep one verified input borrow through an approach. Cancellation drains the
 * started acquisition before releasing its charged bytes; a constructor's
 * overlapping borrow keeps the same inputs alive until its own final release. */
export async function holdApproachInputs(acquire: () => Promise<InputBorrow>, signal: AbortSignal, owner: Scope): Promise<void> {
  if (signal.aborted || owner.disposed || owner.disposing) return;
  const lifetime = owner.child('grid.approach-inputs');
  let stop = (): void => undefined;
  const ended = new Promise<void>(resolve => { stop = resolve; });
  lifetime.onDispose(stop); lifetime.listen(signal, 'abort', () => { lifetime.dispose(); }, { once: true });
  try {
    const input = await acquire();
    try { if (!lifetime.disposed) await ended; }
    finally { try { await input.releaseInputs(); } finally { input.release(); } }
  } finally { lifetime.dispose(); }
}

/** Approach IO uses ordinary product admission, verification and input claims.
 * No strips, regional foundation, runtime hooks or readiness are constructed. */
export function prepareApproachProductInputs(slug: string, owner: GridProductOwner & { readonly scope: Scope }, signal: AbortSignal): Promise<void> {
  return holdApproachInputs(() => timeClientPreparation(slug, 'grid.approach.inputs', async () => {
    const pending = gridShardfileProduct(slug, owner);
    if (pending === null) throw new Error('Approach destination has no shardfile product');
    const product = await pending;
    try {
      const input = await product.prepareInputs(signal);
      return { releaseInputs: async () => {
        const results = await Promise.allSettled([input.release(), product.releaseInputs()]);
        for (const result of results) if (result.status === 'rejected') throw result.reason;
      }, release: product.release };
    } catch (error) { try { await product.releaseInputs(); } finally { product.release(); } throw error; }
  }), signal, owner.scope);
}

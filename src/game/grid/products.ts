/**
 * The grid page's admitted first-party shardfile products (SHARD-PLATFORM SF18a / SF18b): one admission per slug, shared by
 * the live host's regional sims (`liveSession.ts`) and the neighbours' render tiles (`session.ts`). The six template copies
 * share one product's immutable bytes; a failed admission is forgotten so a later request retries.
 */
import { findShard } from '../shard/registry';
import { admitProduct, boundedResponse, type AdmittedProduct, type ProductOptions } from '../shardfile/product';
import { browserShardfileOptions } from '../shardfile/loader';
import { SHARDFILE_ADMISSION_LIMITS as limits } from '../shardfile/admissionLimits';
import { ProductLeases } from './productLeases';
import type { ResidencyAllocator } from './allocator';

/** One admitted product and the options its assets resolve against (ClientAssets reads further tiles through them). */
export interface GridProduct { readonly admitted: AdmittedProduct; readonly options: ProductOptions; release: () => void }
/** One page allocator owns its product cache; consumers release only after their source/transport references are gone. */
export interface GridProductOwner { allocator: ResidencyAllocator; scope: { readonly disposed: boolean; onDispose: (dispose: () => void) => void } }

const products = new WeakMap<ResidencyAllocator, ProductLeases<Omit<GridProduct, 'release'>>>();
/** The slug's admitted shardfile, or null when the shard is not a shardfile shard (it stays a far proxy until M3). */
export function gridShardfileProduct(slug: string, owner: GridProductOwner): Promise<GridProduct> | null {
  const descriptor = findShard(slug)?.shardfile;
  if (descriptor === undefined) return null;
  if (owner.scope.disposed) return Promise.reject(new Error('Grid product page disposed'));
  let cache = products.get(owner.allocator);
  if (cache === undefined) {
    cache = new ProductLeases(owner.allocator, 'grid'); products.set(owner.allocator, cache);
    const owned = cache;
    owner.scope.onDispose(() => { owned.dispose(); products.delete(owner.allocator); });
  }
  return cache.acquire(slug, async reserve => {
    const url = new URL(descriptor, location.href), options = { ...browserShardfileOptions(new URL('.', url).href, true), memory: owner.allocator.memory };
    const input: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await boundedResponse(await fetch(url.href), limits.sourceBytes)));
    return { admitted: await admitProduct(input, { ...options, reserve }), options };
  }).then(lease => ({ ...lease.value, release: lease.release }));
}

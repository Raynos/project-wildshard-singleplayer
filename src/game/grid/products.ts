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
import { GridPostCosts } from './postPairs';
import { postStackCost } from '../shardfile/postStack';
import type { ResidencyAllocator } from './allocator';

/** One admitted product and the options its assets resolve against (ClientAssets reads further tiles through them). */
export interface GridProduct { readonly admitted: AdmittedProduct; readonly options: ProductOptions; release: () => void }
/** One page allocator owns its product cache; consumers release only after their source/transport references are gone. */
export interface GridProductOwner { allocator: ResidencyAllocator; scope: { readonly disposed: boolean; onDispose: (dispose: () => void) => void } }

const products = new WeakMap<ResidencyAllocator, ProductLeases<Omit<GridProduct, 'release'>>>();
const postCosts = new WeakMap<ResidencyAllocator, GridPostCosts>();
/** The page's admitted post stack costs (SF59): every product admitted on `allocator` records its own (placement sums them per adjacent pair, `postPairs.ts`). */
export function gridPostCosts(allocator: ResidencyAllocator): GridPostCosts {
  let costs = postCosts.get(allocator);
  if (costs === undefined) { costs = new GridPostCosts(); postCosts.set(allocator, costs); }
  return costs;
}
/** The slug's admitted data or trusted hybrid declaration; runtime entry still requires a separate regional factory. */
export function gridShardfileProduct(slug: string, owner: GridProductOwner): Promise<GridProduct> | null {
  const manifest = findShard(slug), descriptor = manifest?.shardfile ?? manifest?.gridShardfile;
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
    const admitted = await admitProduct(input, { ...options, reserve });
    // admission already refused a stack past the budget on its own; the cost is what placement sums per adjacent pair
    gridPostCosts(owner.allocator).record(slug, postStackCost(admitted.source, (hash) => admitted.assets.get(hash)).cost);
    return { admitted, options };
  }).then(lease => ({ ...lease.value, release: lease.release }));
}

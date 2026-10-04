/**
 * The grid page's admitted first-party shardfile products (SHARD-PLATFORM SF18a / SF18b): one admission per slug, shared by
 * the live host's regional sims (`liveSession.ts`) and the neighbours' render tiles (`session.ts`). The six template copies
 * share one product's immutable bytes; a failed admission is forgotten so a later request retries.
 */
import { findShard } from '../shard/registry';
import { admitProduct, boundedResponse, type AdmittedProduct, type ProductOptions } from '../shardfile/product';
import { browserShardfileOptions } from '../shardfile/loader';

/** One admitted product and the options its assets resolve against (ClientAssets reads further tiles through them). */
export interface GridProduct { readonly admitted: AdmittedProduct; readonly options: ProductOptions }

const products = new Map<string, Promise<GridProduct>>();
/** The slug's admitted shardfile, or null when the shard is not a shardfile shard (it stays a far proxy until M3). */
export function gridShardfileProduct(slug: string): Promise<GridProduct> | null {
  const descriptor = findShard(slug)?.shardfile;
  if (descriptor === undefined) return null;
  let product = products.get(slug);
  if (product === undefined) {
    const url = new URL(descriptor, location.href), options = browserShardfileOptions(new URL('.', url).href, true);
    product = (async () => {
      const input: unknown = JSON.parse(new TextDecoder().decode(await boundedResponse(await fetch(url.href), 4_000_000)));
      return { admitted: await admitProduct(input, options), options };
    })();
    product.catch(() => { products.delete(slug); });
    products.set(slug, product);
  }
  return product;
}

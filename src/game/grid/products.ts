/**
 * The grid page's admitted first-party shardfile products (SHARD-PLATFORM SF18a / SF18b): one admission per slug, shared by
 * the live host's regional sims (`liveSession.ts`) and the neighbours' render tiles (`session.ts`). The six template copies
 * share one product's immutable bytes; a failed admission is forgotten so a later request retries.
 */
import { findShard } from '../shard/registry';
import { admitProduct, boundedResponse, readIndexBytes, type AdmittedProduct, type ProductOptions } from '../shardfile/product';
import { browserShardfileOptions } from '../shardfile/runtimeProduct';
import { SHARDFILE_ADMISSION_LIMITS as limits } from '@wildshard/format/admissionLimits';
import { ProductLeases } from './productLeases';
import { GridPostCosts } from './postPairs';
import { postStackCost } from '@wildshard/format/postStack';
import type { ResidencyAllocator } from './allocator';
import { neighbourProductFiles } from '../shardfile/productCost';
import { parseOutputIndex } from '@wildshard/format/outputIndex';
import type { Shardfile } from '@wildshard/format/shardSchema';
import { EdgeProfilesSchema } from '@wildshard/format/edgeProfiles';
import { EntrywaysSchema } from '@wildshard/format/entryways';
import * as v from 'valibot';
import { declareDownloadFile } from '@wildshard/engine/boot/bytes';

const edgeRows = v.strictObject({ edge: EdgeProfilesSchema, entryways: EntrywaysSchema });
const edges = new WeakMap<ResidencyAllocator, Map<string, Promise<Pick<Shardfile, 'edge' | 'entryways'>>>>();

/** Read only the bounded index and its hash-verified world/edge section. This does not admit a runtime or asset. */
export async function readGridProductEdges(url: string, identity: string, options: ProductOptions): Promise<Pick<Shardfile, 'edge' | 'entryways'>> {
  const index = parseOutputIndex(await readIndexBytes(await boundedResponse(await options.fetch(url), limits.sourceBytes), options));
  const { slug: declaredIdentity } = index.identity;
  if (declaredIdentity !== identity.replace(/^_/u, '')) throw new Error('Grid edge index identity differs from its cell');
  const section = index.sections.find(row => row.name === 'world/edge');
  if (section === undefined) throw new Error('Grid edge index lacks world/edge');
  declareDownloadFile(new URL(section.path, url).href, section.bytes);
  const bytes = await boundedResponse(await options.fetch(new URL(section.path, url).href), section.bytes);
  if (bytes.length !== section.bytes || await options.hash(bytes) !== section.hash) throw new Error('Grid edge section hash or size mismatch');
  return v.parse(edgeRows, JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
}

/** Equal catalogue copies share edge metadata; full product admission stays on the ordinary approach path. */
export function gridShardfileEdges(slug: string, owner: GridProductOwner): Promise<Pick<Shardfile, 'edge' | 'entryways'>> | null {
  const manifest = findShard(slug), descriptor = manifest?.shardfile ?? manifest?.gridShardfile;
  if (descriptor === undefined) return null;
  if (owner.scope.disposed) return Promise.reject(new Error('Grid edge page disposed'));
  let cache = edges.get(owner.allocator);
  if (cache === undefined) {
    cache = new Map(); edges.set(owner.allocator, cache);
    owner.scope.onDispose(() => { edges.delete(owner.allocator); });
  }
  const previous = cache.get(slug); if (previous !== undefined) return previous;
  const url = new URL(descriptor, location.href), pending = readGridProductEdges(url.href, slug, browserShardfileOptions(new URL('.', url).href, true));
  cache.set(slug, pending);
  const held = cache;
  void pending.catch(() => { if (held.get(slug) === pending) held.delete(slug); });
  return pending;
}

/** One admitted product and the options its assets resolve against (ClientAssets reads further tiles through them). */
export interface GridProduct { readonly admitted: AdmittedProduct; readonly options: ProductOptions; release: () => void }
/** One page allocator owns its product cache; consumers release only after their source/transport references are gone. */
export interface GridProductOwner { allocator: ResidencyAllocator; scope: { readonly disposed: boolean; onDispose: (dispose: () => void) => void } }

const products = new WeakMap<ResidencyAllocator, ProductLeases<Omit<GridProduct, 'release'>>>();
const postCosts = new WeakMap<ResidencyAllocator, GridPostCosts>();

// Track each wire once even when concurrent runtime decoders release the same file later.
function accountTransportRelease(admitted: AdmittedProduct, releaseBytes: (bytes: number) => void): void {
  const release = admitted.releaseTransport;
  if (release === undefined) return;
  const charged = new Map(admitted.source.files.map(file => [file.hash, file.compressed]));
  admitted.releaseTransport = async (refs, reread) => {
    const released = await release(refs, reread); let bytes = 0;
    for (const ref of released) { bytes += charged.get(ref) ?? 0; charged.delete(ref); }
    releaseBytes(bytes); return released;
  };
}
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
  return cache.acquire(slug, async (reserve, releaseBytes) => {
    const url = new URL(descriptor, location.href), options = { ...browserShardfileOptions(new URL('.', url).href, true), memory: owner.allocator.memory };
    const input = await readIndexBytes(await boundedResponse(await options.fetch(url.href), limits.sourceBytes), options);
    const admitted = await admitProduct(input, { ...options, reserve });
    // admission already refused a stack past the budget on its own; the cost is what placement sums per adjacent pair
    gridPostCosts(owner.allocator).record(slug, postStackCost(admitted.source, (hash) => admitted.assets.get(hash)).cost);
    accountTransportRelease(admitted, releaseBytes);
    // Drop runtime-only wires before neighbours can copy their map. Entered product.file() reads the
    // same immutable bytes from cache or network; host-declared materials/skins/sim inputs stay available.
    const refs = neighbourProductFiles(admitted.source), unpin = options.cache?.pin?.(refs);
    try { await admitted.releaseTransport?.(refs, 'cache-or-fetch'); }
    finally { unpin?.(); }
    return { admitted, options };
  }).then(lease => ({ ...lease.value, release: lease.release }));
}

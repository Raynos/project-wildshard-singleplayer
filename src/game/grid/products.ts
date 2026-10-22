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
import { neighbourProductFilesPaced } from '../shardfile/productCost';
import { outputBlobPath, parseOutputIndex, type OutputIndex } from '@wildshard/format/outputIndex';
import { FarSchema, ShardReferenceSchema } from '@wildshard/format/shardSections';
import type { ShardfileFarRows } from './shardfileFar';
import type { Shardfile } from '@wildshard/format/shardSchema';
import { EdgeProfilesSchema } from '@wildshard/format/edgeProfiles';
import { EntrywaysSchema } from '@wildshard/format/entryways';
import * as v from 'valibot';
import { declareDownloadFile, recordCachedDownload } from '@wildshard/engine/boot/download';
import { GridAdmissionPriority } from './admissionPriority';
import { timeClientPreparation } from '../shardfile/preparationTiming';

const edgeRows = v.strictObject({ edge: EdgeProfilesSchema, entryways: EntrywaysSchema });
const farRow = v.looseObject({ far: v.nullable(v.looseObject({ decoded: v.number(), gpu: v.number() })) });
const farRows = { tiles: v.looseObject({ far: FarSchema }), props: v.looseObject({ props: v.nullable(v.looseObject({ far: v.nullable(ShardReferenceSchema) })) }),
  look: v.looseObject({ look: v.looseObject({ keys: v.array(v.looseObject({ fog: v.looseObject({ colour: v.tuple([v.number(), v.number(), v.number()]) }) })) }) }),
  collision: v.looseObject({ meshCollision: v.unknown() }) };
const edges = new WeakMap<ResidencyAllocator, Map<string, Promise<Pick<Shardfile, 'edge' | 'entryways'>>>>();

/** A product's bounded index, read once for several section or file reads (no runtime or asset is admitted). */
interface GridProductIndex { readonly index: OutputIndex; readonly url: string; readonly options: ProductOptions }
async function readGridProductIndex(url: string, identity: string, options: ProductOptions): Promise<GridProductIndex> {
  const index = parseOutputIndex(await readIndexBytes(await boundedResponse(await options.fetch(url), limits.sourceBytes), options));
  const { slug: declaredIdentity } = index.identity;
  if (declaredIdentity !== identity.replace(/^_/u, '')) throw new Error('Grid product index identity differs from its cell');
  return { index, url, options };
}
/** One immutable file the index declares (a section or a blob), from the content cache or the product URL, size and hash
 * checked; a network read is kept in the content cache like an admission's. */
async function readGridProductFile(at: GridProductIndex, path: string, hash: string, size: number): Promise<Uint8Array> {
  const { options } = at, base = new URL('.', at.url).href, address = new URL(path, at.url).href;
  declareDownloadFile(address, size);
  const held = await options.cache?.asset(base, hash) ?? await options.cachedResponse?.(address, hash, size);
  const bytes = held ?? await boundedResponse(await options.fetch(address), size);
  if (bytes.length !== size || await options.hash(bytes) !== hash) throw new Error(`Grid product file ${path} hash or size mismatch`);
  if (held !== null && held !== undefined) recordCachedDownload(hash, bytes.length, address);
  else await options.cache?.putAsset(base, hash, bytes);
  return bytes;
}
/** One hash-verified section of the index, parsed (null when the index has none). */
async function readGridSection(at: GridProductIndex, name: string): Promise<unknown> {
  const section = at.index.sections.find(row => row.name === name);
  if (section === undefined) return null;
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await readGridProductFile(at, section.path, section.hash, section.bytes)));
}
/** One hash-verified section of a product's bounded index (null when the index has none). No runtime or asset is admitted. */
async function readGridProductSection(url: string, identity: string, name: string, options: ProductOptions): Promise<unknown> {
  return readGridSection(await readGridProductIndex(url, identity, options), name);
}
/** Read only the bounded index and its hash-verified world/edge section. This does not admit a runtime or asset. */
export async function readGridProductEdges(url: string, identity: string, options: ProductOptions): Promise<Pick<Shardfile, 'edge' | 'entryways'>> {
  const rows = await readGridProductSection(url, identity, 'world/edge', options);
  if (rows === null) throw new Error('Grid edge index lacks world/edge');
  return v.parse(edgeRows, rows);
}
/**
 * The far proxy's declared resident bytes (decoded + GPU, what `loadShardfileFar` charges once it loads) from the index and
 * its world/tiles section: the far ring charges these before the proxy arrives instead of the 1.6 MB cap, so a visible
 * cell is never left out of the ring for placeholder charges (null: no far row). No admission, no claim.
 */
export function gridShardfileFarBytes(slug: string): Promise<number | null> | null {
  const descriptor = findShard(slug)?.shardfile;
  if (descriptor === undefined) return null;
  const url = new URL(descriptor, location.href);
  return readGridProductSection(url.href, slug, 'world/tiles', browserShardfileOptions(new URL('.', url).href, true))
    .then(rows => { if (rows === null) return null; const { far } = v.parse(farRow, rows); return far === null ? null : far.decoded + far.gpu; });
}

/**
 * O26: a shardfile cell's far proxy straight from its product: the index, its world/tiles (the far row), world/props (the far
 * GLB), look/look (the haze colour) and world/collision sections, and the far files, each hash-verified, without admitting
 * the whole product first (its admission, ~8-20 s a product at 4x CPU, held every shardfile neighbour's far proxy and so the
 * grid reveal's ringsReady). No residency claim: the far ring's own lease charges the proxy. Null when the slug has no
 * shardfile or no mesh-collision world (its far proxy is the baked folder's).
 */
export function readGridShardfileFar(slug: string): Promise<GridShardfileFar | null> {
  const descriptor = findShard(slug)?.shardfile;
  if (descriptor === undefined) return Promise.resolve(null);
  const url = new URL(descriptor, location.href);
  return readGridProductFar(url.href, slug, browserShardfileOptions(new URL('.', url).href, true));
}
/** A shardfile far proxy's rows and a verified reader for its declared far files. */
export interface GridShardfileFar { readonly rows: ShardfileFarRows; readonly read: (ref: string) => Promise<Uint8Array> }
/** `readGridShardfileFar` for one product URL (null: no mesh-collision world, so its far proxy is the baked folder's). */
export async function readGridProductFar(url: string, identity: string, options: ProductOptions): Promise<GridShardfileFar | null> {
  const at = await readGridProductIndex(url, identity, options);
  const collision = await readGridSection(at, 'world/collision');
  if (collision === null || v.parse(farRows.collision, collision).meshCollision === null) return null;
  const [tiles, props, look] = await Promise.all([readGridSection(at, 'world/tiles'), readGridSection(at, 'world/props'), readGridSection(at, 'look/look')]);
  const fog = look === null ? null : v.parse(farRows.look, look).look.keys[0]?.fog.colour ?? null;
  const rows: ShardfileFarRows = { far: tiles === null ? null : v.parse(farRows.tiles, tiles).far, farRef: props === null ? null : v.parse(farRows.props, props).props?.far ?? null, fog };
  const read = (ref: string): Promise<Uint8Array> => {
    const hash = ref.replace(/^commons:/u, ''), commons = ref.startsWith('commons:');
    const file = at.index.files.find(row => row.hash === hash && (row.commons === true) === commons);
    if (file === undefined || rows.far?.files.includes(ref) !== true) return Promise.reject(new Error('Undeclared grid far file'));
    return readGridProductFile(at, outputBlobPath(file), hash, file.compressed);
  };
  return { rows, read };
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

const priorities = new WeakMap<ResidencyAllocator, GridAdmissionPriority>();
function admissionPriority(owner: GridProductOwner): GridAdmissionPriority {
  let priority = priorities.get(owner.allocator);
  if (priority === undefined) {
    priority = new GridAdmissionPriority(); priorities.set(owner.allocator, priority);
    const held = priority;
    owner.scope.onDispose(() => { held.dispose(); priorities.delete(owner.allocator); });
  }
  return priority;
}
/** Actual region preparation retains read priority over speculative products on the same page. */
export function prioritizeGridProduct(slug: string, owner: GridProductOwner): () => void {
  if (owner.scope.disposed) throw new Error('Grid product page disposed');
  return admissionPriority(owner).hold(slug);
}

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
    const url = new URL(descriptor, location.href), original = browserShardfileOptions(new URL('.', url).href, true);
    const priority = admissionPriority(owner), content = original.cache, present = content?.verifiedPresent, verified = content?.verifiedAsset;
    const options: ProductOptions = { ...original, memory: owner.allocator.memory,
      fetch: address => priority.read(slug, () => original.fetch(address)),
      ...(content === undefined ? {} : { cache: { ...content,
        product: base => priority.read(slug, () => content.product(base)),
        asset: (base, hash) => priority.read(slug, () => content.asset(base, hash)),
        ...(verified === undefined ? {} : { verifiedAsset: (hash: string) => priority.read(slug, () => verified(hash)) }),
        ...(present === undefined ? {} : { verifiedPresent: (hash: string, bytes: number) => priority.read(slug, () => present(hash, bytes)) }),
      } }),
    };
    const input = await readIndexBytes(await boundedResponse(await options.fetch(url.href), limits.sourceBytes), options);
    const admitted = await timeClientPreparation(slug, 'product.admission', () => admitProduct(input, { ...options, reserve }));
    // admission already refused a stack past the budget on its own; the cost is what placement sums per adjacent pair
    gridPostCosts(owner.allocator).record(slug, postStackCost(admitted.source, (hash) => admitted.assets.get(hash)).cost);
    accountTransportRelease(admitted, releaseBytes);
    // Drop runtime-only wires before neighbours can copy their map. Entered product.file() reads the
    // same immutable bytes from cache or network; host-declared materials/skins/sim inputs stay available.
    const refs = await neighbourProductFilesPaced(admitted.source, options.pause), unpin = options.cache?.pin?.(refs);
    try { await admitted.releaseTransport?.(refs, 'cache-or-fetch'); }
    finally { unpin?.(); }
    return { admitted, options };
  }).then(lease => ({ ...lease.value, release: lease.release }));
}

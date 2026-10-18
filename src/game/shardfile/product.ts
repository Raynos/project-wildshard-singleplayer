import { scriptAdmissionRows } from '@wildshard/format/scriptContract';
import type { TextureTranscodeSupport } from '@wildshard/format/contentBounds';
import { parseShardfile, type Shardfile } from '@wildshard/format/shardSchema';
import { builtValidationReceipt, readValidationReceipt, validationRevision, validationSourceBytes, type ValidationReceipt, assertStateCompatibility, parseStateLineage, preflightAssetGraph, type MemoryAdmission } from "@wildshard/format/product";
import { SHARDFILE_VERSION, shardfileRevision } from '@wildshard/format/version';
import { isOutputIndex } from '@wildshard/format/outputIndex';

import { acceptValidatedCost, preflightDeclaredCosts, validateShardfileAssets, deviceLibraryCost } from '@wildshard/format/assetAdmission';
import { ContentCache } from '@wildshard/engine/boot/contentCache';
import { ContentCacheWorker } from '@wildshard/engine/boot/contentCacheWorker';
import { preflightShardfile } from '@wildshard/format/preflight';

import { SHARDFILE_ADMISSION_LIMITS as limits } from '@wildshard/format/admissionLimits';
import { assertExternalShardSlug, externalShardInstance } from './identity';
import { runtimeBoundWorldFiles } from '../plugin/headless';
import { neighbourProductFiles, runtimeOnlyProductFiles, tierLibrarySource, urlImageLibrarySource } from './productCost';
import { carryOutputDescriptor, IncompleteOutputCacheError, isBuildValidatedOutput, outputBlobUrl, outputDescriptor, resolveOutputDescriptor } from './outputDescriptor';


const HASH = /^[a-f0-9]{64}$/u;
const MAX_FILE_BYTES = 25_000_000;
/** A complete visited product is published only after every immutable asset has passed admission. */
export interface CachedProduct { source: unknown; firstParty: boolean; validation?: ValidationReceipt }
/** Storage is injected so offline admission uses the same path in browsers and tests. */
export interface ProductCache {
  product: (key: string) => Promise<CachedProduct | null>;
  asset: (base: string, hash: string) => Promise<Uint8Array | null>;
  /** Trusted content-cache read that already checked SHA-256; absent keeps raw/legacy cache verification. */
  verifiedAsset?: (hash: string) => Promise<Uint8Array | null>;
  /** Checked durable presence without transferring a discarded asset to the page. */
  verifiedPresent?: (hash: string, bytes: number) => Promise<boolean>;
  putAsset: (base: string, hash: string, bytes: Uint8Array) => Promise<boolean> | Promise<void>;
  putProduct: (key: string, product: CachedProduct) => Promise<void>;
  pin?: (hashes: Iterable<string>) => () => void;
}
/** Actual admission work, before the ordinary world boot plan exists. Bytes include verified cache reads. */
export interface ProductProgress {
  phase: 'descriptor' | 'cache-read' | 'assets' | 'hash' | 'validation' | 'cache' | 'complete';
  detail: string; bytesRead: number; bytesTotal: number; filesDone: number; filesTotal: number;
}
/** Loading is explicit about connectivity and first-party provenance, never inferred from an author field. */
export interface ProductOptions {
  /** Trusted renderer tier; only typed host alternatives affect resident estimates. */
  tier?: 'phone' | 'desktop';
  /** Trusted probe-filtered device support; authored content cannot select its charge. */
  textures?: TextureTranscodeSupport;
  /** Optional catalogue SHA-256 of the exact format-2 index wire bytes. */
  descriptorHash?: string;
  base: string; cache?: ProductCache; offline: boolean; firstParty: boolean;
  fetch: (url: string) => Promise<Response>;
  hash: (bytes: Uint8Array) => Promise<string>;
  /** G216: trusted page Developer policy; authored data cannot provide it or bypass exact asset checks. */
  memory?: MemoryAdmission;
  /** Trusted residency owner reserves parsed source and immutable transport before any asset-cache read or owned copy. */
  reserve?: (source: Shardfile) => void;
  /** Trusted presentation observer; it does not participate in admission decisions. */
  progress?: (progress: ProductProgress) => void;
}
/** Admitted owned wire bytes; callers release this map when decoded resources take over. */
export interface AdmittedProduct {
  source: Shardfile; assets: ReadonlyMap<string, Uint8Array>; cached: boolean; instance?: string;
  /** Forget runtime-only/bound wires with durable rereads, or verified cache/network rereads for an online owner. */
  releaseTransport?: (refs: Iterable<string>, reread?: 'cache-or-fetch') => Promise<readonly string[]>;
}

// Construct outside admission's decoding context: the owner must not retain the temporary hash/transport maps.
function transportRelease(source: Shardfile, assets: Map<string, Uint8Array>, options: ProductOptions): NonNullable<AdmittedProduct['releaseTransport']> {
  const bound = new Set([...runtimeBoundWorldFiles(source), ...runtimeOnlyProductFiles(source), ...neighbourProductFiles(source)]), files = new Map(source.files.map(file => [file.hash, file]));
  const base = new URL('.', options.base).href, cache = options.cache, hash = options.hash;
  return async (refs, reread) => {
    const requested = [...new Set(refs)];
    for (const ref of requested) if (!files.has(ref) && !source.requires.commons.some(value => ref === `commons:${value}`)) throw new Error('Undeclared transport release');
    const released: string[] = [];
    // Online grid readers already verify cache misses fetched from the immutable product URL.
    // Do not pin the whole grid in the bounded disk cache; offline owners still require durable bytes.
    const canFetch = reread === 'cache-or-fetch' && !options.offline;
    if (cache === undefined && !canFetch) return released;
    for (const ref of requested) {
      if (!bound.has(ref)) continue;
      const file = files.get(ref);
      if (file === undefined) continue;
      if (canFetch) { released.push(ref); continue; }
      if (cache === undefined) continue;
      if (cache.verifiedPresent !== undefined) {
        if (await cache.verifiedPresent(ref, file.compressed)) released.push(ref);
        continue;
      }
      const verified = await cache.verifiedAsset?.(ref);
      const bytes = verified ?? await cache.asset(base, ref);
      if (bytes === null) continue;
      if (bytes.length !== file.compressed || ((verified === null || verified === undefined) && await hash(bytes) !== ref)) throw new Error('Released transport cache hash or size mismatch');
      released.push(ref);
    }
    for (const ref of released) assets.delete(ref);
    return released;
  };
}
function version(input: unknown): string {
  if (typeof input !== 'object' || input === null || !('version' in input)) throw new Error('Shardfile needs a format version');
  shardfileRevision(input.version);
  if (typeof input.version !== 'string') throw new Error('Shardfile needs a format version');
  return input.version;
}
/** Stream bounded wire bytes, including responses without a trustworthy Content-Length header. */
export async function boundedResponse(response: Response, maximum: number, read?: (bytes: number) => void): Promise<Uint8Array> {
  if (!response.ok || !Number.isSafeInteger(maximum) || maximum < 0 || maximum > MAX_FILE_BYTES) throw new Error('Unavailable or oversized shardfile asset');
  const length = response.headers.get('content-length');
  if (length !== null && (!/^[0-9]+$/u.test(length) || Number(length) > maximum)) throw new Error('Shardfile wire size exceeds cap');
  if (response.body === null) return new Uint8Array();
  const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const next = await reader.read(); if (next.done) break;
      size += next.value.length;
      if (size > maximum) throw new Error('Shardfile wire size exceeds cap');
      chunks.push(next.value);
      read?.(next.value.length);
    }
  } catch (error) { await reader.cancel().catch(() => undefined); throw error; }
  finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let at = 0;
  for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.length; }
  return bytes;
}
function resolveDescriptor(input: unknown, options: ProductOptions): Promise<unknown> {
  const base = new URL('.', options.base).href, cache = options.cache;
  return resolveOutputDescriptor(input, {
    offline: options.offline, hash: options.hash, firstParty: options.firstParty,
    read: async (path, cap) => boundedResponse(await options.fetch(new URL(path, base).href), cap),
    ...(cache === undefined ? {} : {
      cached: (hash: string) => cache.asset(base, hash),
      store: async (hash: string, bytes: Uint8Array) => await cache.putAsset(base, hash, bytes) !== false,
    }),
  });
}

/** Read a format-2 output, verifying the catalogue hash before any section fetch. */
export async function readProductDescriptor(options: ProductOptions): Promise<Shardfile> {
  const base = new URL('.', options.base).href;
  const visited = options.offline ? await options.cache?.product(base) : undefined;
  if (options.offline && (visited === null || visited === undefined || (options.firstParty && !visited.firstParty))) throw new Error('Shardfile has not been visited offline');
  let input: unknown = visited?.source;
  if (!options.offline) {
    const bytes = await boundedResponse(await options.fetch(new URL('shard.json', base).href), limits.sourceBytes);
    if (options.descriptorHash !== undefined && (!HASH.test(options.descriptorHash) || await options.hash(bytes) !== options.descriptorHash)) throw new Error('Shardfile descriptor hash mismatch');
    input = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  }
  if (!isOutputIndex(input)) throw new Error('Shardfile requires a format-2 output; rebuild it with wildshard build');
  return readProductInput(input, options);
}

/** Assemble an inline or already fetched descriptor through the same verified section reader. */
export async function readProductInput(input: unknown, options: ProductOptions): Promise<Shardfile> {
  const assembled = await resolveDescriptor(input, options);
  if (isBuildValidatedOutput(assembled)) return assembled;
  preflightShardfile(assembled);
  const source = parseShardfile(assembled);
  carryOutputDescriptor(assembled, source);
  return source;
}

/** SHA-256 over an owned ArrayBuffer, usable by WebKit without Node or SDK dependencies. */
export async function browserContentHash(bytes: Uint8Array): Promise<string> {
  const input = bytes.buffer instanceof ArrayBuffer && bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
    ? bytes.buffer : Uint8Array.from(bytes).buffer;
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', input));
  return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
/** Validate a visited format-2 product again, including cached Wasm. */
export async function admitProduct(input: unknown, options: ProductOptions): Promise<AdmittedProduct> {
  const base = new URL('.', options.base).href;
  options.progress?.({ phase: 'cache-read', detail: 'Checking visited product', bytesRead: 0, bytesTotal: 0, filesDone: 0, filesTotal: 0 });
  const visited = await options.cache?.product(base);
  if (visited !== null && visited !== undefined) preflightShardfile(visited);
  const cached = options.offline ? visited : null;
  if (cached !== null && cached !== undefined && !isOutputIndex(cached.source)) throw new Error('Cached shardfile requires a format-2 rebuild');
  const raw = await resolveDescriptor(cached?.source ?? input, options);
  if (!isBuildValidatedOutput(raw)) preflightShardfile(raw);
  if (version(raw) !== SHARDFILE_VERSION) throw new Error('Shardfile needs the current format');
  const source = options.firstParty && isBuildValidatedOutput(raw) ? raw : parseShardfile(raw), assets = new Map<string, Uint8Array>(), hashes = new Map<Uint8Array, string>();
  carryOutputDescriptor(raw, source);
  if (!options.firstParty) assertExternalShardSlug(source.identity.slug);
  preflightAssetGraph(source);
  const revisionKey = validationRevision();
  const sourceHash = revisionKey === null ? '' : await options.hash(validationSourceBytes(source));
  const built = outputDescriptor(source)?.receipt;
  if (built !== undefined && sourceHash !== built.sourceHash) throw new Error('Built shardfile changed after verification');
  // A build receipt is pinned inside this client, never fetched from data.
  const receipt = revisionKey !== null
    ? readValidationReceipt(visited?.validation, sourceHash) ?? (options.firstParty ? builtValidationReceipt(sourceHash) : null) : null;
  const worst = receipt?.worst ?? preflightDeclaredCosts(source, options.memory).worst;
  if (receipt !== null) acceptValidatedCost(source, worst, options.memory);
  if (source.runtime !== null && !options.firstParty) throw new Error('Custom runtime requires a trusted first-party shard');
  if (!options.offline && visited !== null && visited !== undefined && isOutputIndex(visited.source) && version(visited.source) === SHARDFILE_VERSION) {
    let previous: unknown;
    try { previous = await resolveDescriptor(visited.source, { ...options, offline: true }); }
    catch (error) {
      // An old index can outlive its immutable sections. It is no longer an admitted offline copy;
      // the online descriptor above must complete admission and replace it, just like a first visit.
      if (!(error instanceof IncompleteOutputCacheError)) throw error;
    }
    if (previous !== undefined) assertStateCompatibility(parseStateLineage(previous), source);
  }
  options.reserve?.(source);
  const refs = [...source.files.map((file) => ({ ref: file.hash, cap: file.compressed })), ...source.requires.commons.map((hash) => ({ ref: `commons:${hash}`, cap: source.requires.commonsWire[hash] ?? 0 }))];
  // Reserve the complete product first, then overlap at most four immutable transports. Validation and
  // publication retain authored order; a failed wave settles fully before admission returns or writes cache.
  const unique = new Map<string, number>();
  for (const { ref, cap } of refs) {
    const hash = ref.replace(/^commons:/u, ''); if (!HASH.test(hash)) throw new Error('Invalid asset address');
    const previous = unique.get(hash);
    if (previous !== undefined && previous !== cap) throw new Error('Conflicting asset wire declarations');
    unique.set(hash, cap);
  }
  const transport = new Map<string, Uint8Array>(), addresses = [...unique];
  const verifiedCached = new Set<string>();
  let bytesRead = 0, filesDone = 0;
  const bytesTotal = addresses.reduce((total, [, cap]) => total + cap, 0);
  const progress = (phase: ProductProgress['phase'], detail: string): void => {
    options.progress?.({ phase, detail, bytesRead, bytesTotal, filesDone, filesTotal: addresses.length });
  };
  progress('assets', 'Reading immutable assets');
  const load = async ([hash, cap]: [string, number]): Promise<Uint8Array> => {
    let bytes = await options.cache?.asset(base, hash);
    const fromCache = bytes !== null && bytes !== undefined;
    if (bytes === null || bytes === undefined) {
      if (options.offline) throw new Error('Visited shardfile has an incomplete offline cache');
      progress('assets', `Fetching ${hash.slice(0, 12)}`);
      bytes = await boundedResponse(await options.fetch(outputBlobUrl(source, source.files.some(file => file.hash === hash) ? hash : `commons:${hash}`, base)), cap, (size) => { bytesRead += size; progress('assets', `Reading ${hash.slice(0, 12)}`); });
    } else { bytesRead += bytes.length; progress('assets', `Cached ${hash.slice(0, 12)}`); }
    if (bytes.length !== cap) throw new Error('Shardfile asset wire size differs from declaration');
    progress('hash', `Verifying ${hash.slice(0, 12)}`);
    const owned = Uint8Array.from(bytes), actual = await options.hash(owned);
    if (actual !== hash) throw new Error('Shardfile asset hash mismatch');
    if (fromCache) verifiedCached.add(hash);
    filesDone++; progress('assets', `Verified ${filesDone} / ${addresses.length} files`);
    return owned;
  };
  for (let at = 0; at < addresses.length; at += 4) {
    const wave = addresses.slice(at, at + 4), results = await Promise.allSettled(wave.map(load));
    for (const [index, result] of results.entries()) {
      if (result.status === 'rejected') throw result.reason;
      const address = wave[index]; if (address === undefined) throw new Error('Missing asset address');
      transport.set(address[0], result.value); hashes.set(result.value, address[0]);
    }
  }
  for (const { ref } of refs) {
    const bytes = transport.get(ref.replace(/^commons:/u, ''));
    if (bytes === undefined) throw new Error('Asset was not admitted');
    assets.set(ref, bytes);
  }
  progress('validation', receipt === null ? 'Validating assets, simulation and entries' : 'Verified exact product validation receipt');
  if (receipt === null) validateShardfileAssets(source, assets, (bytes) => {
    const hash = hashes.get(bytes); if (hash === undefined) throw new Error('Asset was not hashed'); return hash;
  }, options.memory, options.textures, scriptAdmissionRows(outputDescriptor(source)?.sections));
  if (receipt !== null && options.textures !== undefined) acceptValidatedCost(source,
    deviceLibraryCost(urlImageLibrarySource(options.tier === undefined ? source : tierLibrarySource(source, options.tier), assets), assets, options.textures), options.memory);
  if (!options.offline && options.cache !== undefined) {
    progress('cache', 'Saving verified offline assets');
    const cache = options.cache, descriptor = outputDescriptor(source);
    const release = cache.pin?.([...assets.keys()].map((ref) => ref.replace(/^commons:/u, '')).concat(descriptor?.index.sections.map(section => section.hash) ?? []));
    try {
      let complete = descriptor?.cached ?? true;
      for (const [ref, bytes] of assets) {
        const hash = ref.replace(/^commons:/u, '');
        if (verifiedCached.has(hash)) continue; // Exact cached bytes were already admitted; avoid rewriting the same immutable file.
        progress('cache', `Saving ${ref.slice(0, 12)}`); if (await cache.putAsset(base, hash, bytes) === false) complete = false;
      }
      const present = async (hash: string, bytes: number): Promise<boolean> => cache.verifiedPresent === undefined
        ? await cache.asset(base, hash) !== null : cache.verifiedPresent(hash, bytes);
      for (const [ref, bytes] of assets) {
        const hash = ref.replace(/^commons:/u, ''); progress('cache', `Checking saved ${ref.slice(0, 12)}`);
        if (await present(hash, bytes.length)) continue;
        // Another owner/browser may have evicted a previously verified hit before this publication pin.
        // Repair that miss, then recheck durable presence just as for a newly fetched file.
        if (!verifiedCached.has(hash) || await cache.putAsset(base, hash, bytes) === false || !await present(hash, bytes.length)) complete = false;
      }
      for (const section of descriptor?.index.sections ?? []) if (!await present(section.hash, section.bytes)) complete = false;
      if (complete && descriptor !== undefined) await cache.putProduct(base, { source: descriptor.index, firstParty: options.firstParty,
        ...(revisionKey === null ? {} : { validation: { revision: revisionKey, sourceHash, indexHash: descriptor.indexHash, worst } }) });
    } finally { release?.(); }
  }
  progress('complete', 'Product admitted');
  return { source, assets, cached: cached !== null && cached !== undefined, ...(options.firstParty ? { releaseTransport: transportRelease(source, assets, options) } : {}), ...(options.firstParty ? {} : { instance: await externalShardInstance(base, source.identity.slug, options.hash) }) };
}
const browserContentStores = new WeakMap<Pick<CacheStorage, 'open'>, ContentCache | ContentCacheWorker>();
const retiredProductStores = new WeakSet();
async function retireDescriptorCache(storage: Partial<Pick<CacheStorage, 'delete'>>): Promise<void> {
  try { await storage.delete?.('ws-shardfile-products-v0'); }
  catch (error) { console.warn('[shardfile] old descriptor cache eviction failed', error); }
}

/** Browser Cache Storage retains exact hash bytes separately from the last completely admitted visited product. */
export function browserProductCache(storage: Pick<CacheStorage, 'open'> & Partial<Pick<CacheStorage, 'delete'>>): ProductCache {
  if (!retiredProductStores.has(storage)) {
    retiredProductStores.add(storage);
    void retireDescriptorCache(storage);
  }
  const open = () => storage.open('ws-shardfile-products-v2');
  const productUrl = (base: string) => new URL('__visited_shardfile__', base).href;
  let content = browserContentStores.get(storage);
  if (content === undefined) {
    const fallback = new ContentCache({ storage, origin: location.origin, hash: browserContentHash, estimate: () => navigator.storage.estimate(), pagehide: window });
    // Injected stores keep their exact ports; only the real page CacheStorage
    // belongs to the worker. All product wrappers share one writer/fallback.
    content = typeof caches !== 'undefined' && storage === caches && typeof CacheStorage !== 'undefined' && storage instanceof CacheStorage && typeof Worker !== 'undefined'
      ? new ContentCacheWorker(fallback, { pagehide: window }) : fallback;
    browserContentStores.set(storage, content);
  }
  const ownedContent = content;
  return {
    product: async (base) => {
      const response = await (await open()).match(productUrl(base)); if (response === undefined) return null;
      const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await boundedResponse(response, limits.sourceBytes)));
      preflightShardfile(value);
      if (typeof value !== 'object' || value === null || !('source' in value) || !('firstParty' in value) || typeof value.firstParty !== 'boolean') throw new Error('Invalid visited shardfile cache');
      const rawValidation = 'validation' in value ? value.validation : undefined;
      const validation = typeof rawValidation === 'object' && rawValidation !== null && 'sourceHash' in rawValidation && typeof rawValidation.sourceHash === 'string' ? readValidationReceipt(rawValidation, rawValidation.sourceHash) : null;
      return { source: value.source, firstParty: value.firstParty, ...(validation === null ? {} : { validation }) };
    },
    asset: (_base, hash) => ownedContent.get(hash),
    verifiedAsset: hash => ownedContent.get(hash),
    ...(ownedContent instanceof ContentCacheWorker ? { verifiedPresent: (hash: string, bytes: number) => ownedContent.has(hash, bytes) } : {}),
    putAsset: (_base, hash, bytes) => ownedContent.put(hash, bytes), pin: (hashes) => ownedContent.pin(hashes),
    putProduct: async (base, product) => { await (await open()).put(productUrl(base), Response.json(product)); },
  };
}

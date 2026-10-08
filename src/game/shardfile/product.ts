import { parseShardfile, type Shardfile } from './schema';
import { SHARDFILE_VERSION, SHARDFILE_PREVIOUS_VERSION, shardfileRevision } from './version';
import { assertStateCompatibility, parseStateLineage } from './revision';
import { preflightDeclaredCosts, validateShardfileAssets } from './validate';
import { ContentCache } from '@wildshard/engine/boot/contentCache';
import { preflightShardfile } from './preflight';
import { preflightAssetGraph } from './assetGraph';
import { SHARDFILE_ADMISSION_LIMITS as limits } from './admissionLimits';
import { assertExternalShardSlug, externalShardInstance } from './identity';
import type { MemoryAdmission } from '../grid/memoryAdmission';

const HASH = /^[a-f0-9]{64}$/u;
const MAX_FILE_BYTES = 25_000_000;
/** A complete visited product is published only after every immutable asset has passed admission. */
export interface CachedProduct { source: unknown; firstParty: boolean }
/** Storage is injected so offline admission uses the same path in browsers and tests. */
export interface ProductCache {
  product: (key: string) => Promise<CachedProduct | null>;
  asset: (base: string, hash: string) => Promise<Uint8Array | null>;
  putAsset: (base: string, hash: string, bytes: Uint8Array) => Promise<boolean> | Promise<void>;
  putProduct: (key: string, product: CachedProduct) => Promise<void>;
  pin?: (hashes: Iterable<string>) => () => void;
}
/** Version readers are trusted client migrations; content cannot register its own compatibility rule. */
export interface ProductVersions { current: string; previous?: string | 0; readers: ReadonlyMap<string | 0, (source: unknown) => Shardfile> }
/** Actual admission work, before the ordinary world boot plan exists. Bytes include verified cache reads. */
export interface ProductProgress {
  phase: 'descriptor' | 'cache-read' | 'assets' | 'hash' | 'validation' | 'cache' | 'complete';
  detail: string; bytesRead: number; bytesTotal: number; filesDone: number; filesTotal: number;
}
/** Loading is explicit about connectivity and first-party provenance, never inferred from an author field. */
export interface ProductOptions {
  base: string; cache?: ProductCache; offline: boolean; firstParty: boolean;
  fetch: (url: string) => Promise<Response>;
  hash: (bytes: Uint8Array) => Promise<string>;
  versions?: ProductVersions;
  /** G216: trusted page Developer policy; authored data cannot provide it or bypass exact asset checks. */
  memory?: MemoryAdmission;
  /** Trusted residency owner reserves parsed source and immutable transport before any asset-cache read or owned copy. */
  reserve?: (source: Shardfile) => void;
  /** Trusted presentation observer; it does not participate in admission decisions. */
  progress?: (progress: ProductProgress) => void;
}
/** Admitted owned wire bytes; callers release this map when decoded resources take over. */
export interface AdmittedProduct { source: Shardfile; assets: ReadonlyMap<string, Uint8Array>; cached: boolean; instance?: string }
function version(input: unknown): string | 0 {
  if (typeof input !== 'object' || input === null || !('version' in input)) throw new Error('Shardfile needs a format version');
  if (input.version === 0) return 0;
  shardfileRevision(input.version);
  if (typeof input.version !== 'string') throw new Error('Shardfile needs a format version');
  return input.version;
}
function readLegacyCache(input: unknown): Shardfile {
  preflightShardfile(input);
  if (typeof input !== 'object' || input === null || !('version' in input) || input.version !== 0 || !('requires' in input) || typeof input.requires !== 'object' || input.requires === null || !('sdk' in input.requires) || input.requires.sdk !== 0) throw new Error('Invalid legacy shardfile cache');
  return parseShardfile({ ...input, version: SHARDFILE_VERSION, requires: { ...input.requires, sdk: SHARDFILE_VERSION } });
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
/** SHA-256 over an owned ArrayBuffer, usable by WebKit without Node or SDK dependencies. */
export async function browserContentHash(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes)));
  return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
/** Validate a visited cached product again, including cached Wasm; previous versions require offline first-party provenance. */
export async function admitProduct(input: unknown, options: ProductOptions): Promise<AdmittedProduct> {
  const base = new URL('.', options.base).href;
  options.progress?.({ phase: 'cache-read', detail: 'Checking visited product', bytesRead: 0, bytesTotal: 0, filesDone: 0, filesTotal: 0 });
  const visited = await options.cache?.product(base);
  if (visited !== null && visited !== undefined) preflightShardfile(visited);
  const cached = options.offline ? visited : null;
  const raw = cached?.source ?? input;
  preflightShardfile(raw);
  const versions: ProductVersions = options.versions ?? { current: SHARDFILE_VERSION, previous: SHARDFILE_PREVIOUS_VERSION,
    readers: new Map<string | 0, (source: unknown) => Shardfile>([[SHARDFILE_VERSION, parseShardfile], [SHARDFILE_PREVIOUS_VERSION, readLegacyCache]]) };
  const currentRevision = shardfileRevision(versions.current);
  const previousRevision = versions.previous === 0 ? 0 : versions.previous === undefined ? undefined : shardfileRevision(versions.previous);
  const revision = version(raw), reader = versions.readers.get(revision);
  if (reader === undefined || (revision !== versions.current && !(revision === versions.previous && previousRevision === currentRevision - 1 && options.offline && cached?.firstParty === true && options.firstParty))) throw new Error(`Shardfile version ${revision} needs a compatible client`);
  const source = reader(raw), assets = new Map<string, Uint8Array>(), hashes = new Map<Uint8Array, string>();
  if (!options.firstParty) assertExternalShardSlug(source.identity.slug);
  preflightAssetGraph(source);
  preflightDeclaredCosts(source, options.memory);
  if (source.runtime !== null && !options.firstParty) throw new Error('Custom runtime requires a trusted first-party shard');
  if (!options.offline && visited !== null && visited !== undefined && [versions.current, versions.previous].includes(version(visited.source))) assertStateCompatibility(parseStateLineage(visited.source), source);
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
      bytes = await boundedResponse(await options.fetch(new URL(hash, base).href), cap, (size) => { bytesRead += size; progress('assets', `Reading ${hash.slice(0, 12)}`); });
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
  progress('validation', 'Validating assets, simulation and entries');
  validateShardfileAssets(source, assets, (bytes) => {
    const hash = hashes.get(bytes); if (hash === undefined) throw new Error('Asset was not hashed'); return hash;
  }, options.memory);
  if (!options.offline && options.cache !== undefined) {
    progress('cache', 'Saving verified offline assets');
    const cache = options.cache, release = cache.pin?.([...assets.keys()].map((ref) => ref.replace(/^commons:/u, '')));
    try {
      let complete = true;
      for (const [ref, bytes] of assets) {
        const hash = ref.replace(/^commons:/u, '');
        if (verifiedCached.has(hash)) continue; // Exact cached bytes were already admitted; avoid rewriting the same immutable file.
        progress('cache', `Saving ${ref.slice(0, 12)}`); if (await cache.putAsset(base, hash, bytes) === false) complete = false;
      }
      for (const [ref, bytes] of assets) {
        const hash = ref.replace(/^commons:/u, ''); progress('cache', `Checking saved ${ref.slice(0, 12)}`);
        if (await cache.asset(base, hash) !== null) continue;
        // Another owner/browser may have evicted a previously verified hit before this publication pin.
        // Repair that miss, then recheck durable presence just as for a newly fetched file.
        if (!verifiedCached.has(hash) || await cache.putAsset(base, hash, bytes) === false || await cache.asset(base, hash) === null) complete = false;
      }
      if (complete) await cache.putProduct(base, { source: raw, firstParty: options.firstParty });
    } finally { release?.(); }
  }
  progress('complete', 'Product admitted');
  return { source, assets, cached: cached !== null && cached !== undefined, ...(options.firstParty ? {} : { instance: await externalShardInstance(base, source.identity.slug, options.hash) }) };
}
/** Browser Cache Storage retains exact hash bytes separately from the last completely admitted visited product. */
export function browserProductCache(storage: Pick<CacheStorage, 'open'>): ProductCache {
  const open = () => storage.open('ws-shardfile-products-v0');
  const productUrl = (base: string) => new URL('__visited_shardfile__', base).href;
  const content = new ContentCache({ storage, origin: location.origin, hash: browserContentHash, estimate: () => navigator.storage.estimate() });
  return {
    product: async (base) => {
      const response = await (await open()).match(productUrl(base)); if (response === undefined) return null;
      const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await boundedResponse(response, limits.sourceBytes)));
      preflightShardfile(value);
      if (typeof value !== 'object' || value === null || !('source' in value) || !('firstParty' in value) || typeof value.firstParty !== 'boolean') throw new Error('Invalid visited shardfile cache');
      return { source: value.source, firstParty: value.firstParty };
    },
    asset: async (base, hash) => {
      const bytes = await content.get(hash); if (bytes !== null) return bytes;
      const response = await (await open()).match(new URL(hash, base).href);
      return response === undefined ? null : boundedResponse(response, MAX_FILE_BYTES);
    },
    putAsset: (_base, hash, bytes) => content.put(hash, bytes), pin: (hashes) => content.pin(hashes),
    putProduct: async (base, product) => { await (await open()).put(productUrl(base), Response.json(product)); },
  };
}

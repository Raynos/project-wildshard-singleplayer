import { parseShardfile, type Shardfile } from './schema';
import { SHARDFILE_VERSION } from './version';
import { assertStateCompatibility } from './revision';
import { validateShardfileAssets } from './validate';

const HASH = /^[a-f0-9]{64}$/u;
const MAX_FILE_BYTES = 25_000_000;
/** A complete visited product is published only after every immutable asset has passed admission. */
export interface CachedProduct { source: unknown; firstParty: boolean }
/** Storage is injected so offline admission uses the same path in browsers and tests. */
export interface ProductCache {
  product: (key: string) => Promise<CachedProduct | null>;
  asset: (base: string, hash: string) => Promise<Uint8Array | null>;
  putAsset: (base: string, hash: string, bytes: Uint8Array) => Promise<void>;
  putProduct: (key: string, product: CachedProduct) => Promise<void>;
}
/** Version readers are trusted client migrations; content cannot register its own compatibility rule. */
export interface ProductVersions { current: number; readers: ReadonlyMap<number, (source: unknown) => Shardfile> }
/** Loading is explicit about connectivity and first-party provenance, never inferred from an author field. */
export interface ProductOptions {
  base: string; cache?: ProductCache; offline: boolean; firstParty: boolean;
  fetch: (url: string) => Promise<Response>;
  hash: (bytes: Uint8Array) => Promise<string>;
  versions?: ProductVersions;
}
/** Admitted owned wire bytes; callers release this map when decoded resources take over. */
export interface AdmittedProduct { source: Shardfile; assets: ReadonlyMap<string, Uint8Array>; cached: boolean }
function version(input: unknown): number {
  if (typeof input !== 'object' || input === null || !('version' in input) || typeof input.version !== 'number' || !Number.isSafeInteger(input.version)) throw new Error('Shardfile needs a format version');
  return input.version;
}
/** Stream bounded wire bytes, including responses without a trustworthy Content-Length header. */
export async function boundedResponse(response: Response, maximum: number): Promise<Uint8Array> {
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
  const visited = await options.cache?.product(base);
  const cached = options.offline ? visited : null;
  const raw = cached?.source ?? input;
  const versions = options.versions ?? { current: SHARDFILE_VERSION, readers: new Map([[SHARDFILE_VERSION, parseShardfile]]) };
  const revision = version(raw), reader = versions.readers.get(revision);
  if (reader === undefined || (revision !== versions.current && !(revision === versions.current - 1 && options.offline && cached?.firstParty === true && options.firstParty))) throw new Error(`Shardfile version ${revision} needs a compatible client`);
  const source = reader(raw), assets = new Map<string, Uint8Array>(), hashes = new Map<Uint8Array, string>();
  if (!options.offline && visited !== null && visited !== undefined && version(visited.source) === versions.current) assertStateCompatibility(reader(visited.source), source);
  const refs = [...source.files.map((file) => ({ ref: file.hash, cap: file.compressed })), ...source.requires.commons.map((hash) => ({ ref: `commons:${hash}`, cap: MAX_FILE_BYTES }))];
  for (const { ref, cap } of refs) {
    const hash = ref.replace(/^commons:/u, ''); if (!HASH.test(hash)) throw new Error('Invalid asset address');
    let bytes = await options.cache?.asset(base, hash);
    if (bytes === null || bytes === undefined) {
      if (options.offline) throw new Error('Visited shardfile has an incomplete offline cache');
      bytes = await boundedResponse(await options.fetch(new URL(hash, base).href), cap);
    }
    if (bytes.length > cap) throw new Error('Cached shardfile wire size exceeds cap');
    const owned = Uint8Array.from(bytes), actual = await options.hash(owned);
    if (actual !== hash) throw new Error('Shardfile asset hash mismatch');
    assets.set(ref, owned); hashes.set(owned, actual);
  }
  validateShardfileAssets(source, assets, (bytes) => {
    const hash = hashes.get(bytes); if (hash === undefined) throw new Error('Asset was not hashed'); return hash;
  });
  if (!options.offline && options.cache !== undefined) {
    for (const [ref, bytes] of assets) await options.cache.putAsset(base, ref.replace(/^commons:/u, ''), bytes);
    await options.cache.putProduct(base, { source: raw, firstParty: options.firstParty });
  }
  return { source, assets, cached: cached !== null && cached !== undefined };
}
/** Browser Cache Storage retains exact hash bytes separately from the last completely admitted visited product. */
export function browserProductCache(storage: Pick<CacheStorage, 'open'>): ProductCache {
  const open = () => storage.open('ws-shardfile-products-v0');
  const productUrl = (base: string) => new URL('__visited_shardfile__', base).href;
  return {
    product: async (base) => {
      const response = await (await open()).match(productUrl(base)); if (response === undefined) return null;
      const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await boundedResponse(response, 2_000_000)));
      if (typeof value !== 'object' || value === null || !('source' in value) || !('firstParty' in value) || typeof value.firstParty !== 'boolean') throw new Error('Invalid visited shardfile cache');
      return { source: value.source, firstParty: value.firstParty };
    },
    asset: async (base, hash) => {
      const response = await (await open()).match(new URL(hash, base).href);
      return response === undefined ? null : boundedResponse(response, MAX_FILE_BYTES);
    },
    putAsset: async (base, hash, bytes) => { await (await open()).put(new URL(hash, base).href, new Response(Uint8Array.from(bytes))); },
    putProduct: async (base, product) => { await (await open()).put(productUrl(base), Response.json(product)); },
  };
}

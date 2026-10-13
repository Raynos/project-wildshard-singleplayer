/** Actual browser product admission across a page reload, with durable CacheStorage. */
import { admitProduct, browserProductCache } from '../../src/game/shardfile/product';
import { parseShardfile } from '../../src/format/shardSchema';

declare const __LIBRARY_BASE__: string;

// Passive instrumentation is confined to this standalone oracle, never the floor.
const workerIO = { started: 0, replies: 0, errors: 0 };
const NativeWorker = Worker;
class ObservedWorker extends NativeWorker {
  constructor(url: string | URL, options?: WorkerOptions) {
    super(url, options);
    if (options?.name !== 'content-cache') return;
    workerIO.started++;
    this.addEventListener('message', () => { workerIO.replies++; });
    this.addEventListener('error', () => { workerIO.errors++; });
    this.addEventListener('messageerror', () => { workerIO.errors++; });
  }
}
Reflect.set(globalThis, 'Worker', ObservedWorker);

async function prove(): Promise<unknown> {
  const base = __LIBRARY_BASE__, source = parseShardfile(await (await fetch(new URL('shard.json', base))).json());
  const hashes = new Set(source.library), costs = new Map(source.files.map(file => [file.hash, file.compressed]));
  let libraryBytesFetched = 0, libraryFetches = 0;
  const start = performance.now();
  const admitted = await admitProduct(source, { base, cache: browserProductCache(caches), offline: false, firstParty: true,
    hash: async bytes => { const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes).buffer)); return Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join(''); },
    fetch: url => {
      const hash = new URL(url).pathname.split('/').at(-1);
      if (hash !== undefined && hashes.has(hash)) { libraryFetches++; libraryBytesFetched += costs.get(hash) ?? 0; }
      return fetch(url);
    },
  });
  const expected = [...hashes].reduce((sum, hash) => sum + (costs.get(hash) ?? 0), 0);
  const previous: unknown = JSON.parse(sessionStorage.getItem('library-cache-first') ?? 'null');
  const warm = previous !== null;
  const result = { warm, workerIO: { ...workerIO }, libraryBytesFetched, libraryFetches, expected, libraryFiles: hashes.size, durationMs: performance.now() - start,
    assetsPresent: [...hashes].every(hash => admitted.assets.has(hash)), pass: warm ? libraryBytesFetched === 0 && libraryFetches === 0 : libraryBytesFetched === expected && libraryFetches === hashes.size };
  if (!result.assetsPresent || !result.pass || workerIO.started !== 1 || workerIO.replies === 0 || workerIO.errors !== 0) throw new Error(JSON.stringify(result));
  if (!warm) sessionStorage.setItem('library-cache-first', JSON.stringify(result));
  return { ...result, previous };
}
try { Reflect.set(window, 'libraryCacheProof', await prove()); }
catch (error: unknown) { Reflect.set(window, 'libraryCacheProof', { pass: false, error: error instanceof Error ? error.message : String(error) }); }

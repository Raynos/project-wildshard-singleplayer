import {expect, test, vi} from 'vitest';
import * as v from 'valibot';
import {ContentCache} from '@wildshard/engine/boot/contentCache';
import {ContentCacheWorker} from '@wildshard/engine/boot/contentCacheWorker';
import {CacheCommandSchema, type CacheCommand, type CacheValue} from '../src/engine/boot/contentCacheProtocol';
import {emptyShardfile} from '../src/sdk/author';
import {hashImmutableBytes} from '../src/sdk/immutable';
import {parseOutputIndex} from '../src/format/outputIndex';
import {installTitleManifests, titleManifests, type TitleManifest} from '../src/game/shard/titleList';
import {browserContentStore} from '../src/game/shardfile/contentStore';
import {startGridPrefetch, gridPrefetchStatus} from '../src/game/grid/prefetch';

test('worker-only prefetch counts durable replies without returning file bodies', async () => {
  const body = new Uint8Array([7, 8, 9]), hash = hashImmutableBytes(body);
  const source = emptyShardfile({slug: 'worker-progress', name: 'Worker progress', author: 'Test', revision: 1, seed: 1});
  const index = parseOutputIndex({format: 'wildshard.shardfile', formatVersion: 2, sdk: '0.2', version: source.version,
    identity: source.identity, requires: source.requires, build: {sourceHash: '0'.repeat(64), validator: 'test'},
    admission: {budgets: source.budgets, serverBudget: source.serverBudget, authorCaps: source.authorCaps, critical: source.critical, library: source.library},
    sections: [], schemas: [], runtime: null, files: [{hash, kind: 'bin', path: `blobs/bin/${hash}.bin`,
      compressed: 3, decoded: 3, gpu: 0, triangles: 0, draws: 0, dependencies: [], critical: false}],
  });
  const disk = new Map<string, Response>(), replies: CacheValue[] = [];
  const urlOf = (input: RequestInfo | URL): string => input instanceof Request ? input.url : String(input);
  const cache: Cache = {
    add: () => Promise.reject(new Error('Unexpected unverified add')),
    addAll: () => Promise.reject(new Error('Unexpected unverified addAll')),
    matchAll: () => Promise.reject(new Error('Unexpected bulk match')),
    match: input => Promise.resolve(disk.get(urlOf(input))?.clone()),
    put: (input, response) => {disk.set(urlOf(input), response.clone()); return Promise.resolve();},
    delete: input => Promise.resolve(disk.delete(urlOf(input))),
    keys: () => Promise.resolve([...disk.keys()].map(url => new Request(url))),
  };
  class Storage {
    open(): Promise<Cache> {return Promise.resolve(cache);}
    delete(): Promise<boolean> {return Promise.resolve(true);}
  }
  const storage = new Storage();
  const workerStore = new ContentCache({storage, origin: 'http://localhost', hash: bytes => Promise.resolve(hashImmutableBytes(bytes))});
  class WorkerPort extends EventTarget {
    private closed = false;
    constructor(url: URL) {
      super();
      if (!url.pathname.endsWith('/contentCache.worker.ts')) throw new Error('No hash worker in this fixture');
    }
    postMessage(message: unknown): void {
      if (this.closed) throw new Error('Worker is terminated');
      void this.respond(v.parse(CacheCommandSchema, message));
    }
    private async respond(command: CacheCommand): Promise<void> {
      const perform = async (): Promise<CacheValue> => {
        switch (command.op) {
          case 'holds': return workerStore.holds(command.hash, command.bytes);
          case 'fetch': {
            expect(command.reply).toBe('stored'); expect(command.keep).toBe(true);
            const bytes = new Uint8Array(await (await fetch(command.url)).arrayBuffer());
            expect(bytes.length).toBe(command.bytes);
            return {fetched: null, stored: await workerStore.put(command.hash, bytes, true), cached: false,
              origin: performance.timeOrigin, timing: null};
          }
          case 'flush': await workerStore.flush(); return null;
          case 'get': case 'has': case 'pin': case 'put': case 'release': case 'stats': throw new Error('Unexpected worker command');
          default: throw new Error('Unknown worker command');
        }
      };
      try {
        const value = await perform(); replies.push(value);
        this.dispatchEvent(new MessageEvent('message', {data: {id: command.id, ok: true, value}}));
      } catch (error: unknown) {this.dispatchEvent(new MessageEvent('message', {data: {id: command.id, ok: false, error: String(error)}}));}
    }
    terminate(): void {this.closed = true;}
  }
  let previous: readonly TitleManifest[] = [];
  try {previous = titleManifests();} catch { /* Isolated metadata fixture. */ }
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('location', {href: 'http://localhost/', origin: 'http://localhost'});
  vi.stubGlobal('navigator', {onLine: true, storage: {persist: () => Promise.resolve(true), estimate: () => Promise.resolve({usage: 0, quota: 1024 ** 3})}});
  vi.stubGlobal('CacheStorage', Storage); vi.stubGlobal('caches', storage); vi.stubGlobal('Worker', WorkerPort);
  vi.stubEnv('DEV', false);
  vi.stubGlobal('__SHARDFILE_VERDICTS__', [{indexHash: hashImmutableBytes(new TextEncoder().encode(JSON.stringify(index)))}]);
  installTitleManifests([{slug: '_template', name: 'Test', biome: 'test', status: 'hidden', card: {thumb: '', portrait: '', landscape: ''},
    entries: {legacy: false, shardfile: true}, shardfile: 'http://localhost/product/index.json'}]);
  vi.stubGlobal('fetch', (input: RequestInfo | URL) => Promise.resolve(urlOf(input).endsWith('/index.json') ? Response.json(index) : new Response(body)));
  const store = browserContentStore(storage);
  try {
    expect(store).toBeInstanceOf(ContentCacheWorker);
    startGridPrefetch(['_template']);
    await vi.waitFor(() => {expect(gridPrefetchStatus()?.phase).toBe('done');});
    expect(gridPrefetchStatus()).toMatchObject({knownFiles: 1, knownBytes: 3, storedFiles: 1, storedBytes: 3, inFlightBytes: 0});
    expect(replies).toContainEqual({fetched: null, stored: true, cached: false, origin: performance.timeOrigin, timing: null});
    expect(await workerStore.get(hash)).toEqual(body);
  } finally {
    if (store instanceof ContentCacheWorker) await store.close();
    await workerStore.flush(); installTitleManifests(previous);
    vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs();
  }
});

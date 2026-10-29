import {afterEach, expect, test, vi} from 'vitest';
import {emptyShardfile} from '../src/sdk/author';
import {hashImmutableBytes} from '../src/sdk/immutable';
import {parseOutputIndex} from '../src/format/outputIndex';
import {installTitleManifests, titleManifests, type TitleManifest} from '../src/game/shard/titleList';
import {startGridPrefetch, startTitlePrefetch, gridPrefetchStatus} from '../src/game/grid/prefetch';

const initialStorage = globalThis.localStorage;
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.stubGlobal('localStorage', initialStorage); });

// iPhone downloads I5: the grid prefetch stores a pack's members from one read of the pack, never their own paths.
test.each(['play', 'title', 'title-stop'] as const)('%s packed members are stored from one verified read, including metered title prefetch', async mode => {
  const first = new Uint8Array([1, 2]), second = new Uint8Array([3]);
  const hashes = [hashImmutableBytes(first), hashImmutableBytes(second)];
  const packBytes = new Uint8Array([...first, ...second]), packHash = hashImmutableBytes(packBytes), packPath = `blobs/pack/${packHash}.pack`;
  const source = emptyShardfile({slug: 'prefetch-packs', name: 'Packs', author: 'Test', revision: 1, seed: 1});
  const index = parseOutputIndex({format: 'wildshard.shardfile', formatVersion: 2, sdk: '0.2', version: source.version,
    identity: source.identity, requires: source.requires, build: {sourceHash: '0'.repeat(64), validator: 'test'},
    admission: {budgets: source.budgets, serverBudget: source.serverBudget, authorCaps: source.authorCaps, critical: source.critical, library: source.library},
    sections: [], schemas: [], runtime: null, files: [first, second].map((bytes, i) => ({hash: hashes[i] ?? '', kind: 'bin', path: `blobs/bin/${hashes[i] ?? ''}.bin`,
      compressed: bytes.length, decoded: bytes.length, gpu: 0, triangles: 0, draws: 0, dependencies: [], critical: false})),
    packs: [{path: packPath, hash: packHash, bytes: 3, entries: [{hash: hashes[0] ?? '', offset: 0, bytes: 2}, {hash: hashes[1] ?? '', offset: 2, bytes: 1}]}],
  });
  vi.stubEnv('DEV', false);
  vi.stubGlobal('__SHARDFILE_VERDICTS__', [{indexHash: hashImmutableBytes(new TextEncoder().encode(JSON.stringify(index)))}]);
  const title: TitleManifest = {slug: '_template', name: '_template', biome: 'test', status: 'hidden',
    card: {thumb: '', portrait: '', landscape: ''}, entries: {legacy: false, shardfile: true}, shardfile: 'http://localhost/alpha/index.json'};
  let previous: readonly TitleManifest[] = [];
  try {previous = titleManifests();} catch { /* This isolated test need not install runnable worlds. */ }
  installTitleManifests([title]);
  const reads: string[] = [], disk = new Map<string, Response>();
  const urlOf = (input: RequestInfo | URL): string => input instanceof Request ? input.url : String(input);
  const cache: Cache = {
    add: () => Promise.reject(new Error('Unexpected unverified cache add')),
    addAll: () => Promise.reject(new Error('Unexpected unverified cache addAll')),
    matchAll: () => Promise.reject(new Error('Unexpected bulk cache read')),
    match: (input: RequestInfo | URL) => Promise.resolve(disk.get(urlOf(input))?.clone()),
    put: (input: RequestInfo | URL, response: Response): Promise<void> => {disk.set(urlOf(input), response.clone()); return Promise.resolve();},
    delete: (input: RequestInfo | URL) => Promise.resolve(disk.delete(urlOf(input))),
    keys: () => Promise.resolve([...disk.keys()].map(url => new Request(url))),
  };
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('location', {href: 'http://localhost/', origin: 'http://localhost'});
  vi.stubGlobal('navigator', {onLine: true, connection: {saveData: mode !== 'play'}, storage: {persist: () => Promise.resolve(true), estimate: () => Promise.resolve({usage: 0, quota: 1024 ** 3})}});
  vi.stubGlobal('caches', {open: () => Promise.resolve(cache), delete: () => Promise.resolve(true)});
  vi.stubGlobal('Worker', undefined);
  let aborted = false;
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = urlOf(input); reads.push(url);
    if (mode === 'title-stop' && url.endsWith('.pack')) return new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      if (signal === undefined || signal === null) { reject(new Error('Missing title abort signal')); return; }
      signal.addEventListener('abort', () => {aborted = true; reject(new DOMException('Title left', 'AbortError'));}, {once: true});
    });
    return Promise.resolve(url.endsWith('/index.json') ? Response.json(index) : url.endsWith('.pack') ? new Response(packBytes) : new Response(null, {status: 404}));
  });
  try {
    const titleRun = mode === 'play' ? null : startTitlePrefetch(['_template']);
    if (mode === 'play') startGridPrefetch(['_template']);
    else expect(titleRun).not.toBeNull();
    if (mode === 'title-stop') {
      await vi.waitFor(() => {expect(reads).toContain(`http://localhost/alpha/${packPath}`);});
      titleRun?.stop();
      await vi.waitFor(() => {expect(gridPrefetchStatus()).toMatchObject({phase: 'stopped', storedFiles: 0, storedBytes: 0, inFlightBytes: 0});});
      expect(aborted).toBe(true);
      expect(reads).toHaveLength(2);
      expect([...disk.keys()].filter(url => hashes.some(hash => url.endsWith(`/${hash}`)))).toEqual([]);
      return;
    }
    await vi.waitFor(() => {expect(gridPrefetchStatus()?.phase).toBe('done');});
    expect(reads).toEqual(['http://localhost/alpha/index.json', `http://localhost/alpha/${packPath}`]);
    expect(gridPrefetchStatus()).toMatchObject({knownFiles: 2, knownBytes: 3, storedFiles: 2, storedBytes: 3});
  } finally { installTitleManifests(previous); }
});

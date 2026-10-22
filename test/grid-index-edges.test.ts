import { expect, test, vi } from 'vitest';
import { emptyShardfile } from '@wildshard/sdk/author';
import { outputSectionPayloads } from '@wildshard/format/outputIndex';
import { encodeCanonicalJson, hashImmutableBytes } from '../src/sdk/immutable';
import { readGridProductEdges, readGridProductFar, readGridProductNear } from '../src/game/grid/products';

function fixture() {
  const source = emptyShardfile({ slug: 'edge-fixture', name: 'Edges', author: 'Test', revision: 1, seed: 9 });
  const encode = (value: unknown) => new TextEncoder().encode(encodeCanonicalJson(value));
  const payloads = outputSectionPayloads(source), url = 'https://game.test/shardfiles/edge-fixture/shard.json';
  const sectionBytes = new Map([...payloads].map(([name, value]) => [name, encode(value)]));
  const index = { format: 'wildshard.shardfile', formatVersion: 2, sdk: '0.2', version: source.version, identity: source.identity, requires: source.requires,
    build: { sourceHash: '0'.repeat(64), validator: 'test' }, admission: { budgets: source.budgets, serverBudget: source.serverBudget, authorCaps: source.authorCaps, critical: source.critical, library: source.library },
    sections: [...sectionBytes].map(([name, bytes]) => ({ name, path: `sections/${name}.json`, schema: `wildshard:${name}@1`, hash: hashImmutableBytes(bytes), bytes: bytes.length })), schemas: [], files: [], runtime: null };
  const edgeUrl = new URL('sections/world/edge.json', url).href;
  const edge = sectionBytes.get('world/edge'); if (edge === undefined) throw new Error('Missing test edges');
  const wires = new Map([[url, encode(index)], [edgeUrl, edge]]);
  const fetch = vi.fn((path: string): Promise<Response> => {
    const bytes = wires.get(path); if (bytes === undefined) return Promise.reject(new Error(`Full admission attempted: ${path}`));
    return Promise.resolve(new Response(Uint8Array.from(bytes)));
  });
  return { source, url, edgeUrl, wires, fetch, options: { base: new URL('.', url).href, offline: false, firstParty: false, fetch, hash: (bytes: Uint8Array) => Promise.resolve(hashImmutableBytes(bytes)) } };
}

test('grid edge preparation reads only the index and edge section, never the other product sections or assets', async () => {
  const f = fixture();
  expect(await readGridProductEdges(f.url, f.source.identity.slug, f.options)).toEqual({ edge: f.source.edge, entryways: f.source.entryways });
  expect(f.fetch.mock.calls.map(([url]) => url)).toEqual([f.url, f.edgeUrl]);
});

test('grid edge metadata keeps identity, byte count and immutable hash checks', async () => {
  const f = fixture();
  await expect(readGridProductEdges(f.url, 'other-cell', f.options)).rejects.toThrow('identity');
  expect(f.fetch).toHaveBeenCalledExactlyOnceWith(f.url);
  f.wires.set(f.edgeUrl, new TextEncoder().encode('{}'));
  await expect(readGridProductEdges(f.url, f.source.identity.slug, f.options)).rejects.toThrow('hash or size');
});

test('a newer first-party index still takes stale-client recovery before reading its edge section', async () => {
  const f = fixture(), stale = vi.fn(() => Promise.resolve());
  await expect(readGridProductEdges(f.url, f.source.identity.slug, { ...f.options, firstParty: true, built: { indexes: new Set(), stale } })).rejects.toThrow('older');
  expect(stale).toHaveBeenCalledOnce(); expect(f.fetch).toHaveBeenCalledExactlyOnceWith(f.url);
});

test('hidden catalogue names keep the authored product identity, like ordinary first-party entry', async () => {
  const f = fixture();
  expect(await readGridProductEdges(f.url, `_${f.source.identity.slug}`, f.options)).toEqual({ edge: f.source.edge, entryways: f.source.entryways });
  expect(f.fetch.mock.calls.map(([url]) => url)).toEqual([f.url, f.edgeUrl]);
});

test('warm edge sections use exact cached bytes without another network revalidation', async () => {
  const f = fixture(), bytes = f.wires.get(f.edgeUrl);
  if (bytes === undefined) throw new Error('Missing edge fixture');
  const cachedResponse = vi.fn(async (_url: string, _hash: string, _maximum: number) => {
    await Promise.resolve(); return bytes;
  });
  expect(await readGridProductEdges(f.url, f.source.identity.slug, { ...f.options, cachedResponse }))
    .toEqual({ edge: f.source.edge, entryways: f.source.entryways });
  expect(cachedResponse).toHaveBeenCalledExactlyOnceWith(f.edgeUrl, hashImmutableBytes(bytes), bytes.length);
  expect(f.fetch.mock.calls.map(([url]) => url)).toEqual([f.url]);
  await expect(readGridProductEdges(f.url, f.source.identity.slug, { ...f.options,
    cachedResponse: async () => { await Promise.resolve(); return new Uint8Array(bytes.length); } })).rejects.toThrow('hash or size');
});

test('O26: a world without mesh collision reads only the index and its collision section for its far proxy', async () => {
  const f = fixture(), collision = new URL('sections/world/collision.json', f.url).href;
  const payload = outputSectionPayloads(f.source).get('world/collision');
  if (payload === undefined) throw new Error('Missing collision fixture');
  f.wires.set(collision, new TextEncoder().encode(encodeCanonicalJson(payload)));
  expect(await readGridProductFar(f.url, f.source.identity.slug, f.options)).toBeNull();
  expect(f.fetch.mock.calls.map(([url]) => url)).toEqual([f.url, collision]);
});

test('G608: a product without near content reads only the index and its tiles section for its near view', async () => {
  const f = fixture(), tiles = new URL('sections/world/tiles.json', f.url).href, payload = outputSectionPayloads(f.source).get('world/tiles');
  if (payload === undefined) throw new Error('Missing tiles fixture');
  f.wires.set(tiles, new TextEncoder().encode(encodeCanonicalJson(payload)));
  expect(await readGridProductNear(f.url, f.source.identity.slug, f.options)).toBeNull();
  expect(f.fetch.mock.calls.map(([url]) => url)).toEqual([f.url, tiles]);
});

test('G608: a near view reads its index, tiles and look sections and only its declared near files, never the product', async () => {
  const glb = new Uint8Array([1, 2, 3, 4]), hash = hashImmutableBytes(glb), encode = (value: unknown) => new TextEncoder().encode(encodeCanonicalJson(value));
  const file = { hash, kind: 'glb' as const, compressed: 4, decoded: 4, gpu: 0, triangles: 1, draws: 1, dependencies: [], critical: false };
  const base = emptyShardfile({ slug: 'near-fixture', name: 'Near', author: 'Test', revision: 1, seed: 9 });
  const source = { ...base, files: [file], near: { version: 1 as const, terrain: [], content: [hash] } }, url = 'https://game.test/shardfiles/near-fixture/shard.json';
  const sections = new Map([...outputSectionPayloads(source)].map(([name, value]) => [name, encode(value)]));
  const index = { format: 'wildshard.shardfile', formatVersion: 2, sdk: '0.2', version: source.version, identity: source.identity, requires: source.requires,
    build: { sourceHash: '0'.repeat(64), validator: 'test' }, admission: { budgets: source.budgets, serverBudget: source.serverBudget, authorCaps: source.authorCaps, critical: source.critical, library: source.library },
    sections: [...sections].map(([name, bytes]) => ({ name, path: `sections/${name}.json`, schema: `wildshard:${name}@1`, hash: hashImmutableBytes(bytes), bytes: bytes.length })), schemas: [],
    files: [{ ...file, path: `blobs/glb/${hash}.glb` }], runtime: null };
  const at = (path: string) => new URL(path, url).href, wires = new Map([[url, encode(index)], [at(`blobs/glb/${hash}.glb`), glb], ...[...sections].map(([name, bytes]) => [at(`sections/${name}.json`), bytes] as const)]);
  const fetch = vi.fn((path: string): Promise<Response> => {
    const bytes = wires.get(path); if (bytes === undefined) return Promise.reject(new Error(`Unexpected read: ${path}`));
    return Promise.resolve(new Response(Uint8Array.from(bytes)));
  });
  const near = await readGridProductNear(url, 'near-fixture', { base: new URL('.', url).href, offline: false, firstParty: false, fetch, hash: (bytes: Uint8Array) => Promise.resolve(hashImmutableBytes(bytes)) });
  if (near === null) throw new Error('Missing near view');
  expect(near.rows.near.content).toEqual([hash]); expect(near.rows.inventory.files.map(row => row.kind)).toEqual(['glb']);
  expect(await near.read(hash)).toEqual(glb);
  await expect(near.read('0'.repeat(64))).rejects.toThrow('Undeclared grid near file');
  expect(fetch.mock.calls.map(([path]) => path)).toEqual([url, at('sections/world/tiles.json'), at('sections/look/look.json'), at(`blobs/glb/${hash}.glb`)]);
});

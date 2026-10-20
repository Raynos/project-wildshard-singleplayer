import { expect, test, vi } from 'vitest';
import { emptyShardfile } from '@wildshard/sdk/author';
import { outputSectionPayloads } from '@wildshard/format/outputIndex';
import { encodeCanonicalJson, hashImmutableBytes } from '../src/sdk/immutable';
import { readGridProductEdges } from '../src/game/grid/products';

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

// oxlint-disable-next-line import/no-nodejs-modules -- Validate real committed recordings, not synthetic audio bytes.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { scoreStingsPack } from '@wildshard/commons/packs/sounds';
import { createCatalogue } from '../src/commons/catalogue';
import { commonsRequirements } from '../src/sdk/commons';
import { parseAudio } from '../src/sdk/assets';
import { contentHash } from '../src/sdk/project';
import { emptyShardfile } from '../src/sdk/author';
import { ContentCache } from '../src/engine/boot/contentCache';
import { Scope } from '../src/engine/app/scope';
import { indexAac } from '@wildshard/format/aacIndex';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { leaseClientLibrary } from '../src/game/shardfile/clientLibrary';
import { admitProduct, type CachedProduct, type ProductCache } from '../src/game/shardfile/product';
import folk from '../public/assets/music/folk/music.json' with { type: 'json' };
import piano from '../public/assets/music/piano/music.json' with { type: 'json' };
import orchestral from '../public/assets/music/orchestral/music.json' with { type: 'json' };

const styles = [{ style: 'folk', source: folk }, { style: 'piano', source: piano }, { style: 'orchestral', source: orchestral }];
const recording = (style: string, file: string): Uint8Array => Uint8Array.from(readFileSync(new URL(`../public/assets/music/${style}/${file}`, import.meta.url)));

it.each(styles)('packs the shipped $style stings byte-exactly and downloads each once for Driftwood and Pine', async ({ style, source }) => {
  const pack = await scoreStingsPack(style, source, file => Promise.resolve(recording(style, file)), { credit: source.credit, licence: 'MiniMax-Music3 Community' });
  const built = createCatalogue([pack]), repeated = createCatalogue([await scoreStingsPack(style, source,
    file => Promise.resolve(recording(style, file)), { credit: source.credit, licence: 'MiniMax-Music3 Community' })]);
  expect(pack.version).toBe('1.0.0'); expect(built.json).toBe(repeated.json);
  let decoded = 0;
  for (const row of pack.entries) {
    const file = source.stings[row.id as keyof typeof source.stings];
    expect(row.bytes).toEqual(recording(style, file));
    const index = indexAac(row.bytes), cost = parseAudio(row.bytes);
    expect(cost).toEqual({ decoded: index.sizes.length * 1024 * 2 * 4, gpu: 0, triangles: 0, draws: 0 });
    expect(cost.decoded).toBeGreaterThanOrEqual(index.mediaFrames * 2 * 4); decoded += cost.decoded;
  }
  const requirements = commonsRequirements(built, built.catalogue.entries.map(row => row.id));
  const stored = new Map<string, Response>(), products = new Map<string, CachedProduct>(), downloads = new Map<string, number>();
  const address = (request: RequestInfo | URL): string => typeof request === 'string' ? request : request instanceof URL ? request.href : request.url;
  const content = new ContentCache({ origin: 'https://platform.test/', hash: bytes => Promise.resolve(contentHash(bytes)), now: () => 1,
    storage: { open: () => Promise.resolve({ match: key => Promise.resolve(stored.get(address(key))?.clone()),
      put: (key, value) => { stored.set(address(key), value.clone()); return Promise.resolve(); },
      delete: key => Promise.resolve(stored.delete(address(key))), keys: () => Promise.resolve([...stored.keys()].map(key => new Request(key))) }) } });
  const cache: ProductCache = { product: base => Promise.resolve(products.get(base) ?? null),
    putProduct: (base, product) => { products.set(base, product); return Promise.resolve(); },
    asset: (_base, hash) => content.get(hash), putAsset: (_base, hash, bytes) => content.put(hash, bytes) };
  const allocator = new ResidencyAllocator(), scopes: Scope[] = [];
  try {
    for (const slug of ['driftwood-isle', 'pine-hollow']) {
      const shard = emptyShardfile({ slug, name: slug, author: 'Wildshard', seed: 1, revision: 1 });
      shard.requires = { ...shard.requires, ...requirements }; shard.library = requirements.commons.map(hash => `commons:${hash}`);
      const product = await admitProduct(shard, { base: `https://platform.test/${slug}/`, offline: false, firstParty: true, cache,
        hash: bytes => Promise.resolve(contentHash(bytes)), fetch: url => {
          const hash = new URL(url).pathname.split('/').at(-1), bytes = hash === undefined ? undefined : built.assets.get(hash);
          if (hash === undefined || bytes === undefined) throw new Error('Unexpected recording request');
          downloads.set(hash, (downloads.get(hash) ?? 0) + 1); return Promise.resolve(new Response(Uint8Array.from(bytes)));
        } });
      const scope = new Scope(slug); scopes.push(scope); leaseClientLibrary(product.source, product.assets, { allocator, scope, owner: slug });
    }
    expect([...downloads.values()]).toEqual([1, 1, 1]); expect(allocator.entries()).toHaveLength(3);
    expect(allocator.entries().every(entry => entry.refs === 2 && entry.category === 'commons')).toBe(true);
    expect(allocator.cost().input.commons).toBe(decoded);
    expect(await content.stats()).toEqual({ entries: 3, bytes: [...built.assets.values()].reduce((sum, bytes) => sum + bytes.length, 0) });
    scopes[0]?.dispose(); expect(allocator.entries().every(entry => entry.refs === 1)).toBe(true);
    scopes[1]?.dispose(); expect(allocator.entries()).toEqual([]);
  } finally { for (const scope of scopes) scope.dispose(); }
});

it('refuses paths before reading and never mistakes unsupported or truncated audio for a cheap binary', async () => {
  let reads = 0;
  await expect(scoreStingsPack('folk', { stings: { pickup: 'pickup.m4a', death: '../death.m4a', chunk: 'chunk.m4a' } },
    () => { reads++; return Promise.resolve(new Uint8Array()); }, { credit: 'Test', licence: 'Test' })).rejects.toThrow('local recording');
  expect(reads).toBe(0);
  const bytes = recording('folk', folk.stings.pickup);
  expect(() => parseAudio(bytes.subarray(0, -1))).toThrow();
  const fragmented = new Uint8Array(bytes.length + 8); fragmented.set(bytes);
  new DataView(fragmented.buffer).setUint32(bytes.length, 8); fragmented.set(new TextEncoder().encode('moof'), bytes.length + 4);
  expect(() => parseAudio(fragmented)).toThrow('fragmented');
  expect(() => parseAudio(new Uint8Array(12))).toThrow('invalid WAV');
});

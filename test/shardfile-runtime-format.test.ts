import { expect, it } from 'vitest';
import { emptyShardfile } from '@wildshard/sdk/author';
import { parseShardfile } from '../src/game/shardfile/schema';
import { admitProduct, type ProductOptions } from '../src/game/shardfile/product';
import { emptyShardfileSource, installShardfileProduct, shardfileSource } from '../src/game/shardfile/loader';
import type { ShardfileClientBindings } from '../src/game/shardfile/client';

const empty = () => emptyShardfile({ slug: 'runtime-format', name: 'Runtime fixture', author: 'Fixture', revision: 1, seed: 1 });
const options: ProductOptions = { base: 'https://fixture.test/runtime/', firstParty: true, offline: false,
  fetch: () => Promise.reject(new Error('No content request expected')), hash: () => Promise.reject(new Error('No asset hashing expected')) };
const bindings: ShardfileClientBindings = { instance: 'fixture', catalogue: [], items: new Map(), recipes: new Map(), icon: () => 'glyph', voices: () => new Map() };

it('defaults runtime to null and admits only a bounded relative TypeScript entry', () => {
  expect(empty().runtime).toBeNull();
  const source = empty(); source.runtime = { entry: 'runtime/doors/index.ts' };
  expect(parseShardfile(source).runtime).toEqual(source.runtime);
  for (const entry of ['https://fixture.test/code.ts', '/runtime/index.ts', 'runtime/../index.ts', 'runtime/index.js', 'runtime/index.ts?variant=1']) {
    expect(() => parseShardfile({ ...source, runtime: { entry } })).toThrow();
  }
  expect(() => parseShardfile({ ...source, runtime: { entry: 'runtime/index.ts', url: 'https://fixture.test/code.ts' } })).toThrow();
});

it('refuses external runtime declarations before fetching or publishing, including cached declarations', async () => {
  const source = empty(); source.runtime = { entry: 'runtime/index.ts' };
  let published = false;
  const cache = { product: () => Promise.resolve({ source, firstParty: true }), asset: () => Promise.resolve(null),
    putAsset: () => Promise.resolve(), putProduct: () => { published = true; return Promise.resolve(); } };
  for (const offline of [false, true]) {
    await expect(admitProduct(source, { ...options, cache, firstParty: false, offline })).rejects.toThrow('trusted first-party');
  }
  expect(published).toBe(false);
});

it('requires explicit hybrid composition while exposing the admitted first-party data plugin to that compositor', async () => {
  const source = empty(); source.runtime = { entry: 'runtime/index.ts' };
  expect(() => emptyShardfileSource(source)).toThrow('trusted hybrid composition');
  await expect(installShardfileProduct(source, options, bindings)).rejects.toThrow('trusted hybrid composition');
  const data = await shardfileSource(source, options, bindings);
  expect(typeof (await data.load?.())?.default).toBe('function');
});

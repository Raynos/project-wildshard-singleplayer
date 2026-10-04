import { expect, it } from 'vitest';
import * as v from 'valibot';
import { externalShardInstance } from '../src/game/shardfile/identity';
import { contentHash } from '../src/sdk/project';
import { emptyShardfile } from '../src/sdk/author';
import { admitProduct } from '../src/game/shardfile/product';
import { SaveStore } from '../src/engine/saves/store';
import { MemoryStorage } from './setup';

const hash = (bytes: Uint8Array) => Promise.resolve(contentHash(bytes));
it('keeps save identity across paths/revisions but separates origins and slugs in real instance saves', async () => {
  const one = await externalShardInstance('https://one.test/path/', 'my.shard', hash);
  expect(await externalShardInstance('https://one.test/next-version/', 'my.shard', hash)).toBe(one);
  const two = await externalShardInstance('https://two.test/path/', 'my.shard', hash), three = await externalShardInstance('https://one.test/path/', 'other', hash);
  expect(new Set([one, two, three]).size).toBe(3); expect(one.length).toBeLessThanOrEqual(128);
  const store = new SaveStore({ local: new MemoryStorage(), session: null }), key = { key: 'flags', scope: 'shard' as const, version: 1, schema: v.array(v.string()), initial: (): string[] => [] };
  expect(store.instance(key, { id: one }).write(['quest.done'])).toBe(true);
  expect(store.instance(key, { id: one }).read()).toEqual(['quest.done']); expect(store.instance(key, { id: two }).read()).toEqual([]); expect(store.instance(key, { id: three }).read()).toEqual([]);
});
it.each(['template', 'driftwood-isle', 'pine-hollow', 'nalati-grasslands', 'nine-dragon-stack', 'far-reach', 'sunscar-dunes', 'profile'])('refuses a reserved outside slug %s before asset requests', async (slug) => {
  const source = emptyShardfile({ slug, name: 'Outside', author: 'Local', seed: 1, revision: 1 }); let requests = 0;
  await expect(admitProduct(source, { base: 'https://outside.test/', offline: false, firstParty: false, hash, fetch: () => { requests++; return Promise.resolve(new Response()); } })).rejects.toThrow('reserved'); expect(requests).toBe(0);
});

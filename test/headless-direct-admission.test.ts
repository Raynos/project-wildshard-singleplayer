import { expect, test } from 'vitest';
import { emptyShardfile } from '../src/sdk/author';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { prepareHeadlessRuntime } from './fixtures/nine-headless';
import type { Rapier } from '../src/engine/physics/rapier';
import { legacyDouble } from './fake/FakeGame';
import assembly from '../src/shards/nine-dragon-stack/data/headlessAssembly.json' with { type: 'json' };

test('direct native proof refuses malformed return admission before payload or host preparation', async () => {
  const shard = emptyShardfile({ slug: 'native-proof', name: 'Native proof', author: 'Fixture', revision: 1, seed: 7 });
  const reads: string[] = [];
  const product = createShardProduct({ slug: shard.identity.slug, revision: 1, shardfile: shard,
    sections: new Map([['actors/return-scripts', [{}]]]),
    files: new Map([['sim/headless-assembly.json', { hash: 'assembly', url: 'assembly' }]]),
    read: hash => { reads.push(hash); return Promise.resolve(new TextEncoder().encode(JSON.stringify(assembly))); } });
  await expect(prepareHeadlessRuntime({ shard, product, assets: new Map(), rapier: legacyDouble<Rapier>({}) }))
    .rejects.toThrow(/Invalid (key|type)/u);
  expect(reads).toEqual(['assembly']);
});

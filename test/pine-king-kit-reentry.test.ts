// oxlint-disable-next-line import/no-nodejs-modules -- Bake the real kit from the committed King rig without a renderer.
import { readFileSync } from 'node:fs';
import { afterEach, expect, test, vi } from 'vitest';
import * as rigLoader from '../src/engine/anim/rig';
import { SkyRig } from '../src/engine/world/skyRig';
import { emptyShardfile } from '../src/sdk/author';
import { readSourceModel } from '../src/sdk/bake/skinned';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { bakeKingKit } from '../src/shards/pine-hollow/generators/kingKit';
import { makeKingKit, preloadKingKit } from '../src/shards/pine-hollow/runtime/models/antlerKing';

afterEach(() => { vi.restoreAllMocks(); });
const shardfile = emptyShardfile({ slug: 'pine-king-kit-test', name: 'King kit', author: 'Wildshard', revision: 1, seed: 1 });
const KIT_URL = '/assets/pine-hollow/baked/king-kit-test.glb';

// 7bc1c2ca8 memoized the whole preload: after a world exit disposed the borrowed parts (the library evicts them), a
// grid-road re-entry never fetched them again and Pine's admission refused "the King's baked king-lantern-frame is
// not loaded".
test('a re-entry after the kit parts retire preloads the King kit again', async () => {
  const made = await bakeKingKit(tier => new Uint8Array(readFileSync(`public/assets/pine-hollow/creatures/antler-king-rig${tier === 'phone' ? '.phone' : ''}.rigged.glb`)));
  const reads: string[] = [];
  vi.spyOn(rigLoader, 'loadRigFile').mockImplementation(async url => { reads.push(url); return (await readSourceModel(made.glb)).gltf; });
  const product = createShardProduct({ slug: shardfile.identity.slug, revision: 1, shardfile,
    sections: new Map([['custom/kingKit', { ...made.rows, pool: { ...made.rows.pool, url: 'models/king/kit.glb' } }]]),
    files: new Map([['models/king/kit.glb', { hash: 'test', url: KIT_URL }]]),
    read: () => Promise.reject(new Error('King kit section must already be admitted')), check: true });
  const sky: unknown = Object.create(SkyRig.prototype);
  if (!(sky instanceof SkyRig)) throw new Error('Missing test sky');
  vi.spyOn(sky, 'setupMaterial').mockImplementation(() => undefined);

  await preloadKingKit(product);
  const first = makeKingKit(sky);
  expect(reads).toEqual([KIT_URL]);
  await preloadKingKit(product);
  expect(reads).toHaveLength(1); // a warm call reads nothing

  // the world exit: the scene's owner disposes the borrowed kit parts and the library forgets them
  for (const geometry of [first.frameGeo, first.glassGeo, first.ribGeo, first.coreGeo]) geometry.dispose();
  await preloadKingKit(product);
  expect(reads).toEqual([KIT_URL, KIT_URL]);
  const again = makeKingKit(sky);
  expect(again.frameGeo).not.toBe(first.frameGeo);
  expect(again.frameGeo.getAttribute('position').count).toBe(first.frameGeo.getAttribute('position').count);
}, 60000);

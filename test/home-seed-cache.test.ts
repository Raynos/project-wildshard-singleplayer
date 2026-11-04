import { afterEach, expect, test, vi } from 'vitest';
import { BufferAttribute, BufferGeometry, Matrix4 } from 'three';
import { snapshotHomeGeometry } from '../src/game/shardfile/homeGeometrySnapshot';
import { encodeHomeSeed } from '../src/game/shardfile/homeSeed';
import { bindHomeBuildCache, homeBuildGeometryKeys, installHomeSeedLoader, readHomeBuildGeometry } from '../src/game/shardfile/homeBuildCache';
import { initializeTier, TIER } from '../src/engine/core/tier';
import { emptyShardfile } from '../src/sdk/author';

const originalTier = TIER;
afterEach(() => { initializeTier(originalTier); });

function sample() {
  const geometry = new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3));
  const snapshot = snapshotHomeGeometry(new Map([['draw', { geometry, matrix: new Matrix4() }]])); if (snapshot === null) throw new Error('Missing snapshot');
  return { geometry, snapshot };
}

// The loader and seeds are page state: the tests run in order, the first before any loader is installed.
function phoneTier(): void { initializeTier('phone'); }

test('a bound home restores a seeded key on a miss; other keys, other homes and no loader fall through', async () => {
  const { geometry, snapshot } = sample(), owned = 'owned:["/shardfiles/seed-home/blobs/glb/aa.glb",[],"phone",[],null,true]';
  const seed = encodeHomeSeed(new Map([[owned, snapshot]]));
  phoneTier();
  const home = emptyShardfile({ slug: 'seed-home', name: 'Seed', author: 'Test', revision: 1, seed: 1 });
  const neighbour = emptyShardfile({ slug: 'seed-home', name: 'Seed', author: 'Test', revision: 1, seed: 1 });
  bindHomeBuildCache(home);
  // No loader (runtime packs off): nothing is read.
  expect(await readHomeBuildGeometry(home, `owned:["http://127.0.0.1:4401${owned.slice(8)}`)).toBeNull();
  const load = vi.fn((slug: string, tier: string) => Promise.resolve(slug === 'seed-home' && tier === 'phone' ? seed : null));
  installHomeSeedLoader(load);
  const runtimeKey = `owned:["http://127.0.0.1:4401${owned.slice(8)}`;
  expect([...await homeBuildGeometryKeys(home) ?? []]).toEqual([owned]);
  expect(await readHomeBuildGeometry(home, 'owned:["http://127.0.0.1:4401/shardfiles/seed-home/blobs/glb/zz.glb",[],"phone",[],null,true]')).toBeNull();
  expect(await readHomeBuildGeometry(neighbour, runtimeKey)).toBeNull();
  const restored = await readHomeBuildGeometry(home, runtimeKey), view = restored?.get('draw');
  if (view === undefined) throw new Error('Expected a seeded restore');
  expect(view.geometry.getAttribute('position').array).toEqual(geometry.getAttribute('position').array);
  expect(load).toHaveBeenCalledTimes(1);
  // Every key was read, so the seed's bytes go; a later read decodes the original file.
  expect(await readHomeBuildGeometry(home, runtimeKey)).toBeNull();
  view.geometry.dispose(); geometry.dispose();
});

test('a failed or malformed seed load reads nothing', async () => {
  phoneTier();
  const home = emptyShardfile({ slug: 'seed-bad', name: 'Seed', author: 'Test', revision: 1, seed: 1 });
  bindHomeBuildCache(home);
  installHomeSeedLoader(() => Promise.resolve(new Uint8Array([1, 2, 3, 4, 5])));
  expect(await readHomeBuildGeometry(home, 'whole:[["a"],"phone"]')).toBeNull();
  installHomeSeedLoader(() => Promise.reject(new Error('offline')));
  expect(await readHomeBuildGeometry(home, 'whole:[["a"],"phone"]')).toBeNull();
});

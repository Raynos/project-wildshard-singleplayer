import { expect, expectTypeOf, test } from 'vitest';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { GROUND_FILES, groundFilesFrom } from '../src/shards/driftwood-isle/generators/groundFiles';
import { OCEAN_FILES } from '../src/shards/driftwood-isle/generators/oceanFiles';
import { driftwoodFacetedGroundBank } from '../src/shards/driftwood-isle/generators/facetedGroundBank';
import { driftwoodOceanBank } from '../src/shards/driftwood-isle/generators/oceanBank';
import original from './fixtures/driftwood-ground-ocean-aliases-original.json' with { type: 'json' };

test('all ground and ocean aliases retain original values and exact owned payload identities', () => {
  expect(GROUND_FILES).toEqual(original.ground);
  expect(OCEAN_FILES).toEqual(original.ocean);
  expectTypeOf<typeof OCEAN_FILES.level>().toEqualTypeOf<0>();
  const ground = driftwoodFacetedGroundBank();
  for (const part of ['ground', 'slab'] as const) {
    const url = GROUND_FILES[part], name = `world/ground/${part}.glb`, bytes = ground.blobs.get(name);
    if (bytes === undefined) throw new Error(`Missing owned ground part: ${part}`);
    expect(ground.byUrl[url]).toBe(name);
    expect(url.endsWith(`/ground-${hashImmutableBytes(bytes)}.glb`)).toBe(true);
  }
  const ocean = driftwoodOceanBank();
  for (const part of ['phone', 'desktop', 'floor'] as const) {
    expect(OCEAN_FILES[part]).toBe(ocean.urls[part]);
    const extension = part === 'floor' ? 'bin' : 'glb';
    expect(OCEAN_FILES[part].endsWith(`/ocean-${hashImmutableBytes(ocean.files[part])}.${extension}`)).toBe(true);
  }
});

test('ground slots refuse missing, renamed and ambiguous producer-owned aliases', () => {
  const byUrl = { ...driftwoodFacetedGroundBank().byUrl };
  delete byUrl[GROUND_FILES.ground];
  expect(() => groundFilesFrom(byUrl)).toThrow('needs one owned alias');
  byUrl[GROUND_FILES.ground] = 'world/ground/renamed.glb';
  expect(() => groundFilesFrom(byUrl)).toThrow('needs one owned alias');
  byUrl[GROUND_FILES.ground] = 'world/ground/ground.glb';
  byUrl[`/duplicate${GROUND_FILES.ground}`] = 'world/ground/ground.glb';
  expect(() => groundFilesFrom(byUrl)).toThrow('needs one owned alias');
});

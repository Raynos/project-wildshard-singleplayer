import { expect, test } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- The exact native-V8 oracle records the M5 Mac architecture.
import { arch, platform } from 'node:process';
import * as v from 'valibot';
import { readProjectAssets } from '../src/sdk/project';
import { encodeCanonicalJson, hashImmutableBytes } from '../src/sdk/immutable';
import { DRESSING_PLAN, CAMP_CLUTTER } from '../src/shards/nalati-grasslands/world/dressing/index';
import cover from '../src/shards/nalati-grasslands/boot/cover.generated.json' with { type: 'json' };
import { AmbientGroup } from '../src/game/ambient/flock';
import { SpecimenCatalogueSchema } from '../src/format/specimenCatalogue';
import { setTerrainHeight } from '../src/engine/world/terrainHeight';

test('prepared ambient rows keep both tier populations and finite flight at 10 Hz', () => {
  setTerrainHeight(() => 0);
  for (const [tier, profile] of Object.entries({ phone: cover.phone, desktop: cover.desktop })) {
    v.parse(SpecimenCatalogueSchema, profile.catalogue);
    expect(profile.life.filter(row => row.kind === 'butterfly').reduce((count, group) => count + group.row.count, 0)).toBe(cover.butterflies[tier === 'phone' ? 'phone' : 'desktop']);
    expect(profile.life.filter(row => row.kind === 'raptor').reduce((count, group) => count + group.row.count, 0)).toBe(3);
    for (const spec of profile.life) {
      const group = new AmbientGroup(spec.row, spec.perches);
      for (let tick = 0; tick < 100; tick++) group.update(0.1, { x: 0, y: 0, z: 0 });
      expect(group.birds).toHaveLength(spec.row.count);
      for (const bird of group.birds) expect([bird.x, bird.y, bird.z, bird.yaw, bird.pitch, bird.roll, bird.flap].every(Number.isFinite)).toBe(true);
      if (spec.kind === 'butterfly') {
        const active = group.birds.filter(bird => bird.state !== 0);
        expect(active.length).toBeGreaterThan(0);
        expect(active.every(bird => Math.hypot(bird.x, bird.z) < 55)).toBe(true);
      }
    }
  }
});

test('Nalati admits every shipping dressing placement and camp keep-out result unchanged', async () => {
  const loaded = await readProjectAssets('src/shards/nalati-grasslands');
  const read = (key: string): unknown => {
    const file = loaded.output.namedFiles?.find(row => row.name === `world/dressing-${key}.json`);
    const bytes = file === undefined ? undefined : loaded.assets.get(file.hash);
    if (bytes === undefined) throw new Error(`Missing admitted dressing ${key}`);
    return JSON.parse(new TextDecoder().decode(bytes));
  };
  const plan = v.parse(DRESSING_PLAN, Object.fromEntries(Object.keys(DRESSING_PLAN.entries).map(key => [key, read(key)])));
  const clutter = v.parse(CAMP_CLUTTER, read('clutter'));
  // Independent original world/dressing/place.ts on the native ground, real
  // spruce roster and all 454 POI/outcrop/crag boxes, before its deletion.
  // Native V8 trig has tiny architecture-dependent differences. Counts and
  // admission hold everywhere; this byte oracle is the original M5 capture.
  if (platform === 'darwin' && arch === 'arm64') {
    expect(hashImmutableBytes(new TextEncoder().encode(encodeCanonicalJson({ plan, clutter }))))
      .toBe('d11ea6bfca2f28dda29243cb972dcd82cc5273f8df777ed3e273fa4ae001634b');
  }
  expect(Object.fromEntries(Object.entries(plan).map(([key, rows]) => [key, rows.length]))).toEqual({
    boulder: 1900, slab: 1579, stone: 19791, juniper: 278, rose: 136, willow: 230,
    lupin: 2778, daisy: 8811, reed: 1050, logs: 17, stumps: 11, ovoos: 9,
    poles: 7, fences: 6, gates: 1, drifts: 310, colliders: 1346,
  });
  expect(clutter).toHaveLength(48);
}, 30_000);

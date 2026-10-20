import { expect, test } from 'vitest';
import * as v from 'valibot';
import { enemyPlacements } from '../src/shards/driftwood-isle/generators/enemyPlacement';
import { EnemyPlacementsSchema } from '../src/shards/driftwood-isle/generators/sections';
import { placeEnemies as legacyPlacement } from '../src/shards/driftwood-isle-legacy/runtime/placement';
import foliage from '../src/shards/driftwood-isle/data/foliagePlacements.generated.json' with { type: 'json' };
import physics from '../src/shards/driftwood-isle/data/physics.generated.json' with { type: 'json' };
import { driftwoodGroundSampler } from '../src/shards/driftwood-isle/generators/groundSampling';
import { driftwoodBake, readEnemyPlacements } from '../src/shards/driftwood-isle/sim/baked';
import { Rng } from '../src/engine/core/rng';

test('offline placements retain the frozen page/native populations, herds, yaw and coconut stream', () => {
  const actual = v.parse(EnemyPlacementsSchema, structuredClone(enemyPlacements()));
  expect(readEnemyPlacements(actual).native).toEqual(actual.native);
  const extra = physics.habitat.perchBases.slice(foliage.tiers.phone.palms.specs.length);
  const entries = [
    { rows: actual.page.phone, palms: [...foliage.tiers.phone.palms.specs, ...extra], heightAt: driftwoodGroundSampler() },
    { rows: actual.page.desktop, palms: [...foliage.tiers.desktop.palms.specs, ...extra], heightAt: driftwoodGroundSampler() },
    { rows: actual.native, palms: physics.habitat.perchBases, heightAt: driftwoodBake(physics).floorAt },
  ];
  for (const { rows, palms, heightAt } of entries) {
    const expected = legacyPlacement({ seed: foliage.seed, waterLevel: 0, crabSites: physics.habitat.crabSites, palms, heightAt });
    expect(rows.enemies).toEqual(expected.enemies);
    expect(rows.herds).toBe(expected.herds); expect(rows.centres).toEqual(expected.centres);
    expect(rows.stream).toEqual(expected.stream.snapshot());
    const restored = new Rng(0); restored.restore(rows.stream);
    expect(Array.from({ length: 40 }, () => restored.next())).toEqual(Array.from({ length: 40 }, () => expected.stream.next()));
    expect(rows.kinds.length).toBe(rows.centres.length);
  }
});

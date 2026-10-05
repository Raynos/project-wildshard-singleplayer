// SHARD-PLATFORM SF46 (G164 details, council C3-R2-C4), the page-wide half: with the "Driftwood hybrid boot" row saved ON
// before the shard's modules first read it (the row reloads the page; worldDrop() reads it once), every sea and height
// source the page keys on the row reads the same −0.8 m: the manifest's terrain field (heightAt, waterLevel, the bake's
// datum), OCEAN.level (the ocean shader's and the toon caustics' `uSeaLevel`, world/Ocean.ts), the map's / grid edge
// reader's open water, and the engine's terrain datum once the level is configured. Row OFF is sea-lowered.test.ts.
import { beforeAll, expect, it } from 'vitest';
import { jsonSlot } from '../../../src/engine/saves/slots';

import type * as SeaModule from '../../../src/shards/driftwood-isle/world/sea';
import type * as ManifestModule from '../../../src/shards/driftwood-isle/manifest';

let sea: typeof SeaModule, shard: typeof ManifestModule, datum: number;
beforeAll(async () => {
  jsonSlot('debug.plugin.driftwood-isle.driftwoodHybrid', 'device').write('on');
  sea = await import('../../../src/shards/driftwood-isle/world/sea');
  shard = await import('../../../src/shards/driftwood-isle/manifest');
  expect(sea.worldDrop()).toBe(sea.WORLD_DROP); // read once, now, with the row ON
  const { toLevelSpec } = await import('../../../src/game/shard/spec');
  const { configureLevel } = await import('../../../src/engine/level/selection');
  const { terrainDatum } = await import('../../../src/engine/world/terrainHeight');
  await import('../../../src/engine/world/Heightfield');
  configureLevel(toLevelSpec(shard.default)); datum = terrainDatum();
});

it('row ON: the field, the waterline, OCEAN.level (uSeaLevel), the open water and the engine datum all read -0.8 m', () => {
  const field = shard.default.ground.terrain;
  if (field === undefined) throw new Error('Driftwood has an analytic terrain');
  expect(field.waterLevel()).toBeCloseTo(sea.LOWERED_SEA, 12); expect(field.datum).toBe(-sea.WORLD_DROP);
  expect(sea.waterline()).toBeCloseTo(0, 12); expect(shard.OCEAN.level).toBeCloseTo(0, 12);
  expect(shard.default.minimap?.openWater?.level).toBeCloseTo(0, 12); expect(sea.declaredSeaLevel()).toBeCloseTo(0, 12);
  expect(datum).toBe(-sea.WORLD_DROP);
  // the field's heights are the authored landscape less the drop: the beach at the authored waterline now meets the sea at 0
  expect(shard.WRECK.floorY).toBeCloseTo(1.45 - sea.WORLD_DROP, 9);
});

import { expect, expectTypeOf, test } from 'vitest';
import * as v from 'valibot';
import { worldTargetRows, worldLightEmitters, worldEasedFields } from '../src/sdk/worldScenes';
import { declaredQuestPageRows } from '../src/sdk/quests';
import { readTerrainTileSource } from '../src/sdk/bake/terrain';
import { parseWorldTargets } from '../src/format/worldTargets';
import { parseLightEmitters } from '../src/format/lightEmitters';
import { parseEasedFields } from '../src/format/easedFields';
import { parseDeclaredQuestPage } from '../src/format/declaredQuestPage';
import { encodeTerrainTile, decodeTerrainTile, terrainTileHeight } from '../src/format/terrainTileBytes';
import { SIGNAL_LASH_TARGETS } from '../src/shards/sunscar-dunes/generators/lashTargets';
import { SIGNAL_EMITTERS } from '../src/shards/sunscar-dunes/generators/lightEmitters';
import { SIGNAL_WEATHER_FIELDS } from '../src/shards/sunscar-dunes/generators/weatherFields';
import { SIGNAL_QUEST_PAGE_INTERACTIONS } from '../src/shards/sunscar-dunes/generators/questPageInteractions';

function outcome(run: () => unknown): unknown {
  try { return { rows: run() }; }
  catch (error) { if (error instanceof v.ValiError) return { issues: error.issues }; throw error; }
}

test('world effect author ports retain full native types, serialization and refusals', () => {
  expectTypeOf<ReturnType<typeof worldTargetRows>>().toEqualTypeOf<ReturnType<typeof parseWorldTargets>>();
  expectTypeOf<ReturnType<typeof worldLightEmitters>>().toEqualTypeOf<ReturnType<typeof parseLightEmitters>>();
  expectTypeOf<ReturnType<typeof worldEasedFields>>().toEqualTypeOf<ReturnType<typeof parseEasedFields>>();
  expectTypeOf<ReturnType<typeof declaredQuestPageRows>>().toEqualTypeOf<ReturnType<typeof parseDeclaredQuestPage>>();
  for (const [read, native, rows] of [
    [worldTargetRows, parseWorldTargets, SIGNAL_LASH_TARGETS],
    [worldLightEmitters, parseLightEmitters, SIGNAL_EMITTERS],
    [worldEasedFields, parseEasedFields, SIGNAL_WEATHER_FIELDS],
    [declaredQuestPageRows, parseDeclaredQuestPage, SIGNAL_QUEST_PAGE_INTERACTIONS],
  ] as const) {
    expect(JSON.stringify(read(rows))).toBe(JSON.stringify(native(rows)));
    expect(read(rows)).not.toBe(rows);
    for (const bad of [null, {}, { ...rows, extra: true }, { ...rows, callback: () => 0 }]) {
      expect(outcome(() => read(bad))).toEqual(outcome(() => native(bad)));
      if (bad === null || Object.keys(bad).length === 0) expect(() => read(bad)).toThrow();
    }
  }
});

test('author terrain tile sampling keeps native interpolation, boundaries and malformed-byte refusals', () => {
  const resolution = 3, heights = Float32Array.from([0, 1, -2, 3.5, 4, 6, 2, -3, 1]);
  const bytes = encodeTerrainTile({ resolution, x: -2, z: -2, size: 4, heights });
  const ground = decodeTerrainTile(bytes), field = readTerrainTileSource(bytes);
  for (const [x, z] of [[-2, -2], [-1.5, -0.2], [0, 0], [0.75, 1.75], [2, 2]]) {
    if (x === undefined || z === undefined) throw new Error('Missing sample coordinate');
    expect(Object.is(field.heightAt(x, z), terrainTileHeight(ground, x, z))).toBe(true);
  }
  expect(() => field.heightAt(-3, 4)).toThrow('Point outside terrain');
  expect(() => terrainTileHeight(ground, -3, 4)).toThrow('Point outside terrain');
  expect(() => readTerrainTileSource(bytes.subarray(0, 8))).toThrow();
});

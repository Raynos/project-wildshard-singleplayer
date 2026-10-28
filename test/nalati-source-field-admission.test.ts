import { expect, expectTypeOf, test } from 'vitest';
import * as v from 'valibot';
import { manifestFieldRows } from '../src/sdk/rows';
import { specimenShapeSources } from '../src/sdk/bake/specimenCatalogue';
import { ManifestMetadataSchema } from '../src/format/minimap';
import manifest from '../src/shards/nalati-grasslands/data/manifestRows.json' with { type: 'json' };

test('selected manifest fields retain native types, order, defaults and exact issue paths', () => {
  const keys = ['sky', 'grade', 'atmosphere'] as const;
  const schema = v.pick(ManifestMetadataSchema, keys);
  const input = { sky: manifest.sky, grade: manifest.grade, atmosphere: manifest.atmosphere };
  const actual = manifestFieldRows(keys, input), original = v.parse(schema, input);
  expectTypeOf(actual).toEqualTypeOf<typeof original>();
  expect(JSON.stringify(actual)).toBe(JSON.stringify(original));
  expect(Object.keys(actual)).toEqual(Object.keys(original));
  const issue = (make: () => unknown): unknown => {
    try { return make(); } catch (error) {
      if (!(error instanceof v.ValiError)) throw error;
      return error.issues;
    }
  };
  for (const invalid of [null, {}, manifest, { sky: 'invalid', grade: null, atmosphere: false }])
    expect(issue(() => manifestFieldRows(keys, invalid))).toEqual(issue(() => v.parse(schema, invalid)));
});

test('offline shape sources preserve opaque geometry identity and native envelope refusals', () => {
  const native = v.object({ rows: v.array(v.object({ key: v.string(), name: v.string(), geometry: v.unknown() })) });
  const geometry = { opaque: true }, input = { rows: [{ key: 'orchard/board', name: 'models/board.glb', geometry, extra: 1 }], unused: false };
  const actual = specimenShapeSources(input), original = v.parse(native, input).rows;
  expectTypeOf(actual).toEqualTypeOf<typeof original>();
  expect(actual).toEqual(original); expect(actual[0]?.geometry).toBe(geometry);
  expect(actual).not.toBe(input.rows); expect(Object.keys(actual[0] ?? {})).toEqual(['key', 'name', 'geometry']);
  for (const value of [null, {}, { rows: null }, { rows: [false] }, { rows: [{ key: 1, name: 'x' }] }]) {
    expect(() => specimenShapeSources(value)).toThrow();
    expect(() => v.parse(native, value)).toThrow();
  }
});

import { expect, expectTypeOf, test } from 'vitest';
import * as v from 'valibot';
import { cachedBlobSources, type CachedBlobSource } from '../src/sdk/bake/sourceMetadata';
import { parseSignSourceRows } from '../src/shards/nine-dragon-stack/generators/signAtlasOutput';
import { parseDeviceTierSections } from '../src/sdk/sections';

const kinds = ['glb', 'ktx2', 'json'] as const;
const original = v.object({ sources: v.array(v.strictObject({ name: v.string(), kind: v.picklist(kinds), source: v.string(),
  options: v.strictObject({ decoded: v.number(), gpu: v.number(), triangles: v.number(), draws: v.number(), critical: v.boolean(), dependencies: v.array(v.string()) }) })) });
function source(): CachedBlobSource<'json'> {
  return { name: 'ordered.json', kind: 'json', source: 'rows/ordered.json',
    options: { decoded: 123, gpu: 0, triangles: 0, draws: 0, critical: true, dependencies: ['z', 'a', 'z'] } };
}

test('cached source metadata keeps original order, costs, ownership and kind types', () => {
  const row = source(), input = { sources: [row], cacheKey: 'stripped' };
  const actual = cachedBlobSources(input, kinds), before = v.parse(original, input).sources;
  expectTypeOf(actual).toEqualTypeOf<CachedBlobSource<'glb' | 'ktx2' | 'json'>[]>();
  expect(JSON.stringify(actual)).toBe(JSON.stringify(before));
  expect(parseSignSourceRows(input)).toEqual(before);
  expect(actual[0]).not.toBe(row);
  expect(actual[0]?.options.dependencies).not.toBe(row.options.dependencies);
  const recorded = { sources: [{ ...row, options: { ...row.options, decoded: Infinity, gpu: -0 } }] };
  expect(cachedBlobSources(recorded, kinds)).toEqual(v.parse(original, recorded).sources);
  expect(cachedBlobSources({ sources: [] }, kinds)).toEqual([]);
});

test('cached metadata preserves all row, option, type and missing-field refusals', () => {
  const row = source();
  for (const input of [null, {}, { sources: null }, { sources: [{ ...row, kind: 'bin' }] },
    { sources: [{ ...row, extra: 1 }] }, { sources: [{ ...row, name: 1 }] },
    { sources: [{ ...row, options: { ...row.options, extra: 1 } }] },
    { sources: [{ ...row, options: { ...row.options, decoded: Number.NaN } }] },
    { sources: [{ ...row, options: { ...row.options, dependencies: [1] } }] }]) {
    expect(() => cachedBlobSources(input, kinds)).toThrow();
    expect(() => v.parse(original, input)).toThrow();
  }
  expect(() => cachedBlobSources({ sources: [row] }, ['glb'])).toThrow();
});

test('earlier source metadata can retain native stripping without weakening final admission', () => {
  const row = source(), input = { sources: [{ ...row, extra: 1, options: { ...row.options, extra: true } }] };
  const loose = v.object({ sources: v.array(v.object({ name: v.string(), kind: v.picklist(kinds), source: v.string(),
    options: v.object({ decoded: v.number(), gpu: v.number(), triangles: v.number(), draws: v.number(), critical: v.boolean(), dependencies: v.array(v.string()) }) })) });
  expect(cachedBlobSources(input, kinds, 'strip')).toEqual(v.parse(loose, input).sources);
  expect(() => cachedBlobSources(input, kinds)).toThrow();
});

test('device-tier section admission keeps transforms, order, ownership and refusals', () => {
  const calls: number[] = [];
  const schema = v.object({ value: v.pipe(v.number(), v.transform(value => { calls.push(value); return value * 2; })) });
  const input = { phone: { value: 1, extra: true }, desktop: { value: 2 }, extra: true };
  const actual = parseDeviceTierSections(schema, input);
  expect(actual).toEqual({ phone: { value: 2 }, desktop: { value: 4 } });
  expect(calls).toEqual([1, 2]);
  calls.length = 0;
  expect(actual).toEqual(v.parse(v.object({ phone: schema, desktop: schema }), input));
  expect(calls).toEqual([1, 2]);
  expect(actual.phone).not.toBe(input.phone);
  expectTypeOf(actual).toEqualTypeOf<{ phone: { value: number }; desktop: { value: number } }>();
  for (const bad of [null, {}, { phone: { value: 1 } }, { phone: { value: '1' }, desktop: { value: 2 } }]) {
    expect(() => parseDeviceTierSections(schema, bad)).toThrow();
    expect(() => v.parse(v.object({ phone: schema, desktop: schema }), bad)).toThrow();
  }
  const optional = v.optional(v.string());
  expect(parseDeviceTierSections(optional, {})).toEqual(v.parse(v.object({ phone: optional, desktop: optional }), {}));
});

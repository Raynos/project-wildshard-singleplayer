import * as v from 'valibot';
import { expect, test } from 'vitest';
import { CABIN_SCENE_ROWS } from '../src/shards/pine-hollow/generators/cabinSceneContribution';
import { cabinSceneBake } from '../src/shards/pine-hollow/generators/bake-cabin-scenes.mjs';
import { namedJsonSchema } from '../src/sdk/formatJsonSchema';
import { PINE_SOURCES } from './fixtures/pine-sources';

const text = v.string(), words = v.array(v.number()), contacts = v.array(v.unknown());
const registration = v.variant('kind', [
  v.object({ kind: v.literal('building'), id: text, part: text, boxWords: words, colliders: contacts, floors: contacts }),
  v.object({ kind: v.literal('prop'), prop: v.picklist(['crate', 'barrel', 'bucket', 'hatchet']), hamlet: v.boolean(), part: text, matrices: v.array(words), boxWords: words }),
  v.object({ kind: v.literal('drawn'), id: text, which: v.picklist(['firePitObj', 'lanternObj']), part: text, matrixBits: words, boxWords: words }),
]);
const CabinSceneRowsSchema = v.object({
  blobs: v.array(v.object({ name: text, kind: v.picklist(['glb', 'json']), source: text })),
  geometry: v.array(v.object({ id: text, library: text, file: text, segments: v.exactOptional(v.array(text)), attributes: v.record(text, text) })),
  worlds: v.array(v.object({ tier: v.picklist(['phone', 'desktop']), shadow: v.boolean(), file: text, registrations: v.array(registration) })),
  specimens: v.array(v.object({ tier: v.picklist(['phone', 'desktop']), shadow: v.boolean(), key: text, choice: text, file: text })),
  graphs: v.array(v.object({ file: text, graph: v.unknown() })),
  sourceMaterials: v.array(v.object({ id: text, url: text, part: v.number() })),
});
const bake = await cabinSceneBake(PINE_SOURCES);
type Before = v.InferOutput<typeof CabinSceneRowsSchema>;
type After = ReturnType<typeof CABIN_SCENE_ROWS.parse>;
const types: [Before extends After ? true : false, After extends Before ? true : false] = [true, true];

test('source-owned cabin grammar preserves complete native rows, wire schema and mutable types', () => {
  expect(types).toEqual([true, true]);
  expect(CABIN_SCENE_ROWS.jsonSchema).toEqual(namedJsonSchema(CabinSceneRowsSchema));
  const before = v.parse(CabinSceneRowsSchema, bake.rows), after = CABIN_SCENE_ROWS.parse(bake.rows);
  expect(JSON.stringify(after)).toBe(JSON.stringify(before));
  expect(after.worlds).toHaveLength(4);
  const first = after.geometry[0];
  if (first === undefined) throw new Error('Missing original scene geometry');
  first.attributes['test'] = 'detached';
  expect(JSON.stringify(CABIN_SCENE_ROWS.parse(bake.rows))).toBe(JSON.stringify(before));
  const extras = { ...before, ignored: true, sourceMaterials: [{ id: '', url: '', part: Infinity, ignored: 1 }] };
  expect(JSON.stringify(CABIN_SCENE_ROWS.parse(extras))).toBe(JSON.stringify(v.parse(CabinSceneRowsSchema, extras)));
});

test('source-owned cabin grammar retains every registration, tier and exact-optional refusal', () => {
  const before = v.parse(CabinSceneRowsSchema, bake.rows), world = before.worlds[0];
  if (world === undefined) throw new Error('Missing original world');
  const invalid: unknown[] = [null, [], {}, { ...before, geometry: [{ id: '', library: '', file: '', attributes: {}, segments: undefined }] },
    { ...before, specimens: [{ tier: 'tablet', shadow: false, key: '', choice: '', file: '' }] },
    { ...before, sourceMaterials: [{ id: '', url: '', part: Number.NaN }] }];
  for (const registrationRow of [{}, { kind: 'unknown' }, { kind: 'building', id: '', part: '', boxWords: [], colliders: [], floors: 'wrong' },
    { kind: 'prop', prop: 'vase', hamlet: false, part: '', matrices: [], boxWords: [] },
    { kind: 'drawn', id: '', which: 'lamp', part: '', matrixBits: [], boxWords: [] }]) invalid.push({ ...before, worlds: [{ ...world, registrations: [registrationRow] }] });
  for (const input of invalid) {
    expect(() => v.parse(CabinSceneRowsSchema, input)).toThrow();
    expect(() => CABIN_SCENE_ROWS.parse(input)).toThrow();
  }
});

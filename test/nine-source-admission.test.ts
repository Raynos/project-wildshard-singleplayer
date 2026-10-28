import { expect, test } from 'vitest';
import * as v from 'valibot';
import * as before from './fixtures/nine-admission-before';
import * as after from '../src/shards/nine-dragon-stack/generators/sections';
import signs from '../src/shards/nine-dragon-stack/data/signView.json' with { type: 'json' };
import profiles from '../src/shards/nine-dragon-stack/data/specimenProfiles.json' with { type: 'json' };
import bursts from '../src/shards/nine-dragon-stack/data/burstFields.json' with { type: 'json' };
import pools from '../src/shards/nine-dragon-stack/data/lightPools.json' with { type: 'json' };
import { LightPoolProfilesSchema } from '../src/shards/nine-dragon-stack/generators/lightVolumes';

function field(value: unknown, key: string): unknown {
  if (value === null || typeof value !== 'object') throw new Error(`Missing native schema ${key}`);
  return Reflect.get(value, key);
}
function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error('Missing native schema array');
  return value;
}
function entries(value: unknown): [string, unknown][] {
  if (value === null || typeof value !== 'object') throw new Error('Missing native entries');
  return Object.entries(value);
}

/** Build witnesses from the independent original native grammar, never the new descriptors. */
function witness(schema: unknown): unknown {
  const pipe = field(schema, 'pipe');
  if (pipe !== undefined) {
    const actions = array(pipe);
    let base: unknown = actions[0];
    for (const action of actions) if (field(action, 'kind') === 'schema') base = action;
    let value = witness(base);
    for (const action of actions.slice(1)) {
      const type = field(action, 'type'), requirement = field(action, 'requirement');
      if (type === 'min_value' && typeof requirement === 'number' && typeof value === 'number') value = Math.max(value, requirement);
      if ((type === 'min_length' || type === 'length') && typeof requirement === 'number' && Array.isArray(value)) {
        const item = field(base, 'item');
        value = Array.from({ length: requirement }, () => witness(item));
      }
      if (type === 'regex') value = '0'.repeat(64);
    }
    return value;
  }
  switch (field(schema, 'type')) {
    case 'number': return 0;
    case 'string': return '';
    case 'boolean': return false;
    case 'unknown': case 'null': return null;
    case 'literal': return field(schema, 'literal');
    case 'picklist': return array(field(schema, 'options'))[0];
    case 'array': return [];
    case 'tuple': case 'strict_tuple': case 'tuple_with_rest': return array(field(schema, 'items')).map(witness);
    case 'record': return {};
    case 'nullable': return null;
    case 'exact_optional': return undefined;
    case 'union': case 'variant': return witness(array(field(schema, 'options'))[0]);
    case 'strict_object': case 'object': case 'loose_object':
      return Object.fromEntries(entries(field(schema, 'entries'))
        .filter(([, item]) => field(item, 'type') !== 'exact_optional')
        .map(([name, item]) => [name, witness(item)]));
    default: throw new Error(`Unhandled original grammar ${String(field(schema, 'type'))}`);
  }
}
function result(schema: v.GenericSchema, input: unknown): unknown {
  const parsed = v.safeParse(schema, input);
  return parsed.success ? { output: parsed.output } : { issues: JSON.stringify(parsed.issues) };
}

/** Every nested original declaration is exercised, including absent optional
 * fields, empty-array item grammars and every discriminated-union alternative. */
function* mutations(schema: unknown, input: unknown): Generator {
  yield undefined; yield null; yield Infinity; yield Number.NaN; yield -1; yield Number.MAX_SAFE_INTEGER + 1;
  yield 'invalid'; yield []; yield {}; yield true;
  const pipe = field(schema, 'pipe');
  if (pipe !== undefined) {
    const actions = array(pipe);
    let base: unknown = actions[0];
    for (const action of actions) if (field(action, 'kind') === 'schema') base = action;
    yield* mutations(base, input);
    for (const action of actions) {
      const type = field(action, 'type'), bound = field(action, 'requirement');
      if (typeof bound === 'number' && type === 'min_value') yield bound - Math.max(1, Math.abs(bound));
      if (typeof bound === 'number' && type === 'max_value') yield bound + Math.max(1, Math.abs(bound));
    }
    return;
  }
  switch (field(schema, 'type')) {
    case 'strict_object': case 'object': case 'loose_object': {
      const initial = Object.fromEntries(entries(input));
      for (const [name, item] of entries(field(schema, 'entries'))) {
        for (const changed of mutations(item, initial[name] ?? witness(item))) yield { ...initial, [name]: changed };
        const absent = { ...initial }; delete absent[name]; yield absent;
      }
      yield { ...initial, extra: true };
      return;
    }
    case 'array':
      for (const changed of mutations(field(schema, 'item'), witness(field(schema, 'item')))) yield [changed];
      return;
    case 'record':
      for (const changed of mutations(field(schema, 'value'), witness(field(schema, 'value')))) yield { entry: changed };
      return;
    case 'tuple': case 'strict_tuple': case 'tuple_with_rest': {
      const initial = array(input);
      for (const [index, item] of array(field(schema, 'items')).entries())
        for (const changed of mutations(item, initial[index])) { const output = [...initial]; output[index] = changed; yield output; }
      yield [...initial, 'extra'];
      return;
    }
    case 'exact_optional': case 'nullable':
      yield* mutations(field(schema, 'wrapped'), witness(field(schema, 'wrapped')));
      return;
    case 'union': case 'variant':
      for (const option of array(field(schema, 'options'))) { const value = witness(option); yield value; yield* mutations(option, value); }
      break;
    default: break;
  }
}

const schemas = [
  ['place', before.Place, after.Place],
  ['layout', before.LayoutRowsSchema, after.LayoutRowsSchema],
  ['projection', before.LayoutProjectionSchema, after.LayoutProjectionSchema],
  ['library', before.GeometryLibrarySchema, after.GeometryLibrarySchema],
  ['world', before.WorldRowsSchema, after.WorldRowsSchema],
  ['boot', before.GeometryBootSchema, after.GeometryBootSchema],
  ['fixed', before.FixedRowsSchema, after.FixedRowsSchema],
  ['atlas', before.SignAtlasSchema, after.SignAtlasSchema],
  ['practice', before.FixedPracticeFileSchema, after.FixedPracticeFileSchema],
] as const;

for (const [name, original, current] of schemas) test(`${name} retains complete native grammar and field refusals`, () => {
  const input = witness(original);
  const admitted = v.safeParse(original, input);
  expect(admitted.success, JSON.stringify(admitted.issues?.map(issue => ({ message: issue.message, path: issue.path?.map(row => row.key) })))).toBe(true);
  expect(result(current, input)).toEqual(result(original, input));
  for (const invalid of [null, [], 'bad', 0, false, { extra: true }])
    expect(result(current, invalid)).toEqual(result(original, invalid));
  for (const [key] of entries(input)) {
    for (const bad of [undefined, null, 'bad', Infinity, -1, [], {}, true]) {
      const changed = Object.fromEntries(entries(input)); changed[key] = bad;
      expect(result(current, changed), `${name}.${key} mutated`).toEqual(result(original, changed));
    }
    const missing = Object.fromEntries(entries(input)); delete missing[key];
    expect(result(current, missing), `${name}.${key} missing`).toEqual(result(original, missing));
  }
  let checked = 0;
  for (const changed of mutations(original, input)) {
    expect(result(current, changed), `${name} nested witness ${String(checked)}`).toEqual(result(original, changed));
    checked++;
  }
  expect(checked).toBeGreaterThan(20);
});

test('original checked profile inputs retain identity, order and complete native values', () => {
  expect(after.parseSignView(signs)).toBe(signs); expect(before.parseSignView(signs)).toBe(signs);
  expect(after.parseSpecimenProfiles(profiles)).toBe(profiles); expect(before.parseSpecimenProfiles(profiles)).toBe(profiles);
  expect(after.parseBurstFields(bursts)).toEqual(before.parseBurstFields(bursts));
  const source = { nodes: [{ name: 'held', mesh: 0, extras: { hull: true, assetRot: [1,0,0,0,1,0,0,0,1] } }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }], unused: true };
  expect(after.parseHeldRigSource(source)).toEqual(before.parseHeldRigSource(source));
});

test('all light pool declarations keep original finite nonnegative bounds and strict fields', () => {
  const number = v.pipe(v.number(), v.finite(), v.minValue(0));
  const original = v.strictObject({ maximum: number,
    lantern: v.strictObject({ k: number, r: number, cut: number, tint: number, redShare: number }),
    shop: v.strictObject({ k: number, rPerW: number, rMin: number, cut: number, out: number, tint: number }),
    lamp: v.strictObject({ k: number, r: number, cut: number, tint: number }),
    sign: v.strictObject({ k: number, rPerSize: number, rMin: number, cut: number }),
    window: v.strictObject({ k: number, r: number, cut: number, out: number }),
  });
  expect(result(LightPoolProfilesSchema, pools)).toEqual(result(original, pools));
  expect(result(LightPoolProfilesSchema, { ...pools, extra: true })).toEqual(result(original, { ...pools, extra: true }));
  for (const changed of mutations(original, pools))
    expect(result(LightPoolProfilesSchema, changed)).toEqual(result(original, changed));
  for (const maximum of [-0, Number.MIN_VALUE, Number.MAX_VALUE, Infinity, -Infinity, Number.NaN])
    expect(result(LightPoolProfilesSchema, { ...pools, maximum })).toEqual(result(original, { ...pools, maximum }));
});

import { expect, expectTypeOf, test } from 'vitest';
import * as v from 'valibot';
import { defineNamedRows, namedJsonSchema } from './formatJsonSchema';

const number = { kind: 'number', finite: true, integer: true, min: -1, max: 8 } as const;
const text = { kind: 'string', min: 1, max: 8, startsWith: 'a' } as const;
const nativeNumber = v.pipe(v.number(), v.finite(), v.integer(), v.minValue(-1), v.maxValue(8));
const nativeText = v.pipe(v.string(), v.minLength(1), v.maxLength(8), v.startsWith('a'));
const shape = defineNamedRows({ kind: 'object', mode: 'strict', entries: {
  n: number, text, enabled: { kind: 'boolean' }, pick: { kind: 'picklist', values: ['a', 'b', 1] },
  list: { kind: 'array', item: number, min: 1, max: 3, length: 2 },
  pair: { kind: 'tuple', items: [number, text] }, constant: { kind: 'literal', value: 'source' },
  maybe: { kind: 'exact-optional', item: { kind: 'nullable', item: number } },
  lookup: { kind: 'record', key: { kind: 'string' }, value: number },
  native: v.literal('native'), nil: { kind: 'null' }, raw: { kind: 'unknown' },
} });
const native = v.strictObject({ n: nativeNumber, text: nativeText, enabled: v.boolean(), pick: v.picklist(['a', 'b', 1]),
  list: v.pipe(v.array(nativeNumber), v.minLength(1), v.maxLength(3), v.length(2)),
  pair: v.tuple([nativeNumber, nativeText]), constant: v.literal('source'), maybe: v.exactOptional(v.nullable(nativeNumber)),
  lookup: v.record(v.string(), nativeNumber), native: v.literal('native'), nil: v.null(), raw: v.unknown() });

function outcome(read: () => unknown): unknown {
  try { return { rows: read() }; }
  catch (error) {
    if (error instanceof v.ValiError) return { issues: JSON.stringify(error.issues) };
    throw error;
  }
}

test('source contracts retain complete mutable object, tuple, optional and native leaf types', () => {
  expectTypeOf<ReturnType<typeof shape.parse>>().toEqualTypeOf<v.InferOutput<typeof native>>();
  const rows: ReturnType<typeof shape.parse> = { n: 2, text: 'a', enabled: true, pick: 1, list: [1, 2], pair: [1, 'a'],
    constant: 'source', lookup: { slot: 1 }, native: 'native', nil: null, raw: null };
  rows.n = 4; rows.pair[0] = 3; rows.list.push(2); rows.list.pop();
  expect(shape.parse(rows)).toEqual(v.parse(native, rows));
  expect(shape.jsonSchema).toEqual(namedJsonSchema(native));
  for (const bad of [null, {}, { ...rows, n: Number.NaN }, { ...rows, n: Infinity }, { ...rows, n: 9 },
    { ...rows, text: 'bad' }, { ...rows, list: [1] }, { ...rows, maybe: undefined },
    { ...rows, pair: [1, 2, 3] }, { ...rows, lookup: { slot: 'bad' } }, { ...rows, extra: true }])
    expect(outcome(() => shape.parse(bad))).toEqual(outcome(() => v.parse(native, bad)));
});

test('strict, strip and loose object modes retain native output, metadata and refusal paths', () => {
  for (const mode of ['strict', 'strip', 'loose'] as const) {
    const compiled = defineNamedRows({ kind: 'object', mode, entries: { n: number } });
    const original = mode === 'strict' ? v.strictObject({ n: nativeNumber }) : mode === 'loose' ? v.looseObject({ n: nativeNumber }) : v.object({ n: nativeNumber });
    expect(outcome(() => compiled.parse({ n: 2, extra: { retained: true } })))
      .toEqual(outcome(() => v.parse(original, { n: 2, extra: { retained: true } })));
    expect(compiled.jsonSchema).toEqual(namedJsonSchema(original));
  }
  const tuple = defineNamedRows({ kind: 'tuple', items: [number, text] });
  expect(tuple.parse([2, 'a', 'strip this'])).toEqual(v.parse(v.tuple([nativeNumber, nativeText]), [2, 'a', 'strip this']));
  const loose = defineNamedRows({ kind: 'object', mode: 'loose', entries: { n: number } });
  expectTypeOf<ReturnType<typeof loose.parse>>().toEqualTypeOf<v.InferOutput<ReturnType<typeof v.looseObject<{ n: typeof nativeNumber }>>>>();
});

test('source refinements keep original order/messages and cannot silently become wire admission', () => {
  const compiled = defineNamedRows(shape.schema, row => row.n < row.pair[0], 'ordered source');
  const original = v.pipe(native, v.check(row => row.n < row.pair[0], 'ordered source'));
  const rows = { n: 3, text: 'a', enabled: true, pick: 1, list: [1, 2], pair: [2, 'a'],
    constant: 'source', lookup: {}, native: 'native', nil: null, raw: null };
  expect(outcome(() => compiled.parse(rows))).toEqual(outcome(() => v.parse(original, rows)));
  expect(outcome(() => compiled.parse({ ...rows, n: Infinity }))).toEqual(outcome(() => v.parse(original, { ...rows, n: Infinity })));
  expect(() => compiled.jsonSchema).toThrow(); expect(() => namedJsonSchema(original)).toThrow();
});

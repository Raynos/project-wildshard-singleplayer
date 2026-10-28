import * as v from 'valibot';
import { expect, test } from 'vitest';
import { recordedSignGroups } from '../src/sdk/bake/signPlacements';
import { readFixedSlots } from '../src/shards/nine-dragon-stack/generators/casts';

const vector = v.tuple([v.number(), v.number(), v.number()]);
const slot = v.strictObject({ at: vector, normal: vector, size: v.number(), color: v.number(), blade: v.boolean() });
const slots = v.strictObject({ early: v.array(slot), late: v.array(slot) });
const before = v.object({ rows: v.object({ slots }) });
type Native = v.InferOutput<typeof slots>;
const types: [ReturnType<typeof readFixedSlots> extends Native ? true : false, Native extends ReturnType<typeof readFixedSlots> ? true : false] = [true, true];
const sample = { at: [0, -0, 3], normal: [0, 0, 1], size: 0.7, color: 0xff0033, blade: true };

test('recorded sign groups retain native order, numbers, stripping and detached rows', () => {
  expect(types).toEqual([true, true]);
  const input = { extra: 1, rows: { ignored: true, slots: { late: [sample], early: [sample, { ...sample, size: Infinity }] } } };
  const original = v.parse(before, input).rows.slots, current = readFixedSlots(input);
  expect(current).toEqual(original);
  expect(Object.keys(current)).toEqual(Object.keys(original));
  expect(current.early[0]?.at[1]).toBe(-0);
  const first = current.early[0];
  if (first === undefined) throw new Error('Missing first slot');
  first.at[0] = 500;
  expect(readFixedSlots(input)).toEqual(original);
  expect(recordedSignGroups({ slots: [sample] }, ['slots'])).toEqual({ slots: [sample] });
});

test('recorded sign groups retain all native parent, strict slot and numeric refusals', () => {
  const row = { early: [sample], late: [] };
  const invalid: unknown[] = [null, [], {}, { rows: null }, { rows: {} }, { rows: { slots: null } },
    { rows: { slots: { ...row, extra: [] } } }, { rows: { slots: { late: [] } } },
  ];
  for (const bad of [null, [], {}, { ...sample, extra: 1 }, { ...sample, size: Number.NaN },
    { ...sample, color: 'red' }, { ...sample, blade: 1 }, { ...sample, normal: [0, 1] }, { ...sample, at: [0, '0', 0] }]) {
    invalid.push({ rows: { slots: { early: [bad], late: [] } } });
  }
  for (const input of invalid) {
    expect(() => v.parse(before, input)).toThrow();
    expect(() => readFixedSlots(input)).toThrow();
  }
});

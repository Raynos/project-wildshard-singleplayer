import { expect, expectTypeOf, test } from 'vitest';
import * as v from 'valibot';
import { authorFormatSchema, namedJsonSchema } from '../src/sdk/formatJsonSchema';
import { ContractBoardPageSchema } from '../src/format/contracts';
import { QuestPageTalksSchema } from '../src/format/npcs';
import { BodySlotsSchema } from '../src/format/bodySlots';
import { SceneFloorSchema } from '../src/format/sceneDressing';
import { HEADLESS_ASSEMBLY_JSON_SCHEMA } from '../src/format/namedJsonContracts';

test('checked board projections retain exact object types, entries and original validators', () => {
  const board = authorFormatSchema('contracts.ContractBoardPageSchema');
  expectTypeOf<typeof board>().toEqualTypeOf<typeof ContractBoardPageSchema>();
  expect(board).toBe(ContractBoardPageSchema);
  expect(board.entries.store).toBe(ContractBoardPageSchema.entries.store);
  const owned = v.omit(board, ['contracts', 'panel', 'store']), native = v.omit(ContractBoardPageSchema, ['contracts', 'panel', 'store']);
  expect(owned.entries).toEqual(native.entries);
  expect(authorFormatSchema('npcs.QuestPageTalksSchema')).toBe(QuestPageTalksSchema);
});

test('composed author metadata and custom admission retain defining identity', () => {
  const slots = authorFormatSchema('bodySlots.BodySlotsSchema'), floor = authorFormatSchema('sceneDressing.SceneFloorSchema');
  expectTypeOf<typeof slots>().toEqualTypeOf<typeof BodySlotsSchema>();
  expectTypeOf<typeof floor>().toEqualTypeOf<typeof SceneFloorSchema>();
  expect(slots).toBe(BodySlotsSchema); expect(floor).toBe(SceneFloorSchema);
  const current = v.strictObject({ slots, floors: v.array(floor) }), native = v.strictObject({ slots: BodySlotsSchema, floors: v.array(SceneFloorSchema) });
  expect(namedJsonSchema(current)).toEqual(namedJsonSchema(native));
  for (const bad of [{}, { slots: { executable: () => 1 }, floors: [] }, { slots: {}, floors: [{ x: Number.POSITIVE_INFINITY }] }]) {
    expect(v.safeParse(current, bad).success).toBe(v.safeParse(native, bad).success);
    expect(v.safeParse(current, bad).success).toBe(false);
  }
  expect(authorFormatSchema('namedJsonContracts.HEADLESS_ASSEMBLY_JSON_SCHEMA')).toBe(HEADLESS_ASSEMBLY_JSON_SCHEMA);
});

test('the finite author surface refuses unknown and prototype selectors', () => {
  for (const key of ['unknown', '__proto__', 'constructor', 'toString'])
    expect(() => { Reflect.apply(authorFormatSchema, undefined, [key]); }).toThrow('Unknown author format');
});

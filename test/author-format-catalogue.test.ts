import { expect, expectTypeOf, test } from 'vitest';
import * as v from 'valibot';
import { authorCatalogueRows, composeNamedJsonSchema, namedJsonSchema } from '../src/sdk/formatJsonSchema';
import { ClaimedPickupSchema } from '../src/format/lootEconomy';
import { ContractBoardPageSchema } from '../src/format/contracts';
import { QuestPageTalksSchema } from '../src/format/npcs';
import { pinePickups } from '../src/shards/pine-hollow/generators/pickups';
import { forestStory } from '../src/shards/pine-hollow/generators/forestStory';
import { WEAPON_FINISHES } from '../src/shards/pine-hollow/generators/weaponFinishes';
import pickups from '../src/shards/pine-hollow/data/skinPickups.json' with { type: 'json' };
import policy from '../src/shards/pine-hollow/data/forestStory.json' with { type: 'json' };
import { PINE_SOURCES } from './fixtures/pine-sources';

const keys = ['ghost-stag', 'hollow-ash', 'ironhide', 'blackpaw', 'imperial', 'warden', 'scarback-furnace'] as const;
const native = v.strictObject({ 'ghost-stag': ClaimedPickupSchema, 'hollow-ash': ClaimedPickupSchema, ironhide: ClaimedPickupSchema,
  blackpaw: ClaimedPickupSchema, imperial: ClaimedPickupSchema, warden: ClaimedPickupSchema, 'scarback-furnace': ClaimedPickupSchema });

test('strict author catalogues preserve all original members, types, order and complete pickup output', () => {
  const original = v.parse(native, pickups);
  const admitted = authorCatalogueRows('lootEconomy.ClaimedPickupSchema', keys, pickups);
  expectTypeOf(admitted).toEqualTypeOf<typeof original>();
  expect(JSON.stringify(admitted)).toBe(JSON.stringify(original));
  const reversed = Object.fromEntries(Object.entries(pickups).reverse());
  expect(JSON.stringify(authorCatalogueRows('lootEconomy.ClaimedPickupSchema', keys, reversed))).toBe(JSON.stringify(original));
  expect(admitted.ironhide).not.toBe(pickups.ironhide);
  const before = v.parse(native, Object.fromEntries(Object.entries(original).map(([id, row]) => {
    const skin = WEAPON_FINISHES[id as keyof typeof WEAPON_FINISHES];
    return [id, { ...row, ...('dropsFrom' in skin ? { death: { ...skin.dropsFrom, floor: 'max' } } : {}) }];
  })));
  expect(JSON.stringify(pinePickups())).toBe(JSON.stringify(before));
});

test('strict author catalogue admission retains missing, unknown and malformed member refusals', () => {
  const missing = Object.fromEntries(Object.entries(pickups).slice(1));
  for (const bad of [null, [], missing, { ...pickups, extra: pickups.ironhide },
    { ...pickups, ironhide: { ...pickups.ironhide, unique: 'true' } }]) {
    expect(() => authorCatalogueRows('lootEconomy.ClaimedPickupSchema', keys, bad)).toThrow();
    expect(() => v.parse(native, bad)).toThrow();
  }
  for (const invalid of [['a', 'a'], ['__proto__'], ['constructor'], ['prototype'], [''],
    Array.from({ length: 1025 }, (_, index) => `row-${index}`)])
    expect(() => authorCatalogueRows('lootEconomy.ClaimedPickupSchema', invalid, {})).toThrow('catalogue keys');
  expect(() => { Reflect.apply(authorCatalogueRows, undefined, ['__proto__', keys, pickups]); }).toThrow('Unknown author format');
  expect(() => { Reflect.apply(authorCatalogueRows, undefined, ['lootEconomy.ClaimedPickupSchema', [1], {}]); }).toThrow('catalogue keys');
});

test('literal composition preserves native finite constants and the complete original forest-story schema', () => {
  for (const value of ['quest', 0, -0, 1.25, true, false])
    expect(composeNamedJsonSchema({ kind: 'literal', value })).toEqual(namedJsonSchema(v.literal(value)));
  for (const value of [Infinity, -Infinity, Number.NaN])
    expect(() => composeNamedJsonSchema({ kind: 'literal', value })).toThrow('finite');
  const original = namedJsonSchema(v.object({ quest: v.literal(policy.quest), spawns: v.literal(policy.spawns),
    board: v.omit(ContractBoardPageSchema, ['contracts', 'panel', 'store']), store: ContractBoardPageSchema.entries.store, talks: QuestPageTalksSchema }));
  const { FOREST_STORY, FOREST_STORY_BLOB } = forestStory(PINE_SOURCES);
  expect(FOREST_STORY_BLOB.file.jsonSchema).toEqual(original);
  expect(JSON.stringify(FOREST_STORY_BLOB.file.jsonSchema)).toBe(JSON.stringify(original));
  expect(new TextDecoder().decode(FOREST_STORY_BLOB.bytes)).toBe(JSON.stringify(FOREST_STORY));
  expect(FOREST_STORY.talks).toEqual(v.parse(QuestPageTalksSchema, policy.talks));
});

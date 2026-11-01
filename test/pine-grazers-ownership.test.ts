import { expect, test } from 'vitest';
import * as v from 'valibot';
import { SECTIONS } from '../src/shards/pine-hollow/generators/sections';
import { SPECIES_LOOKS } from '../src/shards/pine-hollow/generators/nativeView';
import { PINE_SPECIES_PROGRAMS } from '../src/shards/pine-hollow/generators/speciesPrograms';
import { grazerRows } from '../src/shards/pine-hollow/generators/grazers';
import { HullLookBookSchema, HullSpeciesSchema } from '../src/format/speciesLooks';
import { SpeciesProgramsSchema } from '../src/format/speciesPrograms';
import { HullLookBook } from '../src/game/looks/speciesBook';

test('grazers retain their complete platform definitions without a duplicate custom section', () => {
  expect(Object.hasOwn(SECTIONS, 'custom/grazers')).toBe(false);
  const book = v.parse(HullLookBookSchema, SPECIES_LOOKS);
  const authored = grazerRows();
  expect(book.definitions['deer']).toEqual(v.parse(HullSpeciesSchema, authored.deer));
  expect(book.definitions['elk']).toEqual(v.parse(HullSpeciesSchema, authored.elk));
  for (const kind of ['deer', 'elk']) expect(book.rows.some(row => row.kind === kind && row.base === 'definition')).toBe(true);
});

test('deer and elk keep both original page and native species ownership', () => {
  const rows = v.parse(SpeciesProgramsSchema, PINE_SPECIES_PROGRAMS);
  for (const kind of ['deer', 'elk']) {
    expect(rows.native.filter(row => row.kind === kind)).toHaveLength(1);
    expect(rows.page.filter(row => row.kind === kind)).toHaveLength(1);
  }
});

test('the retained hull owner still refuses invalid or missing grazer definitions', () => {
  const authored = grazerRows();
  expect(() => v.parse(HullLookBookSchema, { ...SPECIES_LOOKS, definitions: {
    ...SPECIES_LOOKS.definitions, deer: { ...authored.deer, variants: [{ id: 'broken', label: 'Broken', rarity: 'common', weight: 1, scale: [-1, -2] }] },
  } })).toThrow();
  const { deer, ...definitions } = SPECIES_LOOKS.definitions;
  expect(deer.kind).toBe('deer');
  expect(() => new HullLookBook({ ...SPECIES_LOOKS, definitions })).toThrow('Invalid hull look references');
});

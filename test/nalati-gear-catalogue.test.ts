import { expect, test } from 'vitest';
import { defineSpecimenCatalogue, nameSpecimenBook } from '../src/sdk/bake/specimenCatalogue';
import { encodeCanonicalJson, hashImmutableBytes } from '../src/sdk/immutable';
import { GEAR_BOOK, bow, arrow, sabre, spear, javelin, goldenBow, naizagai, ar15 } from '../src/shards/nalati-grasslands/generators/gear';
import original from '../src/shards/nalati-grasslands/data/gear.json' with { type: 'json' };

const metadata = [bow, arrow, sabre, spear, javelin, goldenBow, naizagai, ar15];
test('all eight authored gear cards retain their original metadata and complete emitted book bytes', () => {
  expect(metadata).toEqual(original.catalogue.map(row => row.model));
  expect(GEAR_BOOK.rows.map(row => row.key)).toEqual(['bow', 'arrow', 'sabre', 'spear', 'javelin', 'goldenBow', 'naizagai', 'ar15']);
  const bytes = new TextEncoder().encode(encodeCanonicalJson(GEAR_BOOK));
  expect(bytes.byteLength).toBe(8840);
  expect(hashImmutableBytes(bytes)).toBe('6e209b5a809ab3f3bef9c7f2884f454471212c8a449a6bc9587e472804bc07b8');
  const emitted = nameSpecimenBook('models/gear-book.json', GEAR_BOOK, { tier: 'phone', dependencies: [] });
  expect(hashImmutableBytes(emitted.bytes)).toBe(hashImmutableBytes(bytes));
  expect(emitted.file).toMatchObject({ name: 'models/gear-book.json', tier: 'phone', dependencies: [] });
  expect(emitted.file.jsonSchema).toBeDefined();
});

test('authoring admission retains strict malformed, duplicate and missing-model refusals', () => {
  expect(() => defineSpecimenCatalogue({ ...GEAR_BOOK, extra: true })).toThrow();
  expect(() => defineSpecimenCatalogue({ ...GEAR_BOOK, rows: [{ key: 'broken', source: { kind: 'packed' } }] })).toThrow();
  const row = GEAR_BOOK.rows[0];
  if (row === undefined) throw new Error('Missing original bow row');
  expect(() => defineSpecimenCatalogue({ ...GEAR_BOOK, rows: [row, row] })).toThrow();
  expect(() => defineSpecimenCatalogue(GEAR_BOOK).model('absent')).toThrow('Missing authored specimen absent');
});

import { expect, test } from 'vitest';
import { defineSpecimenCatalogue, nameSpecimenBook } from '../src/sdk/bake/specimenCatalogue';
import { encodeCanonicalJson, hashImmutableBytes } from '../src/sdk/immutable';
import { GEAR_BOOK, bow, arrow, sabre, spear, javelin, goldenBow, naizagai, ar15 } from '../src/shards/nalati-grasslands/generators/gear';
import original from '../src/shards/nalati-grasslands/data/gear.json' with { type: 'json' };

const metadata = [bow, arrow, sabre, spear, javelin, goldenBow, naizagai, ar15];
test('authored gear cards publish their metadata with content identities', () => {
  expect(metadata).toEqual(original.catalogue.map(row => row.model));
  const bytes = new TextEncoder().encode(encodeCanonicalJson(GEAR_BOOK));
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

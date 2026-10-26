import { nalatiSpecimens } from './fixtures/nalati-specimens';
import { nalatiRuntime } from './fixtures/nalati-runtime';
// oxlint-disable-next-line import/no-nodejs-modules -- Verify the complete original admitted prop bytes.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import * as v from 'valibot';
import { SpecimenCatalogueSchema } from '../src/format/specimenCatalogue';
import { SceneBakedGeometrySchema } from '../src/format/sceneDressing';
import { encodeCanonicalJson, hashImmutableBytes } from '../src/sdk/immutable';
import { makeCarriedQuestRows } from '../src/shards/nalati-grasslands/generators/carriedQuest';
import { carriedQuestRows } from './fixtures/nalati-carried-quest';
import { nalatiQuestProp } from '../src/shards/nalati-grasslands/generators/questProp';

test('computed carried-prop geometry and admitted material preserve the whole original declaration', () => {
  const places = v.parse(v.object({ places: v.object({ rows: v.array(v.object({ name: v.string(),
    meshes: v.array(v.object({ geometry: SceneBakedGeometrySchema })) })) }) }), nalatiRuntime);
  const specimens = v.parse(v.object({ materials: v.object({ poi: v.unknown() }) }), nalatiSpecimens);
  const geometry = places.places.rows.find(row => row.name === 'actor:goat')?.meshes[0]?.geometry;
  if (geometry === undefined) throw new Error('Missing computed quest prop geometry');
  const row = nalatiQuestProp(geometry, specimens.materials.poi), admitted = v.parse(SpecimenCatalogueSchema, [row])[0];
  const bytes = new TextEncoder().encode(`${JSON.stringify(admitted, null, 2)}\n`);
  const original = readFileSync('test/fixtures/nalati-quest-prop-original.json');
  expect(hashImmutableBytes(original)).toBe('b65315ab0b84892f1e20542608c722b5a379d44783a5940b2d85dcef00081782');
  expect(Buffer.compare(bytes, original)).toBe(0);
  expect(row.source.geometry).not.toBe(geometry);
  expect(row.source.material).not.toBe(specimens.materials.poi);
  expect(() => v.parse(SpecimenCatalogueSchema, [nalatiQuestProp(geometry, {})])).toThrow();
  expect(row.source.geometry).toEqual(geometry);
  expect(() => v.parse(SpecimenCatalogueSchema, [nalatiQuestProp({ ...geometry, count: -1 }, specimens.materials.poi)])).toThrow();
});

test('supplied prop declarations retain the complete carried quest with strict refusal', () => {
  const supplied: unknown = JSON.parse(readFileSync('test/fixtures/nalati-quest-prop-original.json', 'utf8'));
  const rows = makeCarriedQuestRows(supplied);
  expect(encodeCanonicalJson(rows)).toBe(encodeCanonicalJson(carriedQuestRows));
  expect(rows.model).not.toBe(carriedQuestRows.model);
  expect(() => makeCarriedQuestRows({})).toThrow();
  expect(() => makeCarriedQuestRows(undefined)).toThrow();
});

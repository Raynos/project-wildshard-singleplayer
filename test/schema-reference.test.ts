// oxlint-disable-next-line import/no-nodejs-modules -- Run the actual Node schema reader from its source root.
import { cwd } from 'node:process';
import { expect, test } from 'vitest';
import { schemaInventory } from '../scripts/docs/schema-reference.mjs';
import { HeldFirearmViewSchema } from '@wildshard/format/weaponProfiles';

test('the firearm view reference covers open objects and their declared nested fields', () => {
  const rows = schemaInventory(HeldFirearmViewSchema);
  expect(rows.find(row => row.path === '$')).toMatchObject({ type: 'loose_object', constraints: ['unknown fields are preserved'] });
  expect(rows.map(row => row.path)).toEqual(expect.arrayContaining(['$.sight.muzzleZ', '$.timing.autoReloadDelay', '$.timing.autoReloadClose', '$.hip.scale']));
  expect(rows.find(row => row.path === '$.timing.autoReloadClose')?.wrappers).toEqual([{ kind: 'exact_optional', default: 'undefined' }]);
});

test('public specimen schemas load through the renderer-free reference reader', async () => {
  const { referenceData } = await import('../scripts/docs/gen-shardfile-reference.mjs');
  const reference = referenceData(cwd());
  expect(reference.fields.some(row => typeof row === 'object' && row !== null && 'path' in row && typeof row.path === 'string' && row.path.startsWith('$sdk["./kit/specimenSchemas"].SpecimenCatalogueSchema'))).toBe(true);
});

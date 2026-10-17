import { expect, test } from 'vitest';
import { schemaInventory } from '../scripts/docs/schema-reference.mjs';
import { HeldFirearmViewSchema } from '@wildshard/format/weaponProfiles';

test('the firearm view reference covers open objects and their declared nested fields', () => {
  const rows = schemaInventory(HeldFirearmViewSchema);
  expect(rows.find(row => row.path === '$')).toMatchObject({ type: 'loose_object', constraints: ['unknown fields are preserved'] });
  expect(rows.map(row => row.path)).toEqual(expect.arrayContaining(['$.sight.muzzleZ', '$.timing.autoReloadDelay', '$.timing.autoReloadClose', '$.hip.scale']));
  expect(rows.find(row => row.path === '$.timing.autoReloadClose')?.wrappers).toEqual([{ kind: 'exact_optional', default: 'undefined' }]);
});

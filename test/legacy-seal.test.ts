import { expect, test } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Read the actual committed policy without changing a frozen copy.
import { cwd } from 'node:process';
import { compareLegacyInventory, legacyInventory, checkLegacyInventory, type LegacyInventory } from '../scripts/legacy-shards.mjs';

const slug = 'demo-legacy';
const before: LegacyInventory = { version: 1, sealed: true, shards: { [slug]: {
  primary: 'demo', source: 'a'.repeat(40), files: { 'manifest.ts': 'b'.repeat(64), 'plugin.ts': 'c'.repeat(64) },
} } };
const fix = 'Legacy-Crash-Fix: repair a load crash';

test('a crash-fix trailer cannot add a file or register its new hash', () => {
  const row = before.shards[slug];
  if (row === undefined) throw new Error('Missing sealed fixture');
  const after = { ...before, shards: { [slug]: { ...row, files: { ...row.files, 'tier.ts': 'd'.repeat(64) } } } };
  const path = `src/shards/${slug}/tier.ts`;
  expect(compareLegacyInventory(before, after, [path], fix)).toContain(`${slug}/tier.ts: sealed legacy copies refuse new files, including crash fixes`);
  expect(compareLegacyInventory(before, before, [path], fix)).toHaveLength(1);
  expect(compareLegacyInventory(before, after, [], fix)).toHaveLength(1);
});

test('existing crash repairs pass, ordinary edits and unsealing refuse', () => {
  const row = before.shards[slug];
  if (row === undefined) throw new Error('Missing sealed fixture');
  const after = { ...before, shards: { [slug]: { ...row, files: { ...row.files, 'plugin.ts': 'd'.repeat(64) } } } };
  const paths = [`src/shards/${slug}/plugin.ts`];
  expect(compareLegacyInventory(before, after, paths, fix)).toEqual([]);
  expect(compareLegacyInventory(before, after, paths, 'feature')).not.toEqual([]);
  expect(compareLegacyInventory(before, { ...before, sealed: false }, [], fix)).toContain('Legacy inventory cannot be unsealed');
  expect(compareLegacyInventory(before, before, [], '')).toEqual([]);
});

test('the committed sealed inventory passes without changing its files', () => {
  const inventory = legacyInventory(cwd());
  expect(inventory.sealed).toBe(true);
  expect(checkLegacyInventory(cwd(), inventory)).toEqual([]);
  expect(compareLegacyInventory(inventory, inventory, [], '')).toEqual([]);
});

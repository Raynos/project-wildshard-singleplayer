import { expect, it } from 'vitest';
import { compareLegacyInventory, registeredLegacyFile } from '../scripts/legacy-shards.mjs';

const row = { primary: 'coast', source: 'a'.repeat(40), files: { 'manifest.ts': 'b'.repeat(64), 'plugin.ts': 'c'.repeat(64) } };
const inventory = { version: 1 as const, sealed: true, shards: { 'coast-legacy': row } };

it('grants historical policy only to exact inventoried files', () => {
  expect(registeredLegacyFile(inventory, 'src/shards/coast-legacy/plugin.ts')).toBe(true);
  expect(registeredLegacyFile(inventory, 'src/shards/coast-legacy/new-feature.ts')).toBe(false);
  expect(registeredLegacyFile(inventory, 'src/shards/other-legacy/plugin.ts')).toBe(false);
  expect(registeredLegacyFile(inventory, 'src/shards/coast/plugin.ts')).toBe(false);
});

it('refuses frozen features and permits a named crash fix without widening provenance', () => {
  const changed = ['src/shards/coast-legacy/plugin.ts'];
  expect(compareLegacyInventory(inventory, inventory, changed, 'Add a new quest')).toEqual([expect.stringContaining('frozen feature edit refused')]);
  expect(compareLegacyInventory(inventory, inventory, changed, 'Fix a crash\n\nLegacy-Crash-Fix: refuse malformed cached state')).toEqual([]);
  const changedSource = { version: 1 as const, sealed: true, shards: { 'coast-legacy': { ...row, source: 'd'.repeat(40) } } };
  expect(compareLegacyInventory(inventory, changedSource, changed, 'Legacy-Crash-Fix: fix crash')).toEqual([expect.stringContaining('immutable legacy provenance')]);
});

it('allows retirement but cannot add a new exemption after bootstrap', () => {
  const retired = { version: 1 as const, sealed: true, shards: {} };
  expect(compareLegacyInventory(inventory, retired, ['src/shards/coast-legacy/plugin.ts'], 'Retire legacy')).toEqual([]);
  expect(compareLegacyInventory(retired, inventory, [], 'Re-add retired copy')).toEqual([expect.stringContaining('can only shrink')]);
  const widened = { version: 1 as const, sealed: true, shards: { ...inventory.shards, 'hill-legacy': { ...row, primary: 'hill' } } };
  expect(compareLegacyInventory(inventory, widened, [], 'Legacy-Crash-Fix: fix crash')).toEqual([expect.stringContaining('can only shrink')]);
});

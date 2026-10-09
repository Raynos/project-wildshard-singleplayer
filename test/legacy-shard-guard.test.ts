// oxlint-disable-next-line import/no-nodejs-modules -- The inventory verifier uses the test export root.
import process from 'node:process';
// oxlint-disable-next-line import/no-nodejs-modules -- Verify the reviewed frozen source byte hashes.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Read the immutable copy fixture and its inventory.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { compareLegacyInventory, legacyManifestRules, registeredLegacyFile, legacyInventory } from '../scripts/legacy-shards.mjs';

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

it('admits only an explicit frozen standalone manifest, never nested flags or grid fields', () => {
  const source = "const m = {slug:'coast-legacy',legacy:true,entries:{legacy:true,shardfile:false,public:'legacy'}}; export default m;";
  expect(legacyManifestRules(source, 'coast-legacy')).toEqual([]);
  expect(legacyManifestRules(source.replace('legacy:true,entries', 'legacy:false,entries'), 'coast-legacy')).toEqual([expect.stringContaining('flagged')]);
  expect(legacyManifestRules(source.replace('entries:', "gridShardfile:'/shardfiles/coast/shard.json',entries:"), 'coast-legacy')).toEqual([expect.stringContaining('cannot join')]);
  expect(legacyManifestRules(source.replace('shardfile:false', 'shardfile:true'), 'coast-legacy')).toEqual([expect.stringContaining('legacy-only')]);
});

it('requires a crash-fix trailer for compatibility provenance changes even when the file digest is unchanged', () => {
  const annotated = { ...inventory, shards: { 'coast-legacy': { ...row, compatibility: {
    'plugin.ts': { original: 'd'.repeat(64), current: row.files['plugin.ts'], reason: 'Reviewed identity-only compatibility' },
  } } } };
  expect(compareLegacyInventory(inventory, annotated, [], 'Add compatibility')).toEqual([expect.stringContaining('crash fixes require')]);
  expect(compareLegacyInventory(inventory, annotated, [], 'Legacy-Crash-Fix: preserve inventoried content identity')).toEqual([]);
});

it('records the exact original and current hashes of the two reviewed identity-only compatibility edits', () => {
  const reviewed = legacyInventory(process.cwd());
  for (const [slug, file, variable, primary] of [
    ['nalati-grasslands-legacy', 'adventure.ts', 'w.chunk.slug', 'nalati-grasslands'],
    ['driftwood-isle-legacy', 'loot/effects.ts', 'o.slug', 'driftwood-isle'],
  ]) {
    const fix = reviewed.shards[slug ?? '']?.compatibility?.[file ?? ''];
    if (fix === undefined || slug === undefined || file === undefined || variable === undefined || primary === undefined) throw new Error('Missing reviewed compatibility fixture');
    const text = readFileSync(`src/shards/${slug}/${file}`, 'utf8');
    const current = createHash('sha256').update(text).digest('hex');
    const original = text.replace("import { shardContentIdentity } from '@wildshard/game/shard/list';\n", '').replace(`shardContentIdentity(${variable})`, variable);
    expect(current).toBe(fix.current);
    expect(createHash('sha256').update(original).digest('hex')).toBe(fix.original);
    expect(text).toContain(`if (shardContentIdentity(${variable}) !== '${primary}')`);
    expect(fix.reason).toContain('without changing its save slug');
  }
});

// oxlint-disable-next-line import/no-nodejs-modules -- Verify generated row bytes in an owned temporary tree.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Own the temporary generator destination.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve exact generated output paths.
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { starterBagPack } from '@wildshard/commons/packs/bag';
import { buildCommons } from '@wildshard/sdk/commons';
import { normalizeItemRow } from '@wildshard/sdk/bag';
import { STARTER_BAG_ITEMS } from '../src/game/bag/starter.generated';
import { genStarterBag, starterBagTableSource } from '../scripts/gen-starter-bag.mjs';

it('packs the unchanged harvest rows deterministically and boot consumes the exact same content', () => {
  const provenance = { credit: 'Fixture publisher', licence: 'Fixture licence' };
  const first = buildCommons([starterBagPack(provenance)]), second = buildCommons([starterBagPack(provenance)]);
  expect(first).toEqual(second);
  const entry = first.catalogue.entries.at(0);
  if (entry === undefined) throw new Error('Missing starter bag catalogue entry');
  expect(entry.hash).toBe('40c8bb21a1e8e77a9404bdc278a077ec78cc84a0fed67ca29f113469a4568670');
  const bytes = first.assets.get(entry.hash);
  if (bytes === undefined) throw new Error('Missing packed bag rows');
  const rows: unknown = JSON.parse(new TextDecoder().decode(bytes));
  expect(STARTER_BAG_ITEMS).toEqual(rows);
  expect(STARTER_BAG_ITEMS).toHaveLength(10);
  expect(STARTER_BAG_ITEMS.map(normalizeItemRow).every(row => !row.travels)).toBe(true);
  expect(readFileSync('src/game/bag/starter.generated.ts', 'utf8')).toBe(starterBagTableSource());
});

it('regenerates a missing or stale runtime table solely from the pack, without runtime commons imports', () => {
  const root = mkdtempSync(join(tmpdir(), 'starter-bag-'));
  try {
    const path = join(root, 'src/game/bag/starter.generated.ts');
    genStarterBag(root);
    const source = readFileSync(path, 'utf8');
    expect(source).toBe(starterBagTableSource());
    expect(source).not.toMatch(/\bimport\b/u);
    writeFileSync(path, 'stale table');
    genStarterBag(root);
    expect(readFileSync(path, 'utf8')).toBe(source);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

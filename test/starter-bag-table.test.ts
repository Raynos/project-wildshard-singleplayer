// oxlint-disable-next-line import/no-nodejs-modules -- Verify generated row bytes in an owned temporary tree.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Own the temporary generator destination.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve exact generated output paths.
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import { normalizeItemRow } from '@wildshard/sdk/bag';
import { STARTER_BAG_ITEMS } from '../src/game/bag/starter.generated';
import items from '../src/game/bag/starterItems.json' with { type: 'json' };
import { genStarterBag, starterBagTableSource } from '../scripts/gen-starter-bag.mjs';

it('keeps the unchanged harvest rows and boot consumes the exact same content', () => {
  const bytes = new TextEncoder().encode(JSON.stringify(items));
  // Frozen from the former commons bag pack bytes: catches any changed row, field or order.
  expect(hashImmutableBytes(bytes)).toBe('40c8bb21a1e8e77a9404bdc278a077ec78cc84a0fed67ca29f113469a4568670');
  expect(STARTER_BAG_ITEMS).toEqual(items);
  expect(STARTER_BAG_ITEMS).toHaveLength(10);
  expect(STARTER_BAG_ITEMS.map(normalizeItemRow).every(row => !row.travels)).toBe(true);
  expect(readFileSync('src/game/bag/starter.generated.ts', 'utf8')).toBe(starterBagTableSource());
});

it('regenerates a missing or stale runtime table solely from the authored rows, without runtime imports', () => {
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

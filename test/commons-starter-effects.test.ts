// oxlint-disable-next-line import/no-nodejs-modules -- Compare generated runtime data with its build-only pack.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { starterEffectsPack } from '@wildshard/commons/packs/effects';
import { buildCommons } from '@wildshard/sdk/commons';
import { STARTER_EFFECTS } from '@wildshard/sdk/runtime/effects';
import { starterEffectsTableSource } from '../scripts/gen-starter-effects.mjs';

it('preserves the five authored status rows and derives the runtime table from deterministic pack bytes', () => {
  const provenance = { credit: 'Fixture publisher', licence: 'Fixture licence' };
  const first = buildCommons([starterEffectsPack(provenance)]), second = buildCommons([starterEffectsPack(provenance)]);
  expect(first).toEqual(second);
  const entry = first.catalogue.entries[0];
  if (entry === undefined) throw new Error('Missing effects pack');
  expect(entry.hash).toBe('05a0699d225fca32613cd9fdb852a00973e819d539f0aea047a7f77c6cfa1a75');
  const bytes = first.assets.get(entry.hash);
  if (bytes === undefined) throw new Error('Missing status row bytes');
  const rows: unknown = JSON.parse(new TextDecoder().decode(bytes));
  expect(STARTER_EFFECTS).toEqual(rows);
  expect(STARTER_EFFECTS).toHaveLength(5);
  expect(readFileSync('src/game/systems/effects/starter.generated.ts', 'utf8')).toBe(starterEffectsTableSource());
});

// oxlint-disable-next-line import/no-nodejs-modules -- Compare generated runtime data with its authored rows.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import { STARTER_EFFECTS } from '@wildshard/sdk/runtime/effects';
import { starterEffectsTableSource } from '../scripts/gen-starter-effects.mjs';
import rows from '../src/game/systems/effects/starterRows.json' with { type: 'json' };

it('preserves the five authored status rows and derives the runtime table from them', () => {
  // Frozen from the former commons effects pack bytes: catches any changed row, field or order.
  expect(hashImmutableBytes(new TextEncoder().encode(JSON.stringify(rows)))).toBe('05a0699d225fca32613cd9fdb852a00973e819d539f0aea047a7f77c6cfa1a75');
  expect(STARTER_EFFECTS).toEqual(rows);
  expect(STARTER_EFFECTS).toHaveLength(5);
  expect(readFileSync('src/game/systems/effects/starter.generated.ts', 'utf8')).toBe(starterEffectsTableSource());
});

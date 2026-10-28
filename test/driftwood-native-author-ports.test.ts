import { expect, expectTypeOf, test } from 'vitest';
import type * as v from 'valibot';
import type { MeleeWeaponProfileSchema } from '../src/format/weaponProfiles';
import type { parseMeleeWeaponProfile } from '../src/sdk/weapons/meleeProfile';
import type { Placement } from '../src/engine/models/model';
import type { originalDuneLogs } from '../src/shards/driftwood-isle/generators/driftwoodDuneLogs.mjs';
import { DRIFTWOOD_MELEE_PROFILE, DRIFTWOOD_IRON_PROFILE } from '../src/shards/driftwood-isle/generators/meleeProfile';
import { hashImmutableBytes } from '../src/sdk/immutable';
import original from './fixtures/driftwood-melee-ports-original.json' with { type: 'json' };

test('native author ports retain every melee field and complete drawn-log placement contract', () => {
  expectTypeOf<ReturnType<typeof parseMeleeWeaponProfile>>().toEqualTypeOf<v.InferOutput<typeof MeleeWeaponProfileSchema>>();
  interface LogParams { len: number; r0: number; r1: number; tone: number }
  type DrawnLog = ReturnType<typeof originalDuneLogs>['catalogue']['placements'][number];
  expectTypeOf<DrawnLog>().toEqualTypeOf<Placement<LogParams>>();
  const values: NonNullable<DrawnLog['params']> = { len: 3.1, r0: .21, r1: .13, tone: 2 };
  values.len = 5; expect(values).toEqual({ len: 5, r0: .21, r1: .13, tone: 2 });
});

test('both complete original melee contact profiles retain every byte', () => {
  const bytes = new TextEncoder().encode(JSON.stringify({ wood: DRIFTWOOD_MELEE_PROFILE, iron: DRIFTWOOD_IRON_PROFILE }));
  expect({ bytes: bytes.byteLength, hash: hashImmutableBytes(bytes) }).toEqual(original);
});

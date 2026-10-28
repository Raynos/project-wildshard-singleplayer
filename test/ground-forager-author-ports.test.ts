import { expect, expectTypeOf, test } from 'vitest';
import * as v from 'valibot';
import { authorFormatSchema, authorFormatRows } from '../src/sdk/formatJsonSchema';
import type { AuthorDayClock } from '../src/sdk/rows';
import type { DayClockRow } from '../src/format/dayCycle';
import { nativeBodySchema, nativeColliderRecordSchema, nativeGroundRecordSchema } from '../src/format/nativePhysics';
import { ForagerContinuation } from '../src/format/ambientLife';
import type { DuskLookRow } from '../src/shards/sunscar-dunes/generators/rows/lastLight';

test('native physics grammar factories and forager continuation retain exact identity and signatures', () => {
  const body = authorFormatSchema('nativePhysics.nativeBodySchema');
  const solid = authorFormatSchema('nativePhysics.nativeColliderRecordSchema');
  const ground = authorFormatSchema('nativePhysics.nativeGroundRecordSchema');
  const forager = authorFormatSchema('ambientLife.ForagerContinuation');
  expect(body).toBe(nativeBodySchema); expect(solid).toBe(nativeColliderRecordSchema);
  expect(ground).toBe(nativeGroundRecordSchema); expect(forager).toBe(ForagerContinuation);
  expectTypeOf<typeof body>().toEqualTypeOf<typeof nativeBodySchema>();
  expectTypeOf<typeof solid>().toEqualTypeOf<typeof nativeColliderRecordSchema>();
  expectTypeOf<typeof ground>().toEqualTypeOf<typeof nativeGroundRecordSchema>();
  expectTypeOf<AuthorDayClock>().toEqualTypeOf<DayClockRow>();
  expectTypeOf<DuskLookRow['clock']>().toEqualTypeOf<DayClockRow>();
  expect(() => authorFormatRows('ambientLife.ForagerContinuation', { extra: 1 })).toThrow(v.ValiError);
});

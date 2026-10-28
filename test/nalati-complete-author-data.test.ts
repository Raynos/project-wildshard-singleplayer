import { expect, expectTypeOf, test } from 'vitest';
import type { AuthorFigureAtlas, AuthorExternalElite, AuthorDayLook } from '../src/sdk/rows';
import type { FigureAtlasRow } from '../src/format/figures';
import type { ExternalEliteData } from '../src/format/eliteFeature';
import type { DayLookRow } from '../src/format/dayLook';
import type { SkySchema } from '../src/shards/nalati-grasslands/data/skyTypes';
import { scriptV1ReferenceKinds } from '../src/sdk/decisionScripts';
import { SCRIPT_V1_REFERENCE_KINDS } from '../src/format/decisionScripts';
import { ridingPracticeRows, type AuthorRidingPracticeLayout } from '../src/sdk/bake/practiceCourse';
import { parseRidingPractice, type RidingPracticeLayout } from '../src/format/practiceCourseRows';
import { horseCourseRows } from '../src/shards/nalati-grasslands/generators/courseScene';
import { NALATI_KOKPAR } from './fixtures/nalati-kokpar';

test('offline metadata retains complete native atlas, elite, keyed-look and course types', () => {
  expectTypeOf<AuthorFigureAtlas>().toEqualTypeOf<FigureAtlasRow>();
  expectTypeOf<AuthorExternalElite>().toEqualTypeOf<ExternalEliteData>();
  expectTypeOf<AuthorDayLook<SkySchema>>().toEqualTypeOf<DayLookRow<SkySchema>>();
  expectTypeOf<AuthorRidingPracticeLayout>().toEqualTypeOf<RidingPracticeLayout>();
  expectTypeOf<ReturnType<typeof scriptV1ReferenceKinds>>().toEqualTypeOf<typeof SCRIPT_V1_REFERENCE_KINDS>();
  expect(scriptV1ReferenceKinds()).toBe(SCRIPT_V1_REFERENCE_KINDS);
});

test('course admission keeps the complete native output and non-schema program refusals', () => {
  const rows = horseCourseRows(NALATI_KOKPAR.course);
  expect(JSON.stringify(ridingPracticeRows(rows))).toBe(JSON.stringify(parseRidingPractice(rows)));
  for (const invalid of [
    { ...rows, update: () => 0 },
    { ...rows, program: {} },
    { ...rows, actor: { ...rows.actor, variant: () => 0 } },
    { ...rows, controller: { ...rows.controller, signals: { step: 'undeclared' } } },
  ]) {
    expect(() => parseRidingPractice(invalid)).toThrow();
    expect(() => ridingPracticeRows(invalid)).toThrow();
  }
});

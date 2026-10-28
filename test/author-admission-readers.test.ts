import { expect, expectTypeOf, test } from 'vitest';
import type * as v from 'valibot';
import type { SpecimenBindings } from '../src/shards/nalati-grasslands/data/specimenBindings';
import type { SpecimenMaterialSchema, PackedSpecimenSchema, SpecimenCatalogueSchema } from '../src/format/specimenCatalogue';
import { driftwoodPageAdmissionObservation } from './fixtures/driftwood-page-admission-observation';
import original from './fixtures/driftwood-page-admission-original.json' with { type: 'json' };

test('specimen declarations retain complete native material, packed and catalogue contracts', () => {
  expectTypeOf<SpecimenBindings['materials']['poi']>().toEqualTypeOf<v.InferOutput<typeof SpecimenMaterialSchema>>();
  expectTypeOf<SpecimenBindings['packed']>().toEqualTypeOf<v.InferOutput<typeof PackedSpecimenSchema>>();
  expectTypeOf<SpecimenBindings['catalogue'][number]>().toEqualTypeOf<v.InferOutput<typeof SpecimenCatalogueSchema>[number]>();
});

test('every original page lifetime, story, director and native-mechanics wire remains unchanged', () => {
  expect(driftwoodPageAdmissionObservation()).toEqual(original);
});

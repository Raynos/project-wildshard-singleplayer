import { expectTypeOf, test } from 'vitest';
import * as v from 'valibot';
import { SpecimenCatalogueSchema, PackedSpecimenSchema, SpecimenMaterialSchema, SpecimenAssetSchema } from '../src/format/specimenCatalogue';
import type { nalatiDressingSpecimens } from '../src/shards/nalati-grasslands/generators/dressingScene';

test('dressing specimens retain the complete native mutable object and record contract', () => {
  const original = v.object({ catalogue: SpecimenCatalogueSchema, packed: PackedSpecimenSchema,
    materials: v.record(v.string(), SpecimenMaterialSchema), assets: v.record(v.string(), SpecimenAssetSchema) });
  expectTypeOf<ReturnType<typeof nalatiDressingSpecimens>>().toEqualTypeOf<v.InferOutput<typeof original>>();
  expectTypeOf<ReturnType<typeof nalatiDressingSpecimens>>().toExtend<Record<string, unknown>>();
});

import type * as v from 'valibot';
import type { SpecimenCatalogueSchema, SpecimenMaterialSchema, PackedSpecimenSchema } from '@wildshard/format/specimenCatalogue';

type SpecimenModelRow = v.InferOutput<typeof SpecimenCatalogueSchema>[number];
type SpecimenMaterialRow = v.InferOutput<typeof SpecimenMaterialSchema>;
type SpecimenAssetRow = Extract<SpecimenModelRow['source'], { readonly kind: 'asset' }>['asset'];
type PackedSpecimenBake = v.InferOutput<typeof PackedSpecimenSchema>;
type NalatiTexName = 'meadow' | 'path' | 'gravel' | 'rock' | 'snow' | 'bark' | 'felt';

/** Pre-admission asset and surface bindings emitted by the specimen baker. */
export interface SpecimenBindings {
  readonly catalogue: readonly SpecimenModelRow[];
  readonly packed: PackedSpecimenBake;
  readonly materials: { readonly poi: SpecimenMaterialRow } & Readonly<Record<NalatiTexName, SpecimenMaterialRow & { readonly texture: NonNullable<SpecimenMaterialRow['texture']> }>>;
  readonly assets: Readonly<Record<'kazan' | 'chest' | 'firewood' | 'kumisChurn' | 'groundSaddle' | 'perchedEagle' | 'watchtower' | 'saddledHorse' | 'kokparRider' | 'herdHorse' | 'snowLotus' | 'kokparRiderFar' | 'boulder-1' | 'boulder-2' | 'boulder-3' | 'balbal', SpecimenAssetRow>>;
}

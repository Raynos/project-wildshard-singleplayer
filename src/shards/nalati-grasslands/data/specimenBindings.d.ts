import type { authorFormatRows } from '@wildshard/sdk/formatJsonSchema';

type SpecimenModelRow = ReturnType<typeof authorFormatRows<'specimenCatalogue.SpecimenCatalogueSchema'>>[number];
type SpecimenMaterialRow = ReturnType<typeof authorFormatRows<'specimenCatalogue.SpecimenMaterialSchema'>>;
type SpecimenAssetRow = Extract<SpecimenModelRow['source'], { readonly kind: 'asset' }>['asset'];
type PackedSpecimenBake = ReturnType<typeof authorFormatRows<'specimenCatalogue.PackedSpecimenSchema'>>;
type NalatiTexName = 'meadow' | 'path' | 'gravel' | 'rock' | 'snow' | 'bark' | 'felt';

/** Pre-admission asset and surface bindings emitted by the specimen baker. */
export interface SpecimenBindings {
  readonly catalogue: readonly SpecimenModelRow[];
  readonly packed: PackedSpecimenBake;
  readonly materials: { readonly poi: SpecimenMaterialRow } & Readonly<Record<NalatiTexName, SpecimenMaterialRow & { readonly texture: NonNullable<SpecimenMaterialRow['texture']> }>>;
  readonly assets: Readonly<Record<'kazan' | 'chest' | 'firewood' | 'kumisChurn' | 'groundSaddle' | 'perchedEagle' | 'watchtower' | 'saddledHorse' | 'kokparRider' | 'herdHorse' | 'snowLotus' | 'kokparRiderFar' | 'boulder-1' | 'boulder-2' | 'boulder-3' | 'balbal', SpecimenAssetRow>>;
}

import { SpecimenCatalogueSchema as Catalogue, PackedSpecimenSchema as Packed, SpecimenMaterialSchema as Material } from '@wildshard/format/specimenCatalogue';

/** Renderer-free parameterized model catalogue validation. */
export const SpecimenCatalogueSchema: typeof Catalogue = Catalogue;
/** Renderer-free packed specimen geometry validation. */
export const PackedSpecimenSchema: typeof Packed = Packed;
/** Renderer-free world/specimen material binding validation. */
export const SpecimenMaterialSchema: typeof Material = Material;

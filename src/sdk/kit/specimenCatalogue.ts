import {
  SpecimenCatalogueSchema as HostSpecimenCatalogueSchema, PackedSpecimenSchema as HostPackedSpecimenSchema,
  defineSpecimenCatalogue as hostDefineSpecimenCatalogue, createPackedSpecimens as hostCreatePackedSpecimens,
  specimenKey as hostSpecimenKey, specimenMaterial as hostSpecimenMaterial, loadSpecimenTexture as hostLoadSpecimenTexture,
  loadSpecimenAsset as hostLoadSpecimenAsset, loadBoundSpecimen as hostLoadBoundSpecimen, awaitSpecimenAssets as hostAwaitSpecimenAssets,
  type SpecimenModelRow as HostSpecimenModelRow, type SpecimenMaterialRow as HostSpecimenMaterialRow,
  type SpecimenAssetRow as HostSpecimenAssetRow, type PackedSpecimenBake as HostPackedSpecimenBake,
} from '@wildshard/game/models/specimenCatalogue';

/** Validated JSON catalogue wire schema, with no executable extension fields. */
export const SpecimenCatalogueSchema: typeof HostSpecimenCatalogueSchema = HostSpecimenCatalogueSchema;
/** Exact packed-geometry wire schema; part order and byte layout remain authored data. */
export const PackedSpecimenSchema: typeof HostPackedSpecimenSchema = HostPackedSpecimenSchema;

/** A complete lazy catalogue declaration, including parameters, assets and material bindings. */
export type SpecimenModelRow = HostSpecimenModelRow;
/** A shared per-world material declaration. */
export type SpecimenMaterialRow = HostSpecimenMaterialRow;
/** Declared GLB geometry and material slots, optional phone file and retained authoring channel. */
export type SpecimenAssetRow = HostSpecimenAssetRow;
/** Exact packed geometry rows and the compressed, lane-shuffled binary they cover. */
export type PackedSpecimenBake = HostPackedSpecimenBake;
/** Register definitions with data-only parameter and specimen selection. Assets load only when viewed. */
export const defineSpecimenCatalogue: typeof hostDefineSpecimenCatalogue = hostDefineSpecimenCatalogue;
/** One immutable packed binary, with explicit Node/test byte admission. */
export const createPackedSpecimens: typeof hostCreatePackedSpecimens = hostCreatePackedSpecimens;
/** The model/parameter key the offline bake and catalogue both use. */
export const specimenKey: typeof hostSpecimenKey = hostSpecimenKey;
/** Borrow a declared material from the same cache as its live world owner. */
export const specimenMaterial: typeof hostSpecimenMaterial = hostSpecimenMaterial;
/** Share a declared texture with live world surfaces. */
export const loadSpecimenTexture: typeof hostLoadSpecimenTexture = hostLoadSpecimenTexture;
/** Borrow a prepared primitive without fitting or repainting it. */
export const loadSpecimenAsset: typeof hostLoadSpecimenAsset = hostLoadSpecimenAsset;
/** Share one prepared primitive and material promise with the world. */
export const loadBoundSpecimen: typeof hostLoadBoundSpecimen = hostLoadBoundSpecimen;
/** Await assets already requested by this world, without starting loads. */
export const awaitSpecimenAssets: typeof hostAwaitSpecimenAssets = hostAwaitSpecimenAssets;

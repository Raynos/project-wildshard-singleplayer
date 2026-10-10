import { buildPrimitive as platformBuildPrimitive, mergePrimitives as platformMergePrimitives, standardMaterial as platformStandardMaterial, type PrimitiveKind as PlatformPrimitiveKind, type PrimitiveOp as PlatformPrimitiveOp, type PrimitiveRow as PlatformPrimitiveRow, type StandardMaterialRow as PlatformStandardMaterialRow } from '@wildshard/game/systems/kit/mergedPrimitives';

/** A primitive's kind (its three.js constructor's arguments in order). */
export type PrimitiveKind = PlatformPrimitiveKind;
/** One transform applied by the geometry's own method. */
export type PrimitiveOp = PlatformPrimitiveOp;
/** One primitive as data (SHARD-PLATFORM M3): its kind, arguments and transforms in order. */
export type PrimitiveRow = PlatformPrimitiveRow;
/** A MeshStandardMaterial as data. */
export type StandardMaterialRow = PlatformStandardMaterialRow;
/** Builds one primitive with its transforms applied in order. */
export const buildPrimitive: typeof platformBuildPrimitive = platformBuildPrimitive;
/** Builds the rows, each non-indexed, merged in order into one geometry keeping their own attributes. */
export const mergePrimitives: typeof platformMergePrimitives = platformMergePrimitives;
/** Makes a MeshStandardMaterial from its row. */
export const standardMaterial: typeof platformStandardMaterial = platformStandardMaterial;

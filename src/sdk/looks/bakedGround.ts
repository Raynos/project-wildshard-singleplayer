import { CubeSkirt as PlatformCubeSkirt, loadBakedMaps as platformLoadBakedMaps, mappedFamilyMaterial as platformMappedFamilyMaterial, skirtGrid as platformSkirtGrid, swellSkirtAt as platformSwellSkirtAt, TintedTileGround as PlatformTintedTileGround, type BakedMapRow as PlatformBakedMapRow, type SkirtGridRow as PlatformSkirtGridRow, type SkirtOwner as PlatformSkirtOwner, type SwellSkirtRow as PlatformSwellSkirtRow, type TileTint as PlatformTileTint, type TintedTileOptions as PlatformTintedTileOptions } from '@wildshard/game/systems/looks/bakedGround';

/** One offline-baked ground map: its zlib file of raw bytes, size, channels (1 red mask / 4 RGBA tile) and stand-in byte. */
export type BakedMapRow = PlatformBakedMapRow;
/** The skirt's swells past the ground's square edge, along the wind, as data. */
export type SwellSkirtRow = PlatformSwellSkirtRow;
/** The skirt grid's reach, cell and the sink under the ground inside its edge. */
export type SkirtGridRow = PlatformSkirtGridRow;
/** What owns a held skirt's geometry (a level scope). */
export type SkirtOwner = PlatformSkirtOwner;
/** A terrain tile vertex's tint, written into the tile's colour buffer. */
export type TileTint = PlatformTileTint;
/** A tinted tile ground's runtime source, residency start, follow distance and fault names. */
export type TintedTileOptions = PlatformTintedTileOptions;
/** Every baked map of a row set, uploaded as DataTextures (a failed map is a page fault and stands in). */
export const loadBakedMaps: typeof platformLoadBakedMaps = platformLoadBakedMaps;
/** The skirt's height at (x, z): the ground inside its edge, swells along the wind outside. */
export const swellSkirtAt: typeof platformSwellSkirtAt = platformSwellSkirtAt;
/** The skirt as one indexed grid with smooth normals and one vertex colour. */
export const skirtGrid: typeof platformSkirtGrid = platformSkirtGrid;
/** A skirt held for a grid cell's cube cut. */
export const CubeSkirt: typeof PlatformCubeSkirt = PlatformCubeSkirt;
/** A held skirt (the instance type). */
export type CubeSkirtView = PlatformCubeSkirt;
/** A ground drawn from its runtime-bound shardfile terrain tiles in the caller's material and vertex tint. */
export const TintedTileGround: typeof PlatformTintedTileGround = PlatformTintedTileGround;
/** A tinted tile ground (the instance type). */
export type TintedTileGroundView = PlatformTintedTileGround;
/** An engine family material whose texture refs name the caller's maps. */
export const mappedFamilyMaterial: typeof platformMappedFamilyMaterial = platformMappedFamilyMaterial;

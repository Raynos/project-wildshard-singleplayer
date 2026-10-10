import { bakedPropsMaterial as platformBakedPropsMaterial, bakedTerrainMaterial as platformBakedTerrainMaterial, clipGridTerrain as platformClipGridTerrain, clipInstancedRect as platformClipInstancedRect, decodeFloatBlock as platformDecodeFloatBlock, droppedPlacements as platformDroppedPlacements, dropNearestTriangles as platformDropNearestTriangles, dropTriangles as platformDropTriangles, encodeFloatBlock as platformEncodeFloatBlock, placementSets as platformPlacementSets, protosFromMeshes as platformProtosFromMeshes, simplifiedProto as platformSimplifiedProto, simplifierReady as platformSimplifierReady, sunBounceLevel as platformSunBounceLevel, tileRect as platformTileRect, usedPlacements as platformUsedPlacements, type BakedPropsRow as PlatformBakedPropsRow, type BakedTerrainRow as PlatformBakedTerrainRow, type IslandCoverFade as PlatformIslandCoverFade, type IslandPatchRow as PlatformIslandPatchRow, type IslandProto as PlatformIslandProto, type IslandRect as PlatformIslandRect, type PlacementSets as PlatformPlacementSets, type PlacementSetsRow as PlatformPlacementSetsRow } from '@wildshard/game/systems/looks/bakedIsland';

/** A baked prototype: world-space positions, Uint8 RGBA (alpha: its baked AO), index (SHARD-PLATFORM M3). */
export type IslandProto = PlatformIslandProto;
/** An axis-aligned rect in world xz. */
export type IslandRect = PlatformIslandRect;
/** A patch as data: patch id, program key, edit rows. */
export type IslandPatchRow = PlatformIslandPatchRow;
/** The baked terrain's material settings and patch. */
export type BakedTerrainRow = PlatformBakedTerrainRow;
/** The baked props' material settings and patches (AO, tint, cover fade). */
export type BakedPropsRow = PlatformBakedPropsRow;
/** A cover fade's reach and program key. */
export type IslandCoverFade = PlatformIslandCoverFade;
/** How the placements sort into sets and tiles. */
export type PlacementSetsRow = PlatformPlacementSetsRow;
/** The placements by set and tile, and the ones set apart. */
export type PlacementSets = PlatformPlacementSets;
/** The baked terrain's toon material. */
export const bakedTerrainMaterial: typeof platformBakedTerrainMaterial = platformBakedTerrainMaterial;
/** The baked props' toon material (tint, cover fade). */
export const bakedPropsMaterial: typeof platformBakedPropsMaterial = platformBakedPropsMaterial;
/** Collapses the instances of a material whose origin is inside a rect. */
export const clipInstancedRect: typeof platformClipInstancedRect = platformClipInstancedRect;
/** Keeps only the triangles a test accepts (centroid, world xz). */
export const dropTriangles: typeof platformDropTriangles = platformDropTriangles;
/** The procedural terrain loses a rect's whole cells. */
export const clipGridTerrain: typeof platformClipGridTerrain = platformClipGridTerrain;
/** Drops the triangles whose nearest point a test names. */
export const dropNearestTriangles: typeof platformDropNearestTriangles = platformDropNearestTriangles;
/** A prototype's far copy, simplified with meshoptimizer. */
export const simplifiedProto: typeof platformSimplifiedProto = platformSimplifiedProto;
/** Resolves once meshoptimizer's simplifier is loaded. */
export const simplifierReady: typeof platformSimplifierReady = platformSimplifierReady;
/** The prototypes from a loaded scene's meshes. */
export const protosFromMeshes: typeof platformProtosFromMeshes = platformProtosFromMeshes;
/** The placements file with each y lowered. */
export const droppedPlacements: typeof platformDroppedPlacements = platformDroppedPlacements;
/** How many placements a tier builds. */
export const usedPlacements: typeof platformUsedPlacements = platformUsedPlacements;
/** The placements by set and tile. */
export const placementSets: typeof platformPlacementSets = platformPlacementSets;
/** One tile of a rect. */
export const tileRect: typeof platformTileRect = platformTileRect;
/** A baked float block's file. */
export const encodeFloatBlock: typeof platformEncodeFloatBlock = platformEncodeFloatBlock;
/** A baked float block read back, or null when it does not fit. */
export const decodeFloatBlock: typeof platformDecodeFloatBlock = platformDecodeFloatBlock;
/** The live sun's share of a baked bounce. */
export const sunBounceLevel: typeof platformSunBounceLevel = platformSunBounceLevel;

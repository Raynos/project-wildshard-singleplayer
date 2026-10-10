import { buildKitMesh as platformBuildKitMesh, type KitMeshRow as PlatformKitMeshRow, type KitPartKind as PlatformKitPartKind, type KitPartRow as PlatformKitPartRow } from '@wildshard/game/systems/kit/kitParts';

/** A low-poly kit mesh as data (SHARD-PLATFORM M3): the kit's seed, its finish and its primitive parts in add order. */
export type KitMeshRow = PlatformKitMeshRow;
/** One part of a kit mesh as data: a primitive, its colour, pre-transform, placement and the kit's options. */
export type KitPartRow = PlatformKitPartRow;
/** A kit part's primitive kind. */
export type KitPartKind = PlatformKitPartKind;
/** Builds a low-poly kit mesh's geometry from its row (one flat-shaded, vertex-coloured geometry). */
export const buildKitMesh: typeof platformBuildKitMesh = platformBuildKitMesh;

import { TiledInstances as PlatformTiledInstances, coverTrianglesOf as platformCoverTrianglesOf, edgeOf as platformEdgeOf, type CoverTriangle as PlatformCoverTriangle, type InstProto as PlatformInstProto, type InstanceSetSpec as PlatformInstanceSetSpec, type TileRect as PlatformTileRect } from '@wildshard/game/systems/looks/instancedTiles';

/** A prototype the tiles draw: positions, Uint8 RGBA (alpha: its baked AO), index (SHARD-PLATFORM M3). */
export type InstProto = PlatformInstProto;
/** A tile's rect in the group's xz. */
export type TileRect = PlatformTileRect;
/** One tile set: its placements per tile, rects, material and how it draws. */
export type InstanceSetSpec = PlatformInstanceSetSpec;
/** One cover triangle in world space and its mean tinted colour. */
export type CoverTriangle = PlatformCoverTriangle;
/** A placement's own edge in the cover's reach (0..1), hashed from where it stands. */
export const edgeOf: typeof platformEdgeOf = platformEdgeOf;
/** The cover sets' triangles in world space, in the tiles' order (a bake walks the same ones the page does). */
export const coverTrianglesOf: typeof platformCoverTrianglesOf = platformCoverTrianglesOf;
/** Tiled instanced placements: one InstancedMesh per prototype × set, repacked per tile as the view moves. */
export const TiledInstances: typeof PlatformTiledInstances = PlatformTiledInstances;
/** A tiled instanced placement set (the class's instances). */
export type TiledInstanceSet = PlatformTiledInstances;

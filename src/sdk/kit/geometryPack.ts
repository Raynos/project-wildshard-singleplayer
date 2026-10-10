import { GeometryPack as PlatformGeometryPack, fetchDeflated as platformFetchDeflated, type PackedGeometryRow as PlatformPackedGeometryRow, type PackedGeometryRows as PlatformPackedGeometryRows } from '@wildshard/game/systems/kit/geometryPack';

/** One packed geometry's row (SHARD-PLATFORM M3, the kit system). */
export type PackedGeometryRow = PlatformPackedGeometryRow;
/** A pack's rows: its byte size and its geometries in byte order. */
export type PackedGeometryRows = PlatformPackedGeometryRows;
/** A decoded pack of float32 geometries: each read fresh as the builder made it. */
export const GeometryPack: typeof PlatformGeometryPack = PlatformGeometryPack;
/** Fetch a zlib-deflated bake and inflate it. */
export const fetchDeflated: typeof platformFetchDeflated = platformFetchDeflated;

import { GeometryPack as PlatformGeometryPack, GeometryPackWriter as PlatformGeometryPackWriter, packedRows as platformPackedRows, type PackedGeometryJson as PlatformPackedGeometryJson, type PackedGroup as PlatformPackedGroup, fetchDeflated as platformFetchDeflated, type PackedGeometryRow as PlatformPackedGeometryRow, type PackedGeometryRows as PlatformPackedGeometryRows } from '@wildshard/game/systems/kit/geometryPack';

/** One draw group of a packed geometry. */
export type PackedGroup = PlatformPackedGroup;
/** One packed geometry's row (SHARD-PLATFORM M3, the kit system). */
export type PackedGeometryRow = PlatformPackedGeometryRow;
/** A pack's rows: its byte size and its geometries in byte order. */
export type PackedGeometryRows = PlatformPackedGeometryRows;
/** A pack's rows as JSON holds them. */
export type PackedGeometryJson = PlatformPackedGeometryJson;
/** JSON rows checked into a pack's rows. */
export const packedRows: typeof platformPackedRows = platformPackedRows;
/** A decoded pack of float32 geometries: each read fresh as the builder made it. */
export const GeometryPack: typeof PlatformGeometryPack = PlatformGeometryPack;
/** The build-time writer of a pack: geometries added in order, read back exact by `GeometryPack`. */
export const GeometryPackWriter: typeof PlatformGeometryPackWriter = PlatformGeometryPackWriter;
/** Fetch a zlib-deflated bake and inflate it. */
export const fetchDeflated: typeof platformFetchDeflated = platformFetchDeflated;

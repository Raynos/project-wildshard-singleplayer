import type { MapAssembly } from '@wildshard/sdk/bake/mapAssembly';
import type { NativeTerrainSource } from '@wildshard/sdk/bake/terrain';

/** Every input by its repository path (the caller owns all reads: GR6, a pure producer). */
export type NalatiMapSource = (path: string) => Uint8Array;

/** Read from an explicit owned bank; no implicit source handoff. */
export function readNalatiMapScalar(source: unknown, directory: ReadonlyMap<string, Uint8Array>): Uint8Array;

export function nalatiMapAssembly(source: NalatiMapSource): Promise<{ assembly: MapAssembly; native: NativeTerrainSource['grid'] }>;

/** Owned canonical scene and compressed geometry bytes for the native painter. */
export function nalatiMapFiles(source: NalatiMapSource): Promise<ReadonlyMap<string, Uint8Array>>;

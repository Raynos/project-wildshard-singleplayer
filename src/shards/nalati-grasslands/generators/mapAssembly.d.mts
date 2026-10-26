import type { MapAssembly } from '../../../../scripts/map-geometry.mjs';
import type { BakedGrid } from '@wildshard/format/bakedTerrainBytes';

/** Read a prepared binary scalar from the shard's source directory. */
export function readNalatiMapScalar(source: unknown, directory?: string): Uint8Array;

export function nalatiMapAssembly(): Promise<{ assembly: MapAssembly; native: BakedGrid }>;

/** Owned canonical scene and compressed geometry bytes for the native painter. */
export function nalatiMapFiles(): Promise<ReadonlyMap<string, Uint8Array>>;

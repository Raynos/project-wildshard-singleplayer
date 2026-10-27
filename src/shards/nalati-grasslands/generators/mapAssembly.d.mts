import type { MapAssembly } from '../../../../scripts/map-geometry.mjs';
import type { BakedGrid } from '@wildshard/format/bakedTerrainBytes';

/** Read from an explicit owned bank or explicit fixture directory; no implicit source handoff. */
export function readNalatiMapScalar(source: unknown, directory: string | ReadonlyMap<string, Uint8Array>): Uint8Array;

export function nalatiMapAssembly(): Promise<{ assembly: MapAssembly; native: BakedGrid }>;

/** Owned canonical scene and compressed geometry bytes for the native painter. */
export function nalatiMapFiles(): Promise<ReadonlyMap<string, Uint8Array>>;

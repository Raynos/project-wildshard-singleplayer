import type { MapAssembly } from '@wildshard/sdk/bake/mapAssembly';
import type { PineSources } from './pineSources.ts';

/** The map's rest assembly over Pine's program sources (the caller owns every read: a pure producer). */
export function pineMapAssembly(sources: PineSources): Promise<{ assembly: MapAssembly; trees: readonly { x: number; y: number; z: number; r: number; variant: number }[]; floor: { layout: Record<string, { matrix: number[] }[]> } }>;

/** The map painter's files: `map/assembly.json` and the deflated `map/geometry.bin`. */
export function pineMapFiles(sources: PineSources): Promise<ReadonlyMap<string, Uint8Array>>;

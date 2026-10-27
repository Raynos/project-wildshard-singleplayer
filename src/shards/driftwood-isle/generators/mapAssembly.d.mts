import type { Matrix4 } from 'three';
import type { MapAssembly } from '@wildshard/sdk/bake/mapAssembly';

/** Every input by its repository path (the caller owns all reads: GR7, a pure producer). */
export type DriftwoodMapSource = (path: string) => Uint8Array;

export function driftwoodMapAssembly(source: DriftwoodMapSource): Promise<{ assembly: MapAssembly; bridge: { planks: unknown[]; segments: unknown[] }; plan: { families: { indices: number[] }[]; used: number }; byProto: Map<string, Matrix4[]>; cover: number[]; entryDecks: { edge: string }[] }>;

/** The map painter's files: `map/assembly.json` and the deflated `map/geometry.bin`. */
export function driftwoodMapFiles(source: DriftwoodMapSource): Promise<ReadonlyMap<string, Uint8Array>>;

import type { CabinRows } from './cabinShapes';
import type { PineSources } from './pineSources';

/** The page's terrain heights for the cabin bake: Pine Hollow's baked grid (src/shards/pine-hollow/generators/bake-pine-cabins.mjs). */
export function pineCabinHeights(sources: PineSources): (x: number, z: number) => number;

/** The cabins' raw geometry binary and rows (hash and size, geometries, buildings), built once per sources. */
export function pineCabins(sources: PineSources): { bin: Uint8Array; rows: CabinRows };

import type { CabinRows } from './cabinShapes';

/** The page's terrain heights for the cabin bake: Pine Hollow's baked grid (src/shards/pine-hollow/generators/bake-pine-cabins.mjs). */
export function pineCabinHeights(): (x: number, z: number) => number;

/** The cabins' raw geometry binary and rows (hash and size, geometries, buildings), built once per process. */
export function pineCabins(): { bin: Uint8Array; rows: CabinRows };

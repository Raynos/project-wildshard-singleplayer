import type { FloorLayout } from './floorRows.mjs';

/** The floor's counts per kind and its decoded layout (src/shards/pine-hollow/generators/bake-pine-floor.mjs). */
export function pineFloorLayout(): { counts: number[]; layout: FloorLayout };

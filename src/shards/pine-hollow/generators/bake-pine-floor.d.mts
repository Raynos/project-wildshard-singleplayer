import type { FloorLayout } from './floorRows.mjs';
import type { PineSources } from './pineSources';

/** The floor's counts per kind and its decoded layout (src/shards/pine-hollow/generators/bake-pine-floor.mjs). */
export function pineFloorLayout(sources: PineSources): { counts: number[]; layout: FloorLayout };

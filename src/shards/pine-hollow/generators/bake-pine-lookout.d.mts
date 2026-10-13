import type { NativeTerrainSource } from '@wildshard/sdk/bake/terrain';
import type { LookoutRows } from './timberRows';
/** The lookout bake: its rows and the raw (unshuffled, uninflated) binary (src/shards/pine-hollow/generators/bake-pine-lookout.mjs). */
export function bakeLookoutRows(): { rows: LookoutRows; bin: Uint8Array };

/** Explicit retained renderer queries, without an installed world. */
export function pineTimberGround(): NativeTerrainSource;

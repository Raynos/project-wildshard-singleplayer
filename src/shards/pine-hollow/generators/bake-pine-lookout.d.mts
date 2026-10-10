import type { LookoutRows } from '../models/fireLookout';
/** The lookout bake: its rows and the raw (unshuffled, uninflated) binary (src/shards/pine-hollow/generators/bake-pine-lookout.mjs). */
export function bakeLookoutRows(): { rows: LookoutRows; bin: Uint8Array };

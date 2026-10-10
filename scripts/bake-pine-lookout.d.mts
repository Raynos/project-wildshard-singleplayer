import type { LookoutRows } from '../src/shards/pine-hollow/models/fireLookout';
/** The lookout bake: its rows and the raw (unshuffled, uninflated) binary (scripts/bake-pine-lookout.mjs). */
export function bakeLookoutRows(): { rows: LookoutRows; bin: Uint8Array };

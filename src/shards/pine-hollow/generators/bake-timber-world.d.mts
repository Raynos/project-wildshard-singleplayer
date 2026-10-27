import type { PineSources } from './pineSources';
import type { LookoutRows } from './timberRows';
/** The lookout bake: its rows and the raw (unshuffled, uninflated) binary (src/shards/pine-hollow/generators/bake-timber-world.mjs). */
export function bakeLookoutRows(): { rows: LookoutRows; bin: Uint8Array };
/** The timber world's rows, hash-named assets and material payloads, by source key (GR8 G37). */
export function bakeTimberWorldFiles(sources: PineSources): Promise<Map<string, Uint8Array>>;

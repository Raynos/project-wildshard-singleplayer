import type { NativeTerrainSource } from '@wildshard/sdk/bake/terrain';
import type { SiteTimberRows } from './timberRows';
/** The site timbers' bake: its rows and the raw (unshuffled, uninflated) binary (src/shards/pine-hollow/generators/bake-pine-site-timbers.mjs). */
export function bakeSiteTimberRows(): { rows: SiteTimberRows; bin: Uint8Array };

/** Explicit retained renderer queries, without an installed world. */
export function pineTimberGround(): NativeTerrainSource;

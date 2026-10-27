import type { NativeTerrainSource } from '@wildshard/sdk/bake/terrain';
import type { SiteTimberRows } from './timberRows';
import type { PineSources } from './pineSources';
/** The site timbers' bake: its rows and the raw (unshuffled, uninflated) binary (src/shards/pine-hollow/generators/bake-pine-site-timbers.mjs). */
export function bakeSiteTimberRows(sources: PineSources): { rows: SiteTimberRows; bin: Uint8Array };

/** Explicit retained renderer queries, without an installed world. */
export function pineTimberGround(sources: PineSources): NativeTerrainSource;

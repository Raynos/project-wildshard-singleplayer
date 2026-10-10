import type { SiteTimberRows } from '../src/shards/pine-hollow/world/timberSites';
/** The site timbers' bake: its rows and the raw (unshuffled, uninflated) binary (scripts/bake-pine-site-timbers.mjs). */
export function bakeSiteTimberRows(): { rows: SiteTimberRows; bin: Uint8Array };

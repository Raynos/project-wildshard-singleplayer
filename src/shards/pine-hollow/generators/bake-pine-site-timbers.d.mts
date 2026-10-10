import type { SiteTimberRows } from '../world/timberSites';
/** The site timbers' bake: its rows and the raw (unshuffled, uninflated) binary (src/shards/pine-hollow/generators/bake-pine-site-timbers.mjs). */
export function bakeSiteTimberRows(): { rows: SiteTimberRows; bin: Uint8Array };

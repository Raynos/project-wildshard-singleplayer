/** Build every live first-party product with its charged immutable map, enforcing recorded raster and world freshness.
 * `reuse` keeps a product whose content key is unchanged; `only` builds just those shards (scripts/shardfile-cache.mjs). */
export function buildShardfiles(root: string, options?: { strict?: boolean; build?: (args: string[]) => Promise<void>; reuse?: boolean; only?: string[] }): Promise<number>;

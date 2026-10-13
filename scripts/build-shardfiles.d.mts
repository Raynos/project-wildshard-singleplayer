/** Build every live first-party product with its charged immutable map, enforcing recorded raster and world freshness. */
export function buildShardfiles(root: string, options?: { strict?: boolean; build?: (args: string[]) => Promise<void> }): Promise<number>;

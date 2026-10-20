/** Build every live first-party product with its charged immutable map, enforcing recorded raster and world freshness.
 * `reuse` keeps a product whose content key is unchanged; `only` builds just those shards.
 * `catalog` requires a complete pass with strict runtime copies, then publishes discovery once.
 * `copyRuntime` proves selected runtime copies without publishing a catalog. */
export function buildShardfiles(root: string, options?: { strict?: boolean; build?: (args: string[]) => Promise<void>; reuse?: boolean; only?: string[]; catalog?: boolean; copyRuntime?: boolean | 'closed'; onFailure?:(slug:string,error:unknown)=>void }): Promise<number>;

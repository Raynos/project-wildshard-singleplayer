import type { PineSources } from './pineSources';

/** The living cabin rows (blobs, geometry, hashes, profiles; their reader admits them) and the raw GLB of each living
 *  shape the scene bake does not already store, by its source name (`assets/cabin-living/…`), baked once per sources. */
export function cabinLivingBake(sources: PineSources): Promise<{ rows: unknown; glbs: ReadonlyMap<string, Uint8Array> }>;

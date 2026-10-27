import type { PineSources } from './pineSources';

/** The cabin scene rows (blobs, geometry, hashes, worlds, specimens, source materials, graphs; their reader admits them)
 *  and the raw GLB of each stored shape by its source name (`assets/cabin-scenes/…`), baked once per sources. */
export function cabinSceneBake(sources: PineSources): Promise<{ rows: unknown; glbs: ReadonlyMap<string, Uint8Array> }>;

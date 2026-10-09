import { sourceManifest as mapSource } from '@wildshard/game/shardfile/sourceManifest';
import type { Shardfile } from './shardfile';

/** Map a parsed author's identity and presentation into discovery data without fetching or installing services.
 * Image bytes must already be admitted and charged to the shard's library. */
export function sourceManifest(source: Pick<Shardfile, 'identity' | 'accent' | 'spawn' | 'look' | 'presentation'>, assets: ReadonlyMap<string, Uint8Array> = new Map()): ReturnType<typeof mapSource> {
  return mapSource(source, assets);
}
